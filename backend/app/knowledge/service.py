"""
The knowledge base's lifecycle: crawl the college website, store what changed, chunk it, rebuild the
search index; once a week on its own (and on an admin's Refresh), plus admin-uploaded documents.
"""
import hashlib
import logging
import re
import threading
import time
from datetime import datetime, timedelta

from backend.app.db.session import SessionLocal
from backend.app.knowledge import search
from backend.app.knowledge.crawler import Crawler, Fetched, pdf_to_text
from backend.app.models.knowledge import KbChunkModel, KbCrawlModel, KbDocumentModel

logging.getLogger("pypdf").setLevel(logging.ERROR)   # malformed PDFs are common and not our problem

REFRESH_EVERY = timedelta(days=7)
CHUNK_WORDS, OVERLAP_WORDS = 180, 30
_running = threading.Lock()


def chunk(text: str) -> list:
    """[(heading, passage)]: ~180-word passages with a 30-word overlap, cut at paragraph ends, each
    carrying the nearest ## heading above it."""
    out, heading, buf = [], None, []

    def flush():
        if buf:
            out.append((heading, " ".join(buf)))

    for para in [p.strip() for p in text.split("\n") if p.strip()]:
        if para.startswith("## "):
            flush()
            buf.clear()
            heading = para[3:].strip()[:200] or heading
            continue
        words = para.split()
        while words:
            room = CHUNK_WORDS - len(buf)
            buf.extend(words[:room])
            words = words[room:]
            if len(buf) >= CHUNK_WORDS:
                flush()
                del buf[:-OVERLAP_WORDS]
    flush()
    seen, unique = set(), []
    for h, passage in out:                 # overlap can repeat a short tail: keep each passage once
        if passage not in seen and len(passage) > 8:
            seen.add(passage)
            unique.append((h, passage))
    return unique


def _hash(doc: Fetched) -> str:
    return hashlib.sha256(f"{doc.title}\n{doc.text}".encode()).hexdigest()


def store(db, doc: Fetched, source: str | None = None) -> bool:
    """Insert or update one document; returns True when its content was new or changed."""
    digest = _hash(doc)
    row = db.query(KbDocumentModel).filter(KbDocumentModel.url == doc.url).first()
    now = datetime.utcnow()
    if row and row.content_hash == digest:
        row.checked_at = now
        return False
    if row is None:
        row = KbDocumentModel(url=doc.url)
        db.add(row)
    row.title, row.kind, row.source, row.text = doc.title[:300], doc.kind, source or doc.source, doc.text
    row.content_hash, row.fetched_at, row.checked_at = digest, now, now
    db.flush()
    db.query(KbChunkModel).filter(KbChunkModel.document_id == row.id).delete()
    for i, (heading, passage) in enumerate(chunk(doc.text) or [(None, doc.title)]):
        db.add(KbChunkModel(document_id=row.id, ord=i, heading=heading, text=passage))
    return True


def refresh(trigger: str = "admin", max_docs: int | None = None) -> dict:
    """Crawl the site now. Only one crawl runs at a time; returns the crawl record as a dict."""
    if not _running.acquire(blocking=False):
        return {"status": "busy", "note": "A crawl is already running."}
    db = SessionLocal()
    # Another process (a second server worker, a script) may be crawling: one crawl at a time across all
    recent = datetime.utcnow() - timedelta(hours=2)
    if db.query(KbCrawlModel).filter(KbCrawlModel.status == "running", KbCrawlModel.started_at > recent).first():
        db.close()
        _running.release()
        return {"status": "busy", "note": "Another crawl is already running."}
    run = KbCrawlModel(trigger=trigger, status="running")
    db.add(run)
    db.commit()
    try:
        crawler = Crawler(**({"max_docs": max_docs} if max_docs else {}), log=lambda m: print(m))
        seen_urls, seen_hashes = set(), set()
        for doc in crawler.crawl():
            if not doc.text.strip():
                continue
            digest = hashlib.sha256(doc.text.encode()).hexdigest()
            if digest in seen_hashes and doc.kind == "html":   # the same article under another menu name
                continue
            seen_hashes.add(digest)
            seen_urls.add(doc.url)
            run.pages += 1
            if store(db, doc):
                run.changed += 1
            if run.pages % 25 == 0:
                db.commit()
        # Pages that vanished from the site are dropped, unless this crawl looks broken (site down)
        known = db.query(KbDocumentModel).filter(KbDocumentModel.source.in_(["site", "drive"])).all()
        if run.pages >= 0.5 * max(1, len(known)):
            for row in known:
                if row.url not in seen_urls:
                    db.delete(row)
                    run.removed += 1
        else:
            run.note = f"Only {run.pages} documents reached (had {len(known)}): kept the old ones."
        run.errors = crawler.errors
        run.status, run.finished_at = "done", datetime.utcnow()
        db.commit()
        search.rebuild(db)
    except Exception as e:  # noqa: BLE001 — record the failure; the old index keeps serving
        db.rollback()
        run.status, run.finished_at, run.note = "failed", datetime.utcnow(), f"{type(e).__name__}: {e}"[:500]
        db.add(run)
        db.commit()
        print(f"[knowledge] crawl failed: {e}")
    finally:
        result = {"id": run.id, "status": run.status, "pages": run.pages, "changed": run.changed,
                  "removed": run.removed, "errors": run.errors, "note": run.note}
        db.close()
        _running.release()
    print(f"[knowledge] crawl {result}")
    return result


def add_upload(db, filename: str, data: bytes, title: str, link: str | None) -> KbDocumentModel:
    """An admin-uploaded PDF (e.g. the fee structure from Drive): searchable, kept across crawls."""
    pdf_title, text = pdf_to_text(data)
    if len(text) < 40:
        raise ValueError("This PDF has no readable text (it may be a scan).")
    url = link or f"upload://{re.sub(r'[^A-Za-z0-9._-]+', '_', filename)}"
    store(db, Fetched(url, title or pdf_title or filename, "pdf", text), source="upload")
    db.commit()
    search.rebuild(db)
    return db.query(KbDocumentModel).filter(KbDocumentModel.url == url).first()


def status(db) -> dict:
    from sqlalchemy import func
    last = db.query(KbCrawlModel).order_by(KbCrawlModel.id.desc()).first()
    done = db.query(KbCrawlModel).filter(KbCrawlModel.status == "done").order_by(KbCrawlModel.id.desc()).first()
    counts = dict(db.query(KbDocumentModel.source, func.count(KbDocumentModel.id)).group_by(KbDocumentModel.source).all())
    return {
        "running": _running.locked(),
        "documents": counts, "chunks": len(search.current().chunks),
        "last_crawl": last and {"status": last.status, "trigger": last.trigger, "started_at": last.started_at,
                                "finished_at": last.finished_at, "pages": last.pages, "changed": last.changed,
                                "removed": last.removed, "errors": last.errors, "note": last.note},
        "next_crawl": (done.finished_at + REFRESH_EVERY) if done and done.finished_at else None,
    }


def start_background():
    """Load the index now; crawl in the background on first run and then once a week."""
    def loop():
        db = SessionLocal()
        try:
            n = search.rebuild(db)
            print(f"✅ College knowledge base: {n} passages")
        except Exception as e:  # noqa: BLE001 — the tables may not exist yet on a broken DB
            print(f"⚠️  Knowledge base not loaded: {e}")
        finally:
            db.close()
        time.sleep(90)   # let the server finish starting (and a restarting dev server settle) before crawling
        while True:
            db = SessionLocal()
            try:
                done = (db.query(KbCrawlModel).filter(KbCrawlModel.status == "done")
                        .order_by(KbCrawlModel.id.desc()).first())
                due = done is None or (done.finished_at and datetime.utcnow() - done.finished_at > REFRESH_EVERY)
                trigger = "first-run" if done is None else "weekly"
            except Exception:  # noqa: BLE001
                due = False
            finally:
                db.close()
            if due:
                refresh(trigger)
            time.sleep(6 * 3600)   # check four times a day (a sleeping free-tier server checks on waking)

    threading.Thread(target=loop, daemon=True, name="knowledge-refresh").start()
