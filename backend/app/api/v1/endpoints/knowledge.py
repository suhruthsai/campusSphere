"""
Admin: Mitra's college knowledge base. Status and a Refresh button for the website crawl, a test search,
the indexed documents, PDF uploads (for files the crawler can't read, like Drive documents), and the
questions people ask Mitra, so missing answers show up.
"""
import threading
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.core.security import require_admin
from backend.app.db.session import get_db
from backend.app.knowledge import search, service
from backend.app.knowledge.questions import QUESTIONS
from backend.app.models.knowledge import KbAskedModel, KbChunkModel, KbDocumentModel

router = APIRouter(dependencies=[Depends(require_admin)])

MAX_UPLOAD = 20 * 1024 * 1024


@router.get("/status", summary="Documents, passages, last and next crawl")
def kb_status(db: Session = Depends(get_db)):
    return service.status(db)


@router.post("/refresh", summary="Crawl the college website now (runs in the background)")
def kb_refresh():
    if service._running.locked():
        raise HTTPException(status_code=409, detail="A crawl is already running.")
    threading.Thread(target=service.refresh, args=("admin",), daemon=True, name="knowledge-admin-refresh").start()
    return {"status": "started"}


@router.get("/search", summary="Test what Mitra would find for a query")
def kb_search(q: str, k: int = 5):
    return search.current().search(q, k=max(1, min(k, 10)))


@router.get("/documents", summary="Indexed documents (newest first)")
def kb_documents(source: Optional[str] = None, q: Optional[str] = None, limit: int = 200, db: Session = Depends(get_db)):
    chunks = dict(db.query(KbChunkModel.document_id, func.count(KbChunkModel.id)).group_by(KbChunkModel.document_id).all())
    query = db.query(KbDocumentModel)
    if source:
        query = query.filter(KbDocumentModel.source == source)
    if q:
        query = query.filter(KbDocumentModel.title.ilike(f"%{q}%"))
    rows = query.order_by(KbDocumentModel.fetched_at.desc()).limit(max(1, min(limit, 1000))).all()
    return [{"id": d.id, "title": d.title, "url": d.url, "kind": d.kind, "source": d.source, "chars": len(d.text),
             "passages": chunks.get(d.id, 0), "fetched_at": d.fetched_at, "checked_at": d.checked_at} for d in rows]


@router.post("/upload", summary="Add a PDF (e.g. the fee structure from Drive) so its text is searchable")
async def kb_upload(file: UploadFile = File(...), title: str = Form(""), link: str = Form(""), db: Session = Depends(get_db)):
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="PDFs up to 20 MB, please.")
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")
    link = link.strip()
    if link and not link.startswith(("https://", "http://")):
        raise HTTPException(status_code=400, detail="The link must start with https://")
    try:
        doc = service.add_upload(db, file.filename or "document.pdf", data, title.strip()[:200], link or None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": doc.id, "title": doc.title, "url": doc.url, "chars": len(doc.text)}


@router.delete("/documents/{doc_id}", summary="Remove an uploaded document")
def kb_delete(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(KbDocumentModel, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="No such document.")
    if doc.source != "upload":
        raise HTTPException(status_code=400, detail="Crawled pages follow the website; only uploads can be removed.")
    db.delete(doc)
    db.commit()
    search.rebuild(db)
    return {"deleted": doc_id}


@router.get("/asked", summary="What people ask Mitra, most frequent first")
def kb_asked(unanswered: bool = False, limit: int = 50, db: Session = Depends(get_db)):
    query = db.query(func.lower(KbAskedModel.question), func.count(KbAskedModel.id), func.max(KbAskedModel.top_score),
                     func.max(KbAskedModel.created_at))
    if unanswered:
        query = query.filter(KbAskedModel.answered.is_(False))
    rows = (query.group_by(func.lower(KbAskedModel.question)).order_by(func.count(KbAskedModel.id).desc())
            .limit(max(1, min(limit, 200))).all())
    return [{"question": q, "times": n, "best_score": s, "last_asked": t} for q, n, s, t in rows]


@router.get("/questions", summary="The question bank by audience (parents, students, visitors, administration)")
def kb_questions():
    return {aud: [q for q, _ in items] for aud, items in QUESTIONS.items()}
