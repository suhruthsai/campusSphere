"""
Finds the documents students need on the official college website (mvsrec.edu.in) and files them in CampusLocker.

It reads the pages students use (syllabus, academic calendar, fees, admissions, exam branch, scholarships,
circulars, policies...) and lists every document they link. It follows the same rules as the knowledge-base
crawler (backend/app/knowledge/crawler.py): robots.txt is obeyed, it identifies itself, waits between requests,
and stays on the college's own sites.

  * a PDF hosted on mvsrec.edu.in is downloaded and kept (private_uploads/college) so it opens inside the app;
  * a Google Drive document is recorded by name and link only: Drive's robots.txt forbids automated downloads,
    so students open those at Drive;
  * anything else (Word / Excel files, very large PDFs) is recorded by name and link.

Run it by hand:   python -m backend.app.college_docs.scraper
The app also runs it the first time and then weekly (service.start_background), and an admin can refresh it.
"""
import hashlib
import logging
import os
import re
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from backend.app.core.config import ROOT_DIR
from backend.app.db.session import SessionLocal
from backend.app.knowledge.crawler import HOSTS, ROOT, Crawler, anchor_name, drive_id
from backend.app.models.college_docs import CollegeDocumentModel
from backend.app.models.knowledge import KbDocumentModel

log = logging.getLogger("college_docs")

COLLEGE_DIR = Path(os.getenv("PRIVATE_UPLOADS_DIR", ROOT_DIR / "private_uploads")) / "college"
MAX_FILE_BYTES = 15 * 1024 * 1024
MAX_PAGES = 90
REFRESH_EVERY = timedelta(days=7)
FILE_EXT = re.compile(r"\.(pdf|docx?|xlsx?|pptx?|zip|rar)(?:\?|#|$)", re.I)

# The website pages students rely on (matched on the page's title)
PAGE_PATTERN = re.compile(
    r"syllabus|calendar|fee|time ?table|exam|circular|admission|scholar|result|anti.?rag|grievance|polic|rules|"
    r"regulation|code of conduct|transport|hostel|handbook|prospectus|brochure|download|forms?\b|aicte|naac|nba|"
    r"aqar|ssr|approval|mandatory|curriculum|scheme|notification|notice|payment|ombuds|placement reg", re.I)
SKIP_PAGES = re.compile(r"department library|privacy policy|^information technology$", re.I)

CATEGORIES = {
    "admissions": "Admissions", "fees": "Fees & payments", "calendar": "Academic calendar", "syllabus": "Syllabus & curriculum",
    "timetable": "Time tables", "archive": "Older syllabi (archive)", "exams": "Exams & results", "scholarships": "Scholarships", "policies": "Rules & policies",
    "accreditation": "Approvals & accreditation", "placements": "Placements", "circulars": "Circulars & notices", "other": "Other",
}
# First match wins: what the link says first, then the page it sits on
RULES = [
    ("admissions", r"admission|documents to be submitted|list of documents|eapcet|ecet\b|icet|counsell|\bspot\b|\branks?\b"),
    ("fees", r"\bfee|payment|challan|tuition"),
    ("calendar", r"calendar|academic schedule"),
    ("syllabus", r"syllabus|curriculum|scheme of|course structure|regulation.*(r\d\d|ug|pg)"),
    ("timetable", r"time ?table"),
    ("scholarships", r"scholar|e-?pass|fee reimbursement|sponsorship"),
    ("exams", r"exam|revaluation|re-?valuation|\brv\b|photocopy|supplement|result|hall ticket|notification"),
    ("policies", r"anti.?rag|grievance|polic|rules|regulation|code of conduct|ombuds|harass|handbook|\bugc\b"),
    ("accreditation", r"naac|nba\b|aicte|aqar|ssr|nirf|iqac|approval|mandatory"),
    ("placements", r"placement"),
    ("circulars", r"circular|notice"),
]


OLD_SYLLABUS = re.compile(r"old syllabus|non[- ]?cbcs|(19\d\d|200\d|201\d)")
NEW_YEAR = re.compile(r"202\d|r2\d")


def categorise(*texts: str) -> str:
    for text in texts:
        low = (text or "").lower()
        for key, pattern in RULES:
            if re.search(pattern, low):
                # Syllabi of regulations that ended before 2020 are kept, but apart from the current ones
                if key == "syllabus" and OLD_SYLLABUS.search(" ".join(t.lower() for t in texts if t)) and not NEW_YEAR.search(" ".join(t.lower() for t in texts if t)):
                    return "archive"
                return key
    return "other"


def _tidy(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("�", " ").replace("\xa0", " ")).strip(" -–>*<:.|")


def title_from_path(url: str) -> str:
    """'…/SYLLABUS/R25/CSE_AIML_Syllabus.pdf' -> 'R25 · CSE AIML Syllabus'."""
    parts = [p for p in unquote(urlsplit(url).path).split("/") if p]
    parts = [re.sub(r"\.[A-Za-z0-9]+$", "", p) for p in parts if p.lower() not in ("images", "files", "documents")]
    words = [re.sub(r"[_\-]+", " ", p).strip() for p in parts[-2:]]
    return " · ".join(w for w in words if w)[:160]


def make_title(anchor: str, page_title: str, url: str, from_site: bool) -> tuple[str, str | None]:
    """(a readable title, a publication date if the link text starts with one)."""
    text = _tidy(anchor)
    date = None
    m = re.match(r"^(\d{4}-\d{2}-\d{2})\s*[-–:.]*\s*", text)
    if m:
        date, text = m.group(1), _tidy(text[m.end():])
    if from_site and (len(text) < 16 or re.fullmatch(r"(sem|year|semester)[\w &.\-]*", text, re.I)):
        base = title_from_path(url)
        if len(base) < 8:                       # a file called "te.pdf" says nothing: name the page it came from
            base = f"{page_title} · {base}"
        text = f"{base} ({text})" if text and text.lower() not in base.lower() else base
    return anchor_name(text, page_title)[:200], date


def _article_links(html: str, page_url: str):
    """(absolute url, link text) for the links inside the page's own content, not its menus."""
    soup = BeautifulSoup(html, "html.parser")
    body = (soup.select_one("article.tm-article .tm-article-content") or soup.select_one("article.uk-article")
            or soup.select_one("main#tm-content") or soup.select_one("main") or soup.body)
    if body is None:
        return []
    for junk in body.select("nav, .uk-nav, .menu, .tm-sidebar-a, .tm-sidebar-b, script, style"):
        junk.decompose()
    return [(urljoin(page_url, a["href"]), a.get_text(" ", strip=True)) for a in body.find_all("a", href=True)]


def _host_of(url: str) -> str:
    return (urlsplit(url).hostname or "").lower().removeprefix("www.")


class Scraper:
    def __init__(self, db: Session, delay: float = 0.8, say=print):
        self.db, self.say = db, say
        self.crawler = Crawler(delay=delay, log=say)
        COLLEGE_DIR.mkdir(parents=True, exist_ok=True)
        self.stats = {"pages": 0, "found": 0, "files_saved": 0, "files_kept": 0, "links": 0, "skipped_robots": 0, "failed": 0}

    # ── Which pages to read ──────────────────────────────────────────────
    def pages(self) -> list:
        """The college pages students use: from what the knowledge base crawled, or the home page's own menu."""
        rows = (self.db.query(KbDocumentModel.url, KbDocumentModel.title)
                .filter(KbDocumentModel.kind == "html", KbDocumentModel.source == "site").all())
        picked = {}
        for url, title in rows:
            if url != ROOT and PAGE_PATTERN.search(title or "") and not SKIP_PAGES.search(title or ""):
                picked[url] = title
        if not picked:      # a fresh install with no crawl yet: use the home page's menu
            r = self.crawler._get(ROOT) if self.crawler._allowed(ROOT) else None
            if r is not None:
                for href, text in _article_links(r.text, ROOT):
                    if _host_of(href) in HOSTS and PAGE_PATTERN.search(text) and not FILE_EXT.search(href):
                        picked[href] = text
        return list(picked.items())[:MAX_PAGES]

    # ── Downloading ─────────────────────────────────────────────────────
    def _download_pdf(self, url: str) -> tuple[bytes, str] | None:
        if not self.crawler._allowed(url):
            self.stats["skipped_robots"] += 1
            return None
        wait = self.crawler.delay - (time.monotonic() - self.crawler._last)
        if wait > 0:
            time.sleep(wait)
        self.crawler._last = time.monotonic()
        try:
            with self.crawler.client.stream("GET", url) as r:
                if r.status_code != 200:
                    return None
                length = int(r.headers.get("content-length") or 0)
                if length > MAX_FILE_BYTES:
                    return None
                data = bytearray()
                for chunk in r.iter_bytes(64 * 1024):
                    data.extend(chunk)
                    if len(data) > MAX_FILE_BYTES:
                        return None
        except Exception as e:  # noqa: BLE001 — one bad file must not stop the run
            self.say(f"[docs] {url}: {type(e).__name__}")
            self.stats["failed"] += 1
            return None
        if not data.startswith(b"%PDF-"):
            return None
        return bytes(data), hashlib.sha256(data).hexdigest()

    # ── The run ─────────────────────────────────────────────────────────
    def run(self) -> dict:
        now = datetime.utcnow()
        seen: set = set()
        for page_url, page_title in self.pages():
            if not self.crawler._allowed(page_url):
                self.stats["skipped_robots"] += 1
                continue
            r = self.crawler._get(page_url)
            if r is None:
                self.stats["failed"] += 1
                continue
            self.stats["pages"] += 1
            title_now = page_title
            for href, anchor in _article_links(r.text, str(r.url)):
                fid = drive_id(href)
                if fid:
                    url, host = f"https://drive.google.com/file/d/{fid}/view", "drive"
                elif _host_of(href) in HOSTS and FILE_EXT.search(href):
                    url, host = href.split("#")[0], "site"
                else:
                    continue
                if url in seen:
                    continue
                seen.add(url)
                self.stats["found"] += 1
                self._save(url, host, anchor, title_now, str(r.url), now)
            self.db.commit()
        # Documents the website no longer links are hidden (their files are kept)
        self.db.query(CollegeDocumentModel).filter(CollegeDocumentModel.last_seen < now).update({"active": False})
        self.db.commit()
        self.crawler.client.close()
        self.say(f"[docs] done: {self.stats}")
        return self.stats

    def _save(self, url: str, host: str, anchor: str, page_title: str, page_url: str, now: datetime) -> None:
        row = self.db.query(CollegeDocumentModel).filter(CollegeDocumentModel.url == url).first()
        title, published = make_title(anchor, page_title, url, from_site=host == "site")
        category = categorise(title, page_title)
        if row:
            row.last_seen, row.active = now, True
            row.title, row.category, row.page_title, row.page_url = title, category, page_title[:200], page_url
            row.published_on = published or row.published_on
            if row.kind == "file":
                self.stats["files_kept"] += 1
                return
        else:
            row = CollegeDocumentModel(url=url, title=title, category=category, kind="link", host=host, page_title=page_title[:200],
                                       page_url=page_url, published_on=published, first_seen=now, last_seen=now)
            self.db.add(row)
        if host == "drive" or not url.lower().split("?")[0].endswith(".pdf"):
            self.stats["links"] += 1
            return
        got = self._download_pdf(url)
        if not got:
            self.stats["links"] += 1          # too big, unreachable or not a PDF: kept as a link
            return
        data, digest = got
        stored = f"{digest[:32]}.pdf"
        path = COLLEGE_DIR / stored
        if not path.exists():
            path.write_bytes(data)
        row.kind, row.stored_name, row.content_type, row.size_bytes, row.sha256 = "file", stored, "application/pdf", len(data), digest
        self.stats["files_saved"] += 1


# ── Entry points ─────────────────────────────────────────────────────────────
_running = threading.Lock()


def refresh(say=print) -> dict | None:
    """Scrape once (None if a run is already going)."""
    if not _running.acquire(blocking=False):
        return None
    db = SessionLocal()
    try:
        return Scraper(db, say=say).run()
    finally:
        db.close()
        _running.release()


def last_run() -> datetime | None:
    db = SessionLocal()
    try:
        return db.query(CollegeDocumentModel.last_seen).order_by(CollegeDocumentModel.last_seen.desc()).limit(1).scalar()
    finally:
        db.close()


def is_running() -> bool:
    return _running.locked()


def start_background() -> None:
    """On boot: read the website if it was never read (or not for a week), then check again every week."""
    def loop():
        time.sleep(90)       # let the knowledge-base crawl and the server settle first
        while True:
            try:
                seen = last_run()
                if seen is None or datetime.utcnow() - seen > REFRESH_EVERY:
                    refresh(log.info)
            except Exception as e:  # noqa: BLE001
                log.warning("college documents refresh failed: %s", e)
            time.sleep(6 * 3600)
    threading.Thread(target=loop, daemon=True, name="college-docs").start()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    from backend.app.db.session import Base, engine
    from backend.app.models import college_docs as _m, knowledge as _k  # noqa: F401  (register the tables)
    Base.metadata.create_all(bind=engine)
    print(refresh())
