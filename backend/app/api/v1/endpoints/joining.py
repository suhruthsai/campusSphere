# Student Services V2 — joining after TGEAPCET counselling: the student's details and documents,
# Admin Office verification, joining-fee payment, the originals register and enrolment.
import re
import uuid
from datetime import date, datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.security import get_current_user, require_admin, require_roles
from backend.app.db.session import get_db
from backend.app.models.admissions import (
    AdmissionDocumentModel, AdmissionModel, FeeHeadModel, OriginalCertificateModel, PaymentModel,
)
from backend.app.models.campus import UserModel
from backend.app.models.services import StudentProfileModel
from backend.app.student_services import joining as J
from backend.app.student_services.catalog import department_building
from backend.app.student_services.receipts import render_originals_ack, render_payment_receipt
from backend.app.student_services.workflow import academic_year

router = APIRouter()
require_office = require_roles("admin", "staff")
EDITABLE = ("draft", "needs_changes")
APPROVER_ROLES = ("faculty", "admin", "staff")

REQUIRED_FIELDS = {
    "hall_ticket_no": "TGEAPCET hall ticket number", "eapcet_rank": "TGEAPCET rank",
    "allotment_no": "Allotment order number", "branch": "Allotted branch", "category": "Category",
    "tuition_paid_on_portal": "Tuition paid on the portal", "full_name": "Full name",
    "date_of_birth": "Date of birth", "gender": "Gender", "father_name": "Father's name",
    "mother_name": "Mother's name", "phone": "Mobile number", "address": "Address",
    "ssc_board_year": "SSC board & year", "inter_board_year": "Intermediate board & year",
}


# ── Schemas ────────────────────────────────────────────────────────────────────
class DetailsIn(BaseModel):
    hall_ticket_no: Optional[str] = Field(None, max_length=20)
    eapcet_rank: Optional[int] = Field(None, ge=1, le=500000)
    allotment_no: Optional[str] = Field(None, max_length=40)
    counselling_phase: Optional[str] = Field(None, max_length=30)
    branch: Optional[str] = None
    category: Optional[str] = None
    tuition_paid_on_portal: Optional[int] = Field(None, ge=0, le=1000000)
    fee_reimbursement: bool = False
    other_board: bool = False
    full_name: Optional[str] = Field(None, max_length=100)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    father_name: Optional[str] = Field(None, max_length=100)
    mother_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = Field(None, max_length=400)
    ssc_board_year: Optional[str] = Field(None, max_length=60)
    inter_board_year: Optional[str] = Field(None, max_length=60)


class ReviewIn(BaseModel):
    status: Literal["accepted", "rejected"]
    remarks: Optional[str] = Field(None, max_length=300)


class RemarksIn(BaseModel):
    remarks: Optional[str] = Field(None, max_length=500)


class OriginalsIn(BaseModel):
    doc_keys: List[str] = Field(..., min_length=1)


class LendIn(BaseModel):
    due_back: date
    note: Optional[str] = Field(None, max_length=200)


class NoteIn(BaseModel):
    note: Optional[str] = Field(None, max_length=200)


class EnrollIn(BaseModel):
    roll_no: str = Field(..., min_length=4, max_length=30)
    section: str = Field(..., min_length=1, max_length=10)
    mentor_id: Optional[str] = None


class FeeHeadIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    description: Optional[str] = Field(None, max_length=200)
    amount: int = Field(..., ge=0, le=1000000)
    optional: bool = False
    active: bool = True
    sort_order: int = 0


class PaymentIn(BaseModel):
    optional_fee_head_ids: List[int] = Field(default_factory=list)
    bus_boarding_point: Optional[str] = Field(None, max_length=80)


class TestOutcomeIn(BaseModel):
    outcome: Literal["success", "failure"]


# ── Helpers ────────────────────────────────────────────────────────────────────
def _now():
    return datetime.utcnow()


def _iso(dt):
    return dt.isoformat() if dt else None


def _my_admission(db: Session, current: dict, create: bool = False) -> Optional[AdmissionModel]:
    adm = db.query(AdmissionModel).filter(AdmissionModel.user_id == current["sub"]).first()
    if not adm and create:
        user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
        adm = AdmissionModel(user_id=user.id, status="draft", academic_year=academic_year(), full_name=user.name)
        db.add(adm)
        db.commit()
        db.refresh(adm)
    return adm


def _missing_fields(adm: AdmissionModel) -> list[str]:
    return [label for key, label in REQUIRED_FIELDS.items() if getattr(adm, key) in (None, "")]


def _docs(db, adm):
    return db.query(AdmissionDocumentModel).filter(AdmissionDocumentModel.admission_id == adm.id).all()


def _payments(db, user_id):
    return (db.query(PaymentModel).filter(PaymentModel.user_id == user_id, PaymentModel.purpose == "joining_fees")
            .order_by(PaymentModel.created_at.desc()).all())


def _originals(db, user_id):
    return db.query(OriginalCertificateModel).filter(OriginalCertificateModel.user_id == user_id).order_by(OriginalCertificateModel.id).all()


def _doc_out(d: AdmissionDocumentModel) -> dict:
    return {"id": d.id, "doc_key": d.doc_key, "label": J.DOC_LABELS.get(d.doc_key, d.doc_key), "original_name": d.original_name,
            "content_type": d.content_type, "size_bytes": d.size_bytes, "status": d.status, "remarks": d.remarks,
            "reviewed_by": d.reviewed_by, "reviewed_at": _iso(d.reviewed_at), "uploaded_at": _iso(d.uploaded_at)}


def _payment_out(p: PaymentModel) -> dict:
    return {"id": p.id, "items": p.items, "amount": p.amount, "currency": p.currency, "status": p.status,
            "provider": p.provider, "receipt_no": p.receipt_no, "provider_payment_id": p.provider_payment_id,
            "details": p.details or {}, "created_at": _iso(p.created_at), "paid_at": _iso(p.paid_at)}


def _original_out(o: OriginalCertificateModel, names: Optional[dict] = None) -> dict:
    out = {"id": o.id, "doc_key": o.doc_key, "label": o.label, "status": o.status, "due_back": o.due_back.isoformat() if o.due_back else None,
           "movements": o.movements or [], "ack_no": o.ack_no, "user_id": o.user_id,
           "overdue": bool(o.status == "out" and o.due_back and o.due_back < date.today())}
    if names is not None:
        out["student"] = names.get(o.user_id)
    return out


def _progress(adm, payments, originals) -> list[dict]:
    paid = any(p.status == "paid" for p in payments)
    tc_in = any(o.doc_key == "tc" and o.status in ("held", "out") for o in originals)
    submitted = adm.status not in EDITABLE
    steps = [
        ("details", "Joining details", "frontgate", not _missing_fields(adm)),
        ("documents", "Upload documents", "civilit", submitted),
        ("verification", "Office verification", "civilit", adm.status in ("verified", "enrolled")),
        ("fees", "Pay college fees", "Bank & ATM", paid),
        ("originals", "Hand in original TC", "civilit", tc_in),
        ("enrolled", "Enrolment", department_building(adm.branch) if adm.branch else "civilit", adm.status == "enrolled"),
    ]
    return [{"key": k, "label": l, "place": place, "done": bool(done)} for k, l, place, done in steps]


def _admission_out(db: Session, adm: AdmissionModel, with_user: bool = False) -> dict:
    docs = {d.doc_key: d for d in _docs(db, adm)}
    payments = _payments(db, adm.user_id)
    originals = _originals(db, adm.user_id)
    checklist = []
    for d in J.JOINING_DOCS:
        uploaded = docs.get(d["key"])
        if not J.applies(d, adm) and not uploaded:
            continue
        checklist.append({"key": d["key"], "label": d["label"], "hint": d.get("hint"), "images_only": d.get("images_only", False),
                          "required": J.applies(d, adm), "upload": _doc_out(uploaded) if uploaded else None})
    out = {
        "id": adm.id, "user_id": adm.user_id, "status": adm.status, "academic_year": adm.academic_year,
        "details": {k: (getattr(adm, k).isoformat() if isinstance(getattr(adm, k), date) else getattr(adm, k))
                    for k in list(REQUIRED_FIELDS) + ["counselling_phase", "fee_reimbursement", "other_board", "quota"]},
        "missing_fields": _missing_fields(adm),
        "checklist": checklist,
        "payments": [_payment_out(p) for p in payments],
        "paid": any(p.status == "paid" for p in payments),
        "originals": [_original_out(o) for o in originals],
        "office_remarks": adm.office_remarks, "roll_no": adm.roll_no, "section": adm.section,
        "verified_at": _iso(adm.verified_at), "enrolled_at": _iso(adm.enrolled_at), "submitted_at": _iso(adm.submitted_at),
        "progress": _progress(adm, payments, originals),
    }
    if with_user:
        u = db.query(UserModel).filter(UserModel.id == adm.user_id).first()
        out["account"] = {"name": u.name, "email": u.email} if u else None
    return out


def _get_admission(db, admission_id) -> AdmissionModel:
    adm = db.query(AdmissionModel).filter(AdmissionModel.id == admission_id).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Application not found")
    return adm


def _is_office(current) -> bool:
    return current["role"] in ("admin", "staff")


# ── Configuration ──────────────────────────────────────────────────────────────
@router.get("/config", summary="Joining form options, document checklist and fees")
def config(db: Session = Depends(get_db)):
    heads = db.query(FeeHeadModel).filter(FeeHeadModel.active == True).order_by(FeeHeadModel.sort_order, FeeHeadModel.id).all()  # noqa: E712
    return {
        "categories": J.CATEGORIES, "branches": J.BRANCHES, "genders": J.GENDERS,
        "documents": J.JOINING_DOCS, "originals": [{"key": k, "label": J.ORIGINAL_LABELS[k]} for k in J.ORIGINAL_KEYS],
        "fee_heads": [{"id": h.id, "name": h.name, "description": h.description, "amount": h.amount, "optional": h.optional} for h in heads],
        "payment_mode": settings.PAYMENT_MODE, "academic_year": academic_year(),
    }


# ── Student: application ───────────────────────────────────────────────────────
@router.get("/me", summary="My joining application (null if not started)")
def my_application(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    adm = _my_admission(db, current)
    return _admission_out(db, adm) if adm else None


@router.post("/me/start", summary="Start my joining application")
def start(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if current["role"] != "student":
        raise HTTPException(status_code=403, detail="Only student accounts can join")
    return _admission_out(db, _my_admission(db, current, create=True))


@router.put("/me", summary="Save my joining details")
def save_details(body: DetailsIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    adm = _my_admission(db, current)
    if not adm:
        raise HTTPException(status_code=404, detail="Start your application first")
    if adm.status not in EDITABLE:
        raise HTTPException(status_code=400, detail="Your application is with the office and can't be edited now")
    data = body.model_dump()
    if data["branch"] and data["branch"] not in J.BRANCHES:
        raise HTTPException(status_code=422, detail="Choose your allotted branch from the list")
    if data["category"] and data["category"] not in J.CATEGORIES:
        raise HTTPException(status_code=422, detail="Choose your category from the list")
    if data["gender"] and data["gender"] not in J.GENDERS:
        raise HTTPException(status_code=422, detail="Choose a gender from the list")
    if data["phone"]:
        digits = re.sub(r"\D", "", data["phone"])[-10:]
        if not re.fullmatch(r"[6-9]\d{9}", digits):
            raise HTTPException(status_code=422, detail="Enter a valid 10-digit Indian mobile number")
        data["phone"] = digits
    if data["date_of_birth"] and not (date(1990, 1, 1) <= data["date_of_birth"] <= date.today()):
        raise HTTPException(status_code=422, detail="Check your date of birth")
    for key, value in data.items():
        setattr(adm, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(adm)
    return _admission_out(db, adm)


@router.post("/me/documents/{doc_key}", summary="Upload one joining document (PDF/JPG/PNG, max 5 MB)")
def upload_document(doc_key: str, file: UploadFile = File(...), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    adm = _my_admission(db, current)
    if not adm:
        raise HTTPException(status_code=404, detail="Start your application first")
    if adm.status not in EDITABLE:
        raise HTTPException(status_code=400, detail="Your application is with the office and can't be edited now")
    spec = next((d for d in J.JOINING_DOCS if d["key"] == doc_key), None)
    if not spec:
        raise HTTPException(status_code=404, detail="Unknown document")
    existing = db.query(AdmissionDocumentModel).filter(
        AdmissionDocumentModel.admission_id == adm.id, AdmissionDocumentModel.doc_key == doc_key).first()
    if existing and existing.status == "accepted":
        raise HTTPException(status_code=400, detail="The office has already accepted this document")
    try:
        saved = J.save_document(adm.id, file, images_only=spec.get("images_only", False))
    except J.UploadError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if existing:
        J.delete_document_file(adm.id, existing.stored_name)
        db.delete(existing)
        db.flush()
    doc = AdmissionDocumentModel(admission_id=adm.id, doc_key=doc_key, original_name=(file.filename or "")[:120], **saved)
    db.add(doc)
    db.commit()
    return _admission_out(db, adm)


@router.delete("/me/documents/{doc_key}", summary="Remove an uploaded document")
def delete_document(doc_key: str, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    adm = _my_admission(db, current)
    if not adm or adm.status not in EDITABLE:
        raise HTTPException(status_code=400, detail="Documents can't be changed now")
    doc = db.query(AdmissionDocumentModel).filter(
        AdmissionDocumentModel.admission_id == adm.id, AdmissionDocumentModel.doc_key == doc_key).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Not uploaded")
    if doc.status == "accepted":
        raise HTTPException(status_code=400, detail="The office has already accepted this document")
    J.delete_document_file(adm.id, doc.stored_name)
    db.delete(doc)
    db.commit()
    return _admission_out(db, adm)


@router.post("/me/submit", summary="Send my application to the Admin Office")
def submit(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    adm = _my_admission(db, current)
    if not adm or adm.status not in EDITABLE:
        raise HTTPException(status_code=400, detail="Nothing to submit")
    missing = _missing_fields(adm)
    if missing:
        raise HTTPException(status_code=422, detail="Please fill in: " + ", ".join(missing))
    docs = {d.doc_key: d for d in _docs(db, adm)}
    absent = [d["label"] for d in J.required_docs(adm) if d["key"] not in docs]
    if absent:
        raise HTTPException(status_code=422, detail="Please upload: " + ", ".join(absent))
    still_rejected = [J.DOC_LABELS[k] for k, d in docs.items() if d.status == "rejected"]
    if still_rejected:
        raise HTTPException(status_code=422, detail="Upload a new copy of: " + ", ".join(still_rejected))
    adm.status = "submitted"
    adm.submitted_at = _now()
    db.commit()
    db.refresh(adm)
    return _admission_out(db, adm)


@router.get("/documents/{doc_id}/file", summary="View an uploaded document (its student or the office)")
def document_file(doc_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    doc = db.query(AdmissionDocumentModel).filter(AdmissionDocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    adm = _get_admission(db, doc.admission_id)
    if adm.user_id != current["sub"] and not _is_office(current):
        raise HTTPException(status_code=403, detail="Not allowed")
    path = J.document_path(adm.id, doc.stored_name)
    if not path.exists():
        raise HTTPException(status_code=410, detail="The file is no longer available")
    return FileResponse(path, media_type=doc.content_type,
                        headers={"Content-Disposition": "inline", "Cache-Control": "private, no-store"})


# ── Student: fees ──────────────────────────────────────────────────────────────
@router.post("/me/payments", summary="Start paying my joining fees")
def create_payment(body: PaymentIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    adm = _my_admission(db, current)
    if not adm or adm.status in EDITABLE:
        raise HTTPException(status_code=400, detail="Submit your application before paying fees")
    if any(p.status == "paid" for p in _payments(db, adm.user_id)):
        raise HTTPException(status_code=409, detail="Your joining fees are already paid")
    if settings.PAYMENT_MODE != "test":
        raise HTTPException(status_code=501, detail="Online payment isn't configured yet")
    heads = db.query(FeeHeadModel).filter(FeeHeadModel.active == True).all()  # noqa: E712
    chosen = set(body.optional_fee_head_ids)
    unknown = chosen - {h.id for h in heads if h.optional}
    if unknown:
        raise HTTPException(status_code=422, detail="Choose optional fees from the list")
    items = [{"fee_head_id": h.id, "name": h.name, "amount": h.amount}
             for h in sorted(heads, key=lambda h: (h.sort_order, h.id)) if not h.optional or h.id in chosen]
    total = sum(i["amount"] for i in items)
    if total <= 0:
        raise HTTPException(status_code=400, detail="No joining fees are set up yet. Please contact the Admin Office.")
    pay = PaymentModel(user_id=adm.user_id, admission_id=adm.id, items=items, amount=total, status="created",
                       provider="test", provider_order_id=f"test_order_{uuid.uuid4().hex[:12]}",
                       details={"bus_boarding_point": (body.bus_boarding_point or "").strip()} if body.bus_boarding_point else {})
    db.add(pay)
    db.commit()
    db.refresh(pay)
    return _payment_out(pay)


@router.post("/me/payments/{payment_id}/test-complete", summary="Finish a TEST-MODE payment (no real money)")
def complete_test_payment(payment_id: int, body: TestOutcomeIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if settings.PAYMENT_MODE != "test":
        raise HTTPException(status_code=403, detail="Test payments are disabled")
    pay = db.query(PaymentModel).filter(PaymentModel.id == payment_id, PaymentModel.user_id == current["sub"]).first()
    if not pay or pay.provider != "test":
        raise HTTPException(status_code=404, detail="Payment not found")
    if pay.status != "created":
        raise HTTPException(status_code=400, detail="This payment is already finished")
    if body.outcome == "failure":
        pay.status = "failed"
    else:
        if any(p.status == "paid" for p in _payments(db, pay.user_id)):
            raise HTTPException(status_code=409, detail="Your joining fees are already paid")
        pay.status = "paid"
        pay.paid_at = _now()
        pay.provider_payment_id = f"test_pay_{uuid.uuid4().hex[:12]}"
        pay.receipt_no = f"MVSR/RCPT/{pay.paid_at.year}/{pay.id:05d}"
    db.commit()
    db.refresh(pay)
    return _payment_out(pay)


@router.get("/payments/{payment_id}/receipt", summary="Fee receipt PDF")
def payment_receipt(payment_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    pay = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
    if not pay or (pay.user_id != current["sub"] and not _is_office(current)):
        raise HTTPException(status_code=404, detail="Receipt not found")
    if pay.status != "paid":
        raise HTTPException(status_code=400, detail="This payment isn't complete")
    user = db.query(UserModel).filter(UserModel.id == pay.user_id).first()
    adm = db.query(AdmissionModel).filter(AdmissionModel.user_id == pay.user_id).first()
    return Response(render_payment_receipt(pay, user, adm), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{pay.receipt_no.replace("/", "-")}.pdf"'})


@router.get("/acknowledgement", summary="Acknowledgement slip for original certificates received")
def originals_ack(ack_no: str = Query(...), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    rows = db.query(OriginalCertificateModel).filter(OriginalCertificateModel.ack_no == ack_no).order_by(OriginalCertificateModel.id).all()
    if not rows or (rows[0].user_id != current["sub"] and not _is_office(current)):
        raise HTTPException(status_code=404, detail="Acknowledgement not found")
    user = db.query(UserModel).filter(UserModel.id == rows[0].user_id).first()
    adm = db.query(AdmissionModel).filter(AdmissionModel.user_id == rows[0].user_id).first()
    first = (rows[0].movements or [{}])[0]
    received_at = datetime.fromisoformat(first["at"]) if first.get("at") else rows[0].created_at
    pdf = render_originals_ack(ack_no, rows, user, adm, first.get("by", "Admin Office"), received_at)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{ack_no.replace("/", "-")}.pdf"'})


# ── Office: applications ───────────────────────────────────────────────────────
@router.get("/office/applications", summary="Joining applications (Admin Office)")
def office_list(status: Optional[str] = Query(None), db: Session = Depends(get_db), _office: dict = Depends(require_office)):
    q = db.query(AdmissionModel)
    if status:
        q = q.filter(AdmissionModel.status == status)
    rows = q.order_by(AdmissionModel.submitted_at.desc().nullslast(), AdmissionModel.created_at.desc()).limit(500).all()
    out = []
    for adm in rows:
        docs = _docs(db, adm)
        payments = _payments(db, adm.user_id)
        originals = _originals(db, adm.user_id)
        out.append({
            "id": adm.id, "status": adm.status, "full_name": adm.full_name, "branch": adm.branch,
            "eapcet_rank": adm.eapcet_rank, "category": adm.category, "submitted_at": _iso(adm.submitted_at),
            "docs": {s: sum(1 for d in docs if d.status == s) for s in ("pending", "accepted", "rejected")},
            "paid": any(p.status == "paid" for p in payments),
            "tc_in": any(o.doc_key == "tc" and o.status in ("held", "out") for o in originals),
            "roll_no": adm.roll_no,
        })
    return out


@router.get("/office/applications/{admission_id}", summary="One application with its documents")
def office_get(admission_id: int, db: Session = Depends(get_db), _office: dict = Depends(require_office)):
    return _admission_out(db, _get_admission(db, admission_id), with_user=True)


@router.post("/office/documents/{doc_id}/review", summary="Accept or reject one document")
def review_document(doc_id: int, body: ReviewIn, db: Session = Depends(get_db), office: dict = Depends(require_office)):
    doc = db.query(AdmissionDocumentModel).filter(AdmissionDocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    adm = _get_admission(db, doc.admission_id)
    if adm.status != "submitted":
        raise HTTPException(status_code=400, detail="Documents can be reviewed while the application is submitted")
    if body.status == "rejected" and len((body.remarks or "").strip()) < 5:
        raise HTTPException(status_code=422, detail="Tell the student what's wrong (at least 5 characters)")
    doc.status = body.status
    doc.remarks = (body.remarks or "").strip() or None
    doc.reviewed_by = office["name"]
    doc.reviewed_at = _now()
    db.commit()
    return _admission_out(db, adm, with_user=True)


@router.post("/office/applications/{admission_id}/verify", summary="Mark documents verified")
def verify(admission_id: int, db: Session = Depends(get_db), office: dict = Depends(require_office)):
    adm = _get_admission(db, admission_id)
    if adm.status != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted applications can be verified")
    docs = {d.doc_key: d for d in _docs(db, adm)}
    not_ok = [d["label"] for d in J.required_docs(adm) if docs.get(d["key"]) is None or docs[d["key"]].status != "accepted"]
    if not_ok:
        raise HTTPException(status_code=422, detail="Accept every required document first: " + ", ".join(not_ok))
    adm.status = "verified"
    adm.verified_by = office["name"]
    adm.verified_at = _now()
    db.commit()
    return _admission_out(db, adm, with_user=True)


@router.post("/office/applications/{admission_id}/return", summary="Send back to the student for changes")
def return_to_student(admission_id: int, body: RemarksIn, db: Session = Depends(get_db), _office: dict = Depends(require_office)):
    adm = _get_admission(db, admission_id)
    if adm.status != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted applications can be sent back")
    rejected = [d for d in _docs(db, adm) if d.status == "rejected"]
    if not rejected and len((body.remarks or "").strip()) < 5:
        raise HTTPException(status_code=422, detail="Reject a document or write what needs to change")
    adm.status = "needs_changes"
    adm.office_remarks = (body.remarks or "").strip() or None
    db.commit()
    return _admission_out(db, adm, with_user=True)


@router.post("/office/applications/{admission_id}/originals", summary="Record original certificates received")
def receive_originals(admission_id: int, body: OriginalsIn, db: Session = Depends(get_db), office: dict = Depends(require_office)):
    adm = _get_admission(db, admission_id)
    if adm.status in EDITABLE:
        raise HTTPException(status_code=400, detail="The student must submit the application first")
    keys = list(dict.fromkeys(body.doc_keys))
    bad = [k for k in keys if k not in J.ORIGINAL_KEYS]
    if bad:
        raise HTTPException(status_code=422, detail="Unknown certificate: " + ", ".join(bad))
    held = {o.doc_key for o in _originals(db, adm.user_id) if o.status in ("held", "out")}
    new_keys = [k for k in keys if k not in held]
    if not new_keys:
        raise HTTPException(status_code=409, detail="These originals are already with the college")
    now = _now()
    rows = []
    for k in new_keys:
        r = OriginalCertificateModel(user_id=adm.user_id, admission_id=adm.id, doc_key=k, label=J.ORIGINAL_LABELS[k],
                                     status="held", movements=[{"action": "received", "at": now.isoformat(), "by": office["name"], "note": None}])
        db.add(r)
        rows.append(r)
    db.flush()
    ack = f"MVSR/ACK/{now.year}/{min(r.id for r in rows):05d}"
    for r in rows:
        r.ack_no = ack
    db.commit()
    return {"ack_no": ack, "application": _admission_out(db, adm, with_user=True)}


@router.post("/office/applications/{admission_id}/enroll", summary="Enrol the student (roll no., section, mentor)")
def enroll(admission_id: int, body: EnrollIn, db: Session = Depends(get_db), office: dict = Depends(require_office)):
    adm = _get_admission(db, admission_id)
    if adm.status != "verified":
        raise HTTPException(status_code=400, detail="Verify the documents first")
    if not any(p.status == "paid" for p in _payments(db, adm.user_id)):
        raise HTTPException(status_code=400, detail="Joining fees aren't paid yet")
    if not any(o.doc_key == "tc" and o.status in ("held", "out") for o in _originals(db, adm.user_id)):
        raise HTTPException(status_code=400, detail="Record the original TC first")
    roll = body.roll_no.strip().upper()
    clash = db.query(UserModel).filter(UserModel.roll_no == roll, UserModel.id != adm.user_id).first() or \
        db.query(StudentProfileModel).filter(StudentProfileModel.roll_no == roll, StudentProfileModel.user_id != adm.user_id).first()
    if clash:
        raise HTTPException(status_code=409, detail="This roll number already belongs to another student")
    if body.mentor_id:
        mentor = db.query(UserModel).filter(UserModel.id == body.mentor_id).first()
        if not mentor or mentor.role not in APPROVER_ROLES:
            raise HTTPException(status_code=400, detail="Mentors must be faculty, staff or admin accounts")

    user = db.query(UserModel).filter(UserModel.id == adm.user_id).first()
    user.roll_no = roll
    user.department = adm.branch
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == user.id).first()
    if not profile:
        profile = StudentProfileModel(user_id=user.id, department=adm.branch)
        db.add(profile)
    profile.department = adm.branch
    profile.program = "B.E."
    profile.roll_no = roll
    profile.year = 1
    profile.section = body.section.strip().upper()
    profile.parent_name = adm.father_name
    profile.gender = adm.gender
    profile.mentor_id = body.mentor_id or profile.mentor_id

    adm.status = "enrolled"
    adm.roll_no = roll
    adm.section = profile.section
    adm.enrolled_by = office["name"]
    adm.enrolled_at = _now()
    db.commit()
    return _admission_out(db, adm, with_user=True)


@router.get("/office/mentors", summary="Faculty who can be assigned as mentors at enrolment")
def mentor_options(db: Session = Depends(get_db), _office: dict = Depends(require_office)):
    rows = (db.query(UserModel).filter(UserModel.role == "faculty", UserModel.status == "active")
            .order_by(UserModel.department, UserModel.name).all())
    return [{"id": u.id, "name": u.name, "department": u.department} for u in rows]


# ── Office: originals register ─────────────────────────────────────────────────
@router.get("/office/originals", summary="Original certificates held by the college")
def originals_register(status: Optional[str] = Query(None), q: Optional[str] = Query(None),
                       db: Session = Depends(get_db), _office: dict = Depends(require_office)):
    query = db.query(OriginalCertificateModel)
    if status:
        query = query.filter(OriginalCertificateModel.status == status)
    rows = query.order_by(OriginalCertificateModel.updated_at.desc()).limit(1000).all()
    users = {u.id: u for u in db.query(UserModel).filter(UserModel.id.in_({r.user_id for r in rows})).all()}
    names = {uid: {"name": u.name, "email": u.email, "roll_no": u.roll_no} for uid, u in users.items()}
    out = [_original_out(r, names) for r in rows]
    if q:
        needle = q.strip().lower()
        out = [r for r in out if needle in " ".join(str(v or "") for v in (r["student"] or {}).values()).lower()
               or needle in (r["ack_no"] or "").lower()]
    return out


def _movement(rec: OriginalCertificateModel, action: str, office: dict, note: Optional[str], due_back=None):
    rec.movements = [*(rec.movements or []), {"action": action, "at": _now().isoformat(), "by": office["name"],
                                              "note": (note or "").strip() or None,
                                              "due_back": due_back.isoformat() if due_back else None}]


def _get_original(db, rec_id) -> OriginalCertificateModel:
    rec = db.query(OriginalCertificateModel).filter(OriginalCertificateModel.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    return rec


@router.post("/office/originals/{rec_id}/lend", summary="Hand an original back temporarily")
def lend_original(rec_id: int, body: LendIn, db: Session = Depends(get_db), office: dict = Depends(require_office)):
    rec = _get_original(db, rec_id)
    if rec.status != "held":
        raise HTTPException(status_code=400, detail="Only originals held by the college can be lent")
    if body.due_back < date.today():
        raise HTTPException(status_code=422, detail="The return date can't be in the past")
    rec.status = "out"
    rec.due_back = body.due_back
    _movement(rec, "lent", office, body.note, body.due_back)
    db.commit()
    return _original_out(rec)


@router.post("/office/originals/{rec_id}/redeposit", summary="Original brought back after a temporary return")
def redeposit_original(rec_id: int, body: NoteIn, db: Session = Depends(get_db), office: dict = Depends(require_office)):
    rec = _get_original(db, rec_id)
    if rec.status != "out":
        raise HTTPException(status_code=400, detail="This original isn't out")
    rec.status = "held"
    rec.due_back = None
    _movement(rec, "redeposited", office, body.note)
    db.commit()
    return _original_out(rec)


@router.post("/office/originals/{rec_id}/return", summary="Return an original for good")
def return_original(rec_id: int, body: NoteIn, db: Session = Depends(get_db), office: dict = Depends(require_office)):
    rec = _get_original(db, rec_id)
    if rec.status == "returned":
        raise HTTPException(status_code=400, detail="Already returned")
    rec.status = "returned"
    rec.due_back = None
    _movement(rec, "returned", office, body.note)
    db.commit()
    return _original_out(rec)


# ── Admin: fee heads ───────────────────────────────────────────────────────────
@router.get("/admin/fee-heads", summary="All joining fee heads")
def list_fee_heads(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    rows = db.query(FeeHeadModel).order_by(FeeHeadModel.sort_order, FeeHeadModel.id).all()
    return [{"id": h.id, "name": h.name, "description": h.description, "amount": h.amount, "optional": h.optional,
             "active": h.active, "sort_order": h.sort_order} for h in rows]


@router.post("/admin/fee-heads", summary="Add a fee head")
def create_fee_head(body: FeeHeadIn, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    head = FeeHeadModel(**body.model_dump())
    db.add(head)
    db.commit()
    return {"id": head.id}


@router.put("/admin/fee-heads/{head_id}", summary="Edit a fee head")
def update_fee_head(head_id: int, body: FeeHeadIn, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    head = db.query(FeeHeadModel).filter(FeeHeadModel.id == head_id).first()
    if not head:
        raise HTTPException(status_code=404, detail="Fee head not found")
    for k, v in body.model_dump().items():
        setattr(head, k, v)
    db.commit()
    return {"id": head.id}
