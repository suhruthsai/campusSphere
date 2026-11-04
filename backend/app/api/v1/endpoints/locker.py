# CampusLocker — a personal document store, like a DigiLocker for the college.
#   * "My documents" lists everything of mine in one place: the certificates the college issued (from the Services
#     requests), the documents I uploaded when joining, and files I add myself (ID proofs, mark sheets, offer letters).
#   * The Admin Office can add official documents (marked "Added by the college") to a student's locker.
#   * Any item can be shared through an expiring link that anyone can open without an account (revocable), and the
#     owner sees an access log. Files live in private_uploads/locker, never in the public /media folder.
import os
import re
import secrets
import threading
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.core.config import ROOT_DIR
from backend.app.core.rate_limit import SlidingWindowLimiter, client_ip
from backend.app.college_docs import scraper
from backend.app.core.security import get_current_user, require_admin, require_roles
from backend.app.db.session import get_db
from backend.app.models.admissions import AdmissionDocumentModel, AdmissionModel
from backend.app.models.college_docs import CollegeDocumentModel
from backend.app.models.campus import UserModel
from backend.app.models.locker import LockerAccessModel, LockerFileModel, LockerShareModel
from backend.app.models.services import DocumentRequestModel, StudentProfileModel
from backend.app.student_services import joining as J
from backend.app.student_services.catalog import DOC_TYPES
from backend.app.student_services.pdf import render_pdf

router = APIRouter()          # mounted under /locker, login required
public_router = APIRouter()   # mounted under /locker, no login (share links)

LOCKER_DIR = Path(os.getenv("PRIVATE_UPLOADS_DIR", ROOT_DIR / "private_uploads")) / "locker"
MAX_FILE_BYTES = 10 * 1024 * 1024
QUOTA_BYTES = 50 * 1024 * 1024          # per person, for the files they add themselves
MAX_FILES = 200
MAX_ACTIVE_LINKS = 5                    # per item
CATEGORIES = {
    "id_proof": "ID proof", "marksheet": "Mark sheet", "certificate": "Certificate", "offer_letter": "Offer letter",
    "receipt": "Fee receipt", "other": "Other",
}
LABELS = {**CATEGORIES, "issued": "Issued by the college", "joining": "Joining document"}
office_only = require_roles("admin", "staff")

share_limiter = SlidingWindowLimiter(limit=60, window=60)           # share-link opens, per IP
bad_link_limiter = SlidingWindowLimiter(limit=15, window=600)       # wrong or expired tokens, per IP


# ── Storage ───────────────────────────────────────────────────────────────────
def _folder(user_id: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", user_id or ""):
        raise HTTPException(status_code=400, detail="Invalid account")
    return LOCKER_DIR / user_id


def _save(user_id: str, upload: UploadFile) -> dict:
    """Validate (by the file's first bytes, not its name) and store a PDF / JPG / PNG of at most 10 MB."""
    head = upload.file.read(8)
    match = next(((ctype, ext) for sig, ctype, ext in J.SIGNATURES if head.startswith(sig)), None)
    if not match:
        raise HTTPException(status_code=422, detail="Upload a PDF, JPG or PNG file")
    ctype, ext = match
    folder = _folder(user_id)
    folder.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    path = folder / stored
    size = len(head)
    with open(path, "wb") as f:
        f.write(head)
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                f.close()
                path.unlink(missing_ok=True)
                raise HTTPException(status_code=422, detail="Each file must be 10 MB or smaller")
            f.write(chunk)
    return {"stored_name": stored, "content_type": ctype, "size_bytes": size}


def _file_path(f: LockerFileModel) -> Path:
    if "/" in f.stored_name or "\\" in f.stored_name or ".." in f.stored_name:
        raise HTTPException(status_code=400, detail="Invalid file reference")
    return _folder(f.user_id) / f.stored_name


def _title(raw: str, upload: UploadFile) -> str:
    title = (raw or "").strip() or os.path.splitext(upload.filename or "")[0].strip() or "Document"
    return title[:120]


def _log(db: Session, user_id: str, ref: str, title: str, action: str, detail: Optional[str] = None) -> None:
    db.add(LockerAccessModel(user_id=user_id, item_ref=ref, title=title, action=action, detail=detail))


# ── Items: one ref for every kind of document ────────────────────────────────
def _resolve(db: Session, ref: str, user_id: str) -> Optional[dict]:
    """The item behind a ref ("file:3", "req:7", "adm:2") if it belongs to this person, else None.
    Returns title, content_type, filename and either `path` (a file) or `data` (a PDF made on the fly)."""
    kind, _, raw = (ref or "").partition(":")
    if not raw.isdigit():
        return None
    n = int(raw)
    if kind == "file":
        f = db.get(LockerFileModel, n)
        if f and f.user_id == user_id:
            return {"title": f.title, "content_type": f.content_type, "filename": f.original_name or f.title, "path": _file_path(f)}
    elif kind == "req":
        r = db.get(DocumentRequestModel, n)
        # Generated pilot data is never a valid certificate, so it never appears here
        if r and r.student_id == user_id and r.status == "approved" and not r.pilot_run:
            name = DOC_TYPES.get(r.doc_type, {}).get("name", "Certificate")
            filename = (r.ref_no or f"request-{r.id}").replace("/", "-") + ".pdf"
            if r.fulfilment == "upload":
                return {"title": name, "content_type": "application/pdf", "filename": filename, "path": J.issued_path(r.issued_file)}
            return {"title": name, "content_type": "application/pdf", "filename": filename, "data": lambda r=r: render_pdf(r)}
    elif kind == "adm":
        d = db.get(AdmissionDocumentModel, n)
        adm = db.get(AdmissionModel, d.admission_id) if d else None
        if d and adm and adm.user_id == user_id:
            return {"title": J.labels(db).get(d.doc_key, "Joining document"), "content_type": d.content_type or "application/octet-stream",
                    "filename": d.original_name or d.doc_key, "path": J.document_path(adm.id, d.stored_name)}
    return None


def _send(item: dict) -> Response:
    headers = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
               "Content-Disposition": f'inline; filename="{item["filename"].replace(chr(34), "")[:100]}"'}
    if "data" in item:
        return Response(item["data"](), media_type=item["content_type"], headers=headers)
    path: Path = item["path"]
    if not path.exists():
        raise HTTPException(status_code=410, detail="The file is no longer available")
    return FileResponse(path, media_type=item["content_type"], headers=headers)


def _iso(d: Optional[datetime]) -> Optional[str]:
    return d.isoformat() if d else None


def _active_shares(db: Session, user_id: str) -> dict:
    now = datetime.utcnow()
    rows = (db.query(LockerShareModel.item_ref, func.count(LockerShareModel.id))
            .filter(LockerShareModel.user_id == user_id, LockerShareModel.revoked_at.is_(None), LockerShareModel.expires_at > now)
            .group_by(LockerShareModel.item_ref).all())
    return dict(rows)


# ── Schemas ───────────────────────────────────────────────────────────────────
class ShareIn(BaseModel):
    hours: Literal[1, 24, 168, 720] = 24


# ── My locker ─────────────────────────────────────────────────────────────────
@router.get("/", summary="Everything in my locker, with how much space my own files use")
def my_locker(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    uid = current["sub"]
    shares = _active_shares(db, uid)
    items = []

    files = db.query(LockerFileModel).filter(LockerFileModel.user_id == uid).all()
    used = 0
    for f in files:
        ref = f"file:{f.id}"
        if f.source == "self":
            used += f.size_bytes
        items.append({"ref": ref, "title": f.title, "category": f.category, "category_label": LABELS.get(f.category, "Other"),
                      "source": f.source, "content_type": f.content_type, "size_bytes": f.size_bytes, "verified": bool(f.verified),
                      "created_at": _iso(f.created_at), "shares": shares.get(ref, 0), "can_delete": f.source == "self"})

    reqs = (db.query(DocumentRequestModel)
            .filter(DocumentRequestModel.student_id == uid, DocumentRequestModel.status == "approved", DocumentRequestModel.pilot_run.is_(None))
            .order_by(DocumentRequestModel.issued_at.desc()).all())
    for r in reqs:
        ref = f"req:{r.id}"
        items.append({"ref": ref, "title": DOC_TYPES.get(r.doc_type, {}).get("name", "Certificate"), "category": "issued",
                      "category_label": LABELS["issued"], "source": "issued", "content_type": "application/pdf", "size_bytes": None,
                      "verified": True, "reference": r.ref_no, "created_at": _iso(r.issued_at or r.updated_at), "shares": shares.get(ref, 0), "can_delete": False})

    labels = J.labels(db)
    adm_docs = (db.query(AdmissionDocumentModel).join(AdmissionModel, AdmissionModel.id == AdmissionDocumentModel.admission_id)
                .filter(AdmissionModel.user_id == uid).all())
    for d in adm_docs:
        ref = f"adm:{d.id}"
        items.append({"ref": ref, "title": labels.get(d.doc_key, "Joining document"), "category": "joining",
                      "category_label": LABELS["joining"], "source": "joining", "content_type": d.content_type, "size_bytes": d.size_bytes,
                      "verified": d.status == "accepted", "created_at": _iso(d.uploaded_at), "shares": shares.get(ref, 0), "can_delete": False})

    items.sort(key=lambda i: i["created_at"] or "", reverse=True)
    return {"items": items, "quota": {"used_bytes": used, "limit_bytes": QUOTA_BYTES, "max_file_bytes": MAX_FILE_BYTES},
            "categories": [{"key": k, "label": v} for k, v in CATEGORIES.items()]}


@router.post("/files", summary="Add a file to my locker (PDF, JPG or PNG, up to 10 MB)")
def add_file(file: UploadFile = File(...), title: str = Form(""), category: str = Form("other"),
             db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    uid = current["sub"]
    if category not in CATEGORIES:
        raise HTTPException(status_code=422, detail="Choose a category")
    own = db.query(func.coalesce(func.sum(LockerFileModel.size_bytes), 0), func.count(LockerFileModel.id)).filter(
        LockerFileModel.user_id == uid, LockerFileModel.source == "self").one()
    if own[1] >= MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Your locker holds up to {MAX_FILES} files; delete some first")
    saved = _save(uid, file)
    if own[0] + saved["size_bytes"] > QUOTA_BYTES:
        _folder(uid).joinpath(saved["stored_name"]).unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Not enough space: your locker holds {QUOTA_BYTES // (1024 * 1024)} MB of your own files")
    row = LockerFileModel(user_id=uid, title=_title(title, file), category=category, source="self",
                          original_name=(file.filename or "")[:120], added_by=uid, **saved)
    db.add(row)
    db.flush()
    _log(db, uid, f"file:{row.id}", row.title, "uploaded")
    db.commit()
    return {"ref": f"file:{row.id}", "title": row.title}


@router.delete("/files/{file_id}", summary="Delete a file I added myself")
def delete_file(file_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    f = db.get(LockerFileModel, file_id)
    if not f or f.user_id != current["sub"]:
        raise HTTPException(status_code=404, detail="File not found")
    if f.source != "self":
        raise HTTPException(status_code=403, detail="The college added this document, so only the Admin Office can remove it")
    ref = f"file:{f.id}"
    now = datetime.utcnow()
    for s in db.query(LockerShareModel).filter(LockerShareModel.item_ref == ref, LockerShareModel.user_id == f.user_id, LockerShareModel.revoked_at.is_(None)):
        s.revoked_at = now
    _file_path(f).unlink(missing_ok=True)
    _log(db, f.user_id, ref, f.title, "deleted")
    db.delete(f)
    db.commit()
    return {"message": "Deleted"}


@router.get("/items/{ref}/file", summary="Open or download one of my documents")
def open_item(ref: str, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    item = _resolve(db, ref, current["sub"])
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    return _send(item)


# ── Share links ──────────────────────────────────────────────────────────────
@router.post("/items/{ref}/share", summary="Make an expiring link to one document")
def create_share(ref: str, body: ShareIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    uid = current["sub"]
    item = _resolve(db, ref, uid)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    now = datetime.utcnow()
    active = db.query(func.count(LockerShareModel.id)).filter(
        LockerShareModel.user_id == uid, LockerShareModel.item_ref == ref, LockerShareModel.revoked_at.is_(None), LockerShareModel.expires_at > now).scalar()
    if active >= MAX_ACTIVE_LINKS:
        raise HTTPException(status_code=400, detail=f"This document already has {MAX_ACTIVE_LINKS} active links; withdraw one first")
    share = LockerShareModel(user_id=uid, item_ref=ref, title=item["title"], token=secrets.token_urlsafe(24),
                             expires_at=now + timedelta(hours=body.hours))
    db.add(share)
    db.flush()
    _log(db, uid, ref, item["title"], "shared", f"link valid for {body.hours} hours" if body.hours < 48 else f"link valid for {body.hours // 24} days")
    db.commit()
    return {"id": share.id, "token": share.token, "path": f"/shared/{share.token}", "expires_at": _iso(share.expires_at)}


@router.get("/shares", summary="My share links (active first)")
def my_shares(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    rows = (db.query(LockerShareModel).filter(LockerShareModel.user_id == current["sub"], LockerShareModel.created_at > now - timedelta(days=60))
            .order_by(LockerShareModel.created_at.desc()).limit(60).all())
    out = []
    for s in rows:
        status = "withdrawn" if s.revoked_at else "expired" if s.expires_at <= now else "active"
        out.append({"id": s.id, "item_ref": s.item_ref, "title": s.title, "status": status, "views": s.views, "path": f"/shared/{s.token}" if status == "active" else None,
                    "expires_at": _iso(s.expires_at), "created_at": _iso(s.created_at)})
    out.sort(key=lambda s: s["status"] != "active")
    return out


@router.delete("/shares/{share_id}", summary="Withdraw a share link now")
def revoke_share(share_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    s = db.get(LockerShareModel, share_id)
    if not s or s.user_id != current["sub"]:
        raise HTTPException(status_code=404, detail="Link not found")
    if not s.revoked_at:
        s.revoked_at = datetime.utcnow()
        _log(db, s.user_id, s.item_ref, s.title, "revoked", "link withdrawn")
        db.commit()
    return {"message": "Link withdrawn"}


@router.get("/activity", summary="Who opened or shared my documents, and when")
def activity(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    rows = (db.query(LockerAccessModel).filter(LockerAccessModel.user_id == current["sub"])
            .order_by(LockerAccessModel.at.desc()).limit(40).all())
    return [{"id": a.id, "title": a.title, "action": a.action, "detail": a.detail, "at": _iso(a.at)} for a in rows]



# ── College documents: what the college website publishes, read for students ─────────────────────────────
def _college_out(d: CollegeDocumentModel) -> dict:
    featured = d.category == "admissions" and bool(re.search(r"documents to be submitted|list of documents", d.title, re.I))
    return {"id": d.id, "title": d.title, "category": d.category, "category_label": scraper.CATEGORIES.get(d.category, "Other"),
            "kind": d.kind, "host": d.host, "page_title": d.page_title, "page_url": d.page_url, "published_on": d.published_on,
            "size_bytes": d.size_bytes, "featured": featured,
            "open_url": d.url if d.kind == "link" else None}   # a stored file opens inside the app; a link opens at its source


@router.get("/college", summary="Documents the college publishes (syllabus, calendar, fees, admissions, exam notices...)")
def college_documents(db: Session = Depends(get_db), _current: dict = Depends(get_current_user)):
    rows = db.query(CollegeDocumentModel).filter(CollegeDocumentModel.active.is_(True)).all()
    order = list(scraper.CATEGORIES)
    items = sorted((_college_out(d) for d in rows),
                   key=lambda i: (not i["featured"], order.index(i["category"]) if i["category"] in order else 99,
                                  "".join(chr(255 - ord(c)) for c in (i["published_on"] or "")), i["title"].lower()))
    counts = {}
    for i in items:
        counts[i["category"]] = counts.get(i["category"], 0) + 1
    last = scraper.last_run()
    return {"items": items, "total": len(items), "stored": sum(1 for i in items if i["kind"] == "file"),
            "categories": [{"key": k, "label": v, "count": counts.get(k, 0)} for k, v in scraper.CATEGORIES.items() if counts.get(k)],
            "updated_at": _iso(last), "running": scraper.is_running(), "source": "https://mvsrec.edu.in"}


@router.get("/college/{doc_id}/file", summary="Open a college document that is kept in the app")
def college_file(doc_id: int, db: Session = Depends(get_db), _current: dict = Depends(get_current_user)):
    d = db.get(CollegeDocumentModel, doc_id)
    if not d or d.kind != "file" or not d.stored_name or "/" in d.stored_name or ".." in d.stored_name:
        raise HTTPException(status_code=404, detail="Document not found")
    path = scraper.COLLEGE_DIR / d.stored_name
    if not path.exists():
        raise HTTPException(status_code=410, detail="The file is no longer available")
    name = re.sub(r"[^A-Za-z0-9 ._\-]", "", d.title)[:80] or "college-document"
    return FileResponse(path, media_type="application/pdf",
                        headers={"Content-Disposition": f'inline; filename="{name}.pdf"', "X-Content-Type-Options": "nosniff"})


@router.post("/college/refresh", summary="Read the college website again (admin)")
def college_refresh(_admin: dict = Depends(require_admin)):
    if scraper.is_running():
        return {"started": False, "message": "A refresh is already running"}
    threading.Thread(target=scraper.refresh, daemon=True, name="college-docs-admin").start()
    return {"started": True, "message": "Reading the college website now. This takes a few minutes."}

# ── Admin Office: add an official document to a student's locker ─────────────
def _student_by_roll(db: Session, roll_no: str):
    roll = (roll_no or "").strip()
    if not roll:
        return None
    prof = db.query(StudentProfileModel).filter(func.lower(StudentProfileModel.roll_no) == roll.lower()).first()
    user = db.get(UserModel, prof.user_id) if prof else None
    return (user, prof) if user else None


@router.get("/office/lookup", summary="Find a student by roll number (Admin Office)")
def office_lookup(roll_no: str, db: Session = Depends(get_db), _office: dict = Depends(office_only)):
    found = _student_by_roll(db, roll_no)
    if not found:
        raise HTTPException(status_code=404, detail="No student with that roll number has a profile in CampusSphere yet")
    user, prof = found
    return {"name": user.name, "roll_no": prof.roll_no, "department": prof.department, "year": prof.year}


@router.post("/office/files", summary="Add an official document to a student's locker (Admin Office)")
def office_add(roll_no: str = Form(...), file: UploadFile = File(...), title: str = Form(""), category: str = Form("certificate"),
               db: Session = Depends(get_db), office: dict = Depends(office_only)):
    found = _student_by_roll(db, roll_no)
    if not found:
        raise HTTPException(status_code=404, detail="No student with that roll number has a profile in CampusSphere yet")
    if category not in CATEGORIES:
        raise HTTPException(status_code=422, detail="Choose a category")
    user, _prof = found
    saved = _save(user.id, file)
    row = LockerFileModel(user_id=user.id, title=_title(title, file), category=category, source="college", verified=True,
                          original_name=(file.filename or "")[:120], added_by=office["sub"], **saved)
    db.add(row)
    db.flush()
    _log(db, user.id, f"file:{row.id}", row.title, "added_by_college", f"added by {office.get('name') or 'the Admin Office'}")
    db.commit()
    return {"ref": f"file:{row.id}", "student": user.name}


# ── Public: open a document through a share link ─────────────────────────────
def _live_share(db: Session, request: Request, token: str) -> LockerShareModel:
    ip = client_ip(request)
    share_limiter.check_and_hit(ip, "Too many requests.")
    s = db.query(LockerShareModel).filter(LockerShareModel.token == token).first() if re.fullmatch(r"[A-Za-z0-9_\-]{20,60}", token or "") else None
    if not s:
        bad_link_limiter.check_and_hit(ip, "Too many links that don't exist.")
        raise HTTPException(status_code=404, detail="This link is not valid")
    if s.revoked_at or s.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=410, detail="This link has expired or was withdrawn by its owner")
    return s


@public_router.get("/shared/{token}", summary="About a shared document (no login)")
def shared_info(token: str, request: Request, db: Session = Depends(get_db)):
    s = _live_share(db, request, token)
    item = _resolve(db, s.item_ref, s.user_id)
    if not item:
        raise HTTPException(status_code=410, detail="This document is no longer available")
    owner = db.get(UserModel, s.user_id)
    return {"title": item["title"], "content_type": item["content_type"], "shared_by": owner.name if owner else "A student",
            "expires_at": _iso(s.expires_at), "college": "MVSR Engineering College"}


@public_router.get("/shared/{token}/file", summary="The shared document itself (no login)")
def shared_file(token: str, request: Request, db: Session = Depends(get_db)):
    s = _live_share(db, request, token)
    item = _resolve(db, s.item_ref, s.user_id)
    if not item:
        raise HTTPException(status_code=410, detail="This document is no longer available")
    response = _send(item)
    s.views = (s.views or 0) + 1
    _log(db, s.user_id, s.item_ref, item["title"], "opened_by_link", f"opened through a link (view {s.views})")
    db.commit()
    return response
