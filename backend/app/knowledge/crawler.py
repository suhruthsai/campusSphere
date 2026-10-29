"""
Polite crawler for the official college website (mvsrec.edu.in), the source of Mitra's answers.

  - obeys robots.txt, identifies itself, waits between requests and stops at a page budget;
  - stays on the college's own sites (mvsrec.edu.in, data.mvsrec.edu.in) and reads the PDFs they host;
  - Google Drive files the site links to (fee structure, notices, brochure) are recorded by name and link
    only: Drive's robots.txt forbids crawlers from downloading them. Admins upload the important ones on
    the Knowledge page so their text becomes searchable;
  - scanned PDFs with no text are likewise recorded by name and link;
  - Joomla serves one article under many URLs (Itemid, print views): URLs are canonicalised so each
    article is fetched once;
  - keeps the article text only (menus, sliders and footers are dropped), tables as "cell | cell" rows.
"""
import io
import re
import time
from collections import deque
from dataclasses import dataclass
from urllib import robotparser
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup

ROOT = "https://mvsrec.edu.in/"
HOSTS = {"mvsrec.edu.in", "data.mvsrec.edu.in"}
USER_AGENT = "CampusSphereBot/1.0 (MVSR campus assistant knowledge base; respects robots.txt)"
DELAY = 0.8                     # seconds between requests to the college server
MAX_DOCS = 700
MAX_DEPTH = 4
MAX_PDF_BYTES = 15 * 1024 * 1024
MAX_PDF_PAGES = 80
SKIP_EXT = re.compile(r"\.(jpe?g|png|gif|svg|webp|ico|bmp|zip|rar|7z|mp4|mp3|avi|mov|wmv|css|js|xlsx?|pptx?|docx?|exe)$", re.I)
SKIP_QUERY = ("com_users", "task=", "format=feed", "print=1", "tmpl=component", "com_mailto", "format=pdf", "com_search")
# Joomla query parameters that change the article; everything else (Itemid, lang, ...) is dropped
KEEP_PARAMS = {"option", "view", "id", "catid", "layout"}
DRIVE_FILE = re.compile(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{20,})")


@dataclass
class Fetched:
    url: str
    title: str
    kind: str          # html | pdf | link (a document known by name and link only)
    text: str
    source: str = "site"   # site | drive


GENERIC_TITLES = {"mvsr engineering college", "mvsr", "circular", "read more", "click here", "home", ""}


VAGUE_ANCHOR = re.compile(r"^(https?:|www\.)|^(click here|here|view|download|link|open|pdf|read more|more|details)\W*$", re.I)


def anchor_name(anchor: str, page_title: str) -> str:
    """A document's name from its link text, or from the page that links it when the text says nothing
    ("click here", a bare URL)."""
    anchor = re.sub(r"\s+", " ", anchor or "").strip(" >*<-")
    if len(anchor) < 3 or VAGUE_ANCHOR.search(anchor):
        return f"{page_title} (document)"
    if len(anchor) < 16 or not re.search(r"[A-Za-z]{3}", anchor):   # "2020-2021", "Sem I": say whose it is
        return f"{page_title} {anchor}"
    return anchor


def listing(title: str, url: str, where: str) -> str:
    """Searchable text for a document we can't read: its name, and where the college links it."""
    return f"College document: {title}. Linked from the college website ({where}). Open the link to read it."


def canonical(url: str) -> str | None:
    """One URL per document on the college sites, or None for links we don't follow."""
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https"):
        return None
    host = (parts.hostname or "").lower().removeprefix("www.")
    if host not in HOSTS or SKIP_EXT.search(parts.path) or any(s in (parts.query or "") for s in SKIP_QUERY):
        return None
    if parts.path.startswith(("/administrator", "/components", "/modules", "/plugins", "/templates", "/media", "/images", "/cache")):
        return None
    query = parts.query
    if parts.path.endswith("index.php") or "option=" in query:
        query = urlencode(sorted((k, v) for k, v in parse_qsl(query) if k in KEEP_PARAMS))
    path = parts.path or "/"
    return urlunsplit(("https", host, path, query, ""))


def drive_id(url: str) -> str | None:
    m = DRIVE_FILE.search(url)
    return m.group(1) if m else None


def _clean(text: str) -> str:
    text = text.replace("\xa0", " ")
    lines = []
    for line in text.splitlines():
        line = re.sub(r"[ \t]+", " ", line).strip(" -|>\t")
        if line and not re.fullmatch(r"[-–—|>=\s.]*", line) and line not in lines[-3:]:
            lines.append(line)
    return "\n".join(lines).strip()


def html_to_text(html: str) -> tuple[str, str, list]:
    """(title, text, links) of a college page: the article only, headings marked with ##."""
    soup = BeautifulSoup(html, "html.parser")
    links = [(a.get("href"), a.get_text(" ", strip=True)) for a in soup.find_all("a", href=True)]
    article = soup.select_one("article.tm-article .tm-article-content") or soup.select_one("article.uk-article")
    body = article or soup.select_one("main#tm-content") or soup.select_one("main") or soup.body
    if body is None:
        return "", "", links
    for junk in body.select("script, style, noscript, form, nav, iframe, .slider, .regular, #thumbnail-slider, "
                            ".slider-image, .uk-pagination, .pagenav, .uk-nav, .tm-sidebar-a, .tm-sidebar-b, .menu"):
        junk.decompose()
    if article is None:
        # No article container: drop menu-like blocks (mostly link text) so only the page's own text remains
        for block in body.find_all(["ul", "div", "section", "aside"]):
            if block.decomposed:
                continue
            text = block.get_text(" ", strip=True)
            linked = sum(len(a.get_text(" ", strip=True)) for a in block.find_all("a"))
            if len(text) > 150 and linked > 0.6 * len(text):
                block.decompose()
    title_el = body.select_one(".uk-article-title, h1, h2")
    title = title_el.get_text(" ", strip=True) if title_el else ""
    for table in body.find_all("table"):
        rows = []
        for tr in table.find_all("tr"):
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["th", "td"])]
            if any(cells):
                rows.append(" | ".join(cells))
        table.replace_with(soup.new_string("\n" + "\n".join(rows) + "\n"))
    for h in body.find_all(["h1", "h2", "h3", "h4"]):
        h.replace_with(soup.new_string(f"\n## {h.get_text(' ', strip=True)}\n"))
    for br in body.find_all("br"):
        br.replace_with("\n")
    for block in body.find_all(["p", "li", "div", "tr"]):
        block.insert_after("\n")
    return title, _clean(body.get_text()), links


def pdf_to_text(data: bytes) -> tuple[str, str]:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    title = ((reader.metadata or {}).get("/Title") or "").strip() if reader.metadata else ""
    pages = []
    for page in reader.pages[:MAX_PDF_PAGES]:
        try:
            pages.append(page.extract_text() or "")
        except Exception:  # noqa: BLE001 — a broken page shouldn't lose the rest
            continue
    return title, _clean("\n".join(pages))


class Crawler:
    def __init__(self, max_docs: int = MAX_DOCS, delay: float = DELAY, log=print):
        self.max_docs, self.delay, self.log = max_docs, delay, log
        self.client = httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=25, follow_redirects=True)
        self.robots: dict = {}
        self.errors = 0
        self._last = 0.0

    def _allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        base = f"{parts.scheme}://{parts.netloc}"
        if base not in self.robots:
            rp = robotparser.RobotFileParser()
            try:
                r = self.client.get(base + "/robots.txt")
                rp.parse(r.text.splitlines() if r.status_code == 200 else [])
            except httpx.HTTPError:
                rp.parse([])
            self.robots[base] = rp
        return self.robots[base].can_fetch(USER_AGENT, url)

    def _get(self, url: str) -> httpx.Response | None:
        wait = self.delay - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()
        try:
            r = self.client.get(url)
        except httpx.HTTPError as e:
            self.errors += 1
            self.log(f"[crawl] {url}: {type(e).__name__}")
            return None
        if r.status_code != 200:
            self.errors += 1 if r.status_code >= 500 else 0
            return None
        return r


    def crawl(self, seeds: list | None = None):
        """Yield every document reachable from the home page (breadth first)."""
        queue = deque((u, "", 0) for u in (seeds or [ROOT]))
        seen, drive_seen, docs = set(), set(), 0
        while queue and docs < self.max_docs:
            raw, label, depth = queue.popleft()
            url = canonical(raw)
            if not url or url in seen:
                continue
            seen.add(url)
            if not self._allowed(url):
                continue
            r = self._get(url)
            if r is None:
                continue
            ctype = r.headers.get("content-type", "")
            if "pdf" in ctype or r.content[:4] == b"%PDF":
                if len(r.content) <= MAX_PDF_BYTES:
                    try:
                        title, text = pdf_to_text(r.content)
                    except Exception as e:  # noqa: BLE001
                        self.log(f"[crawl] unreadable PDF {url}: {type(e).__name__}")
                        title, text = "", ""
                    name = label or title or url.rsplit("/", 1)[-1]
                    docs += 1
                    if len(text) < 80:      # a scan: known by its name and link only
                        yield Fetched(url, name, "link", listing(name, url, "a PDF on the college site"))
                    else:
                        yield Fetched(url, name, "pdf", text)
                continue
            if "html" not in ctype:
                continue
            title, text, links = html_to_text(r.text)
            if title.lower() in GENERIC_TITLES and label:
                title = label           # e.g. the Hostel article has no heading: use its menu name
            page_title = title or "MVSR Engineering College"
            docs += 1
            yield Fetched(url, page_title, "html", text)
            if depth >= MAX_DEPTH:
                continue
            for href, anchor in links:
                absolute = urljoin(str(r.url), href)
                fid = drive_id(absolute)
                if fid:
                    if fid not in drive_seen:
                        drive_seen.add(fid)
                        name = anchor_name(anchor, page_title)
                        view = f"https://drive.google.com/file/d/{fid}/view"
                        yield Fetched(view, name[:200], "link", listing(name, view, f"page '{page_title}'"), "drive")
                    continue
                if canonical(absolute) and canonical(absolute) not in seen:
                    queue.append((absolute, anchor, depth + 1))
        self.client.close()
