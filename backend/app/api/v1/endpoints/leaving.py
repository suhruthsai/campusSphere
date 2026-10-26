# Student Services V3 — leaving the college: online no-dues clearance across units, paying dues
# online, the No-Dues Certificate, clearance officers, and leaving-document fees.
from datetime import date, datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.security import get_current_user, require_admin
from backend.app.db.session import get_db
from backend.app.models.admissions import AdmissionModel, OriginalCertificateModel, PaymentModel
from backend.app.models.campus import UserModel
from backend.app.models.leaving import ClearanceItemModel, ClearanceOfficerModel, DocumentFeeModel, ExitModel
from backend.app.models.services import StudentProfileModel
from backend.app.student_services import payments as P
from backend.app.student_services.catalog import (
    CLEARANCE_UNITS, COURSE_COMPLETED, DOC_TYPES, EXIT_REASONS, UNIT_LABELS, unit_place,
)
from backend.app.student_services.receipts import render_no_dues_certificate, render_payment_receipt

router = APIRouter()
UNIT_KEYS = [u["key"] for u in CLEARANCE_UNITS]
OFFICER_ROLES = ("faculty", "staff", "admin")


class StartIn(BaseModel):
    reason: str
    leaving_date: date


class ClearIn(BaseModel):
    remarks: Optional[str] = Field(None, max_length=300)


class DuesIn(BaseModel):
    amount: int = Field(..., ge=1, le=500000)
    remarks: str = Field(..., min_length=5, max_length=300)


class OfficerIn(BaseModel):
    unit: str
    user_id: str
    department: Optional[str] = Field(None, max_length=30)


class FeeIn(BaseModel):
    amount: int = Field(..., ge=0, le=100000)


class OutcomeIn(BaseModel):
    outcome: Literal["success", "failure"]


def _iso(dt):
    return dt.isoformat() if dt else None


def _items(db, exit_rec):
    rows = db.query(ClearanceItemModel).filter(ClearanceItemModel.exit_id == exit_rec.id).all()
    order = {k: i for i, k in enumerate(UNIT_KEYS)}
    return sorted(rows, key=lambda r: order.get(r.unit, 99))


def _item_out(it: ClearanceItemModel, department: Optional[str]) -> dict:
    return {"id": it.id, "unit": it.unit, "label": UNIT_LABELS.get(it.unit, it.unit), "place": unit_place(it.unit, department),
            "status": it.status, "dues_amount": it.dues_amount, "remarks": it.remarks, "acted_by": it.acted_by,
            "acted_at": _iso(it.acted_at), "payment_id": it.payment_id}


def _exit_out(db, exit_rec: ExitModel) -> dict:
    items = _items(db, exit_rec)
    open_payments = {p.details.get("clearance_item_id"): p for p in db.query(PaymentModel).filter(
        PaymentModel.user_id == exit_rec.user_id, PaymentModel.purpose == "no_dues").all()}
    out_items = []
    for it in items:
        d = _item_out(it, exit_rec.department)
        pay = open_payments.get(it.id)
        d["receipt"] = {"id": pay.id, "receipt_no": pay.receipt_no} if pay and pay.status == "paid" else None
        out_items.append(d)
    originals = db.query(OriginalCertificateModel).filter(OriginalCertificateModel.user_id == exit_rec.user_id).all()
    return {
        "id": exit_rec.id, "status": exit_rec.status, "reason": exit_rec.reason,
        "leaving_date": exit_rec.leaving_date.isoformat(), "department": exit_rec.department,
        "cleared_at": _iso(exit_rec.cleared_at), "created_at": _iso(exit_rec.created_at),
        "items": out_items,
        "counts": {s: sum(1 for i in items if i.status == s) for s in ("pending", "dues", "cleared")},
        "originals": [{"id": o.id, "label": o.label, "status": o.status, "due_back": o.due_back.isoformat() if o.due_back else None}
                      for o in originals],
    }


def _my_exit(db, current) -> Optional[ExitModel]:
    return db.query(ExitModel).filter(ExitModel.user_id == current["sub"]).first()


# ── Student ────────────────────────────────────────────────────────────────────
@router.get("/config", summary="Exit reasons and clearance units")
def config():
    return {"reasons": EXIT_REASONS, "units": [{"key": u["key"], "label": u["label"]} for u in CLEARANCE_UNITS],
            "payment_mode": settings.PAYMENT_MODE}


@router.get("/me", summary="My exit and no-dues clearance (null if not started)")
def my_exit(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    exit_rec = _my_exit(db, current)
    return _exit_out(db, exit_rec) if exit_rec else None


@router.post("/me/start", summary="Start my exit and no-dues clearance")
def start_exit(body: StartIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if current["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can start an exit")
    if body.reason not in EXIT_REASONS:
        raise HTTPException(status_code=422, detail="Choose a reason from the list")
    if not (date(2000, 1, 1) <= body.leaving_date <= date.today() + timedelta(days=366)):
        raise HTTPException(status_code=422, detail="Check the leaving date")
    if _my_exit(db, current):
        raise HTTPException(status_code=409, detail="Your exit has already been started")
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
    if not profile or not (profile.year and profile.section and profile.parent_name and profile.gender):
        raise HTTPException(status_code=400, detail="Please complete your academic profile first (Services page)")
    if body.reason == COURSE_COMPLETED and profile.year != 4:
        raise HTTPException(status_code=400, detail="'Course completed' is only for IV year students. Choose another reason, or ask the Admin Office to correct your year.")
    exit_rec = ExitModel(user_id=current["sub"], reason=body.reason, leaving_date=body.leaving_date,
                         status="in_progress", department=profile.department)
    db.add(exit_rec)
    db.flush()
    for unit in UNIT_KEYS:
        db.add(ClearanceItemModel(exit_id=exit_rec.id, unit=unit, status="pending"))
    db.commit()
    db.refresh(exit_rec)
    return _exit_out(db, exit_rec)


@router.post("/me/items/{item_id}/pay", summary="Start paying the dues recorded by a unit")
def pay_dues(item_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    exit_rec = _my_exit(db, current)
    item = db.query(ClearanceItemModel).filter(ClearanceItemModel.id == item_id).first()
    if not exit_rec or not item or item.exit_id != exit_rec.id:
        raise HTTPException(status_code=404, detail="Not found")
    if item.status != "dues" or not item.dues_amount:
        raise HTTPException(status_code=400, detail="There are no dues to pay here")
    if settings.PAYMENT_MODE != "test":
        raise HTTPException(status_code=501, detail="Online payment isn't configured yet")
    pay = P.new_payment(db, current["sub"], "no_dues",
                        [{"fee_head_id": None, "name": f"Dues · {UNIT_LABELS[item.unit]}", "amount": item.dues_amount}],
                        {"clearance_item_id": item.id})
    db.commit()
    return {"id": pay.id, "items": pay.items, "amount": pay.amount, "status": pay.status, "provider": pay.provider}


@router.post("/payments/{payment_id}/test-complete", summary="Finish a TEST-MODE payment for dues or a document fee")
def complete_test_payment(payment_id: int, body: OutcomeIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if settings.PAYMENT_MODE != "test":
        raise HTTPException(status_code=403, detail="Test payments are disabled")
    pay = db.query(PaymentModel).filter(PaymentModel.id == payment_id, PaymentModel.user_id == current["sub"]).first()
    if not pay or pay.purpose not in ("no_dues", "document"):
        raise HTTPException(status_code=404, detail="Payment not found")
    if pay.status == "paid":
        raise HTTPException(status_code=400, detail="Already paid")
    if pay.status == "failed":
        pay.status = "created"   # a failed attempt can be retried with the same order
    P.finish(db, pay, body.outcome == "success")
    db.commit()
    return {"id": pay.id, "status": pay.status, "receipt_no": pay.receipt_no, "amount": pay.amount, "items": pay.items}


@router.get("/payments/{payment_id}/receipt", summary="Receipt for dues or a document fee")
def payment_receipt(payment_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    pay = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
    if not pay or (pay.user_id != current["sub"] and current["role"] not in ("admin", "staff")):
        raise HTTPException(status_code=404, detail="Receipt not found")
    if pay.status != "paid":
        raise HTTPException(status_code=400, detail="This payment isn't complete")
    user = db.query(UserModel).filter(UserModel.id == pay.user_id).first()
    adm = db.query(AdmissionModel).filter(AdmissionModel.user_id == pay.user_id).first()
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == pay.user_id).first()
    return Response(render_payment_receipt(pay, user, adm, profile), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{pay.receipt_no.replace("/", "-")}.pdf"'})


@router.get("/me/no-dues-certificate", summary="No-Dues Certificate (after every unit has cleared)")
def no_dues_certificate(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    exit_rec = _my_exit(db, current)
    if not exit_rec or exit_rec.status != "cleared":
        raise HTTPException(status_code=400, detail="Your clearance isn't complete yet")
    user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
    pdf = render_no_dues_certificate(exit_rec, _items(db, exit_rec), user, profile, UNIT_LABELS)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="MVSR-NDC-{exit_rec.id:05d}.pdf"'})


# ── Clearance officers ─────────────────────────────────────────────────────────
def _my_units(db, current) -> list[tuple[str, Optional[str]]]:
    rows = db.query(ClearanceOfficerModel).filter(ClearanceOfficerModel.user_id == current["sub"]).all()
    return [(r.unit, r.department) for r in rows]


def _may_act(db, current, item: ClearanceItemModel, exit_rec: ExitModel) -> bool:
    if current["role"] == "admin":
        return True
    for unit, dept in _my_units(db, current):
        if unit == item.unit and (unit != "department" or (dept or "").upper() == (exit_rec.department or "").upper()):
            return True
    return False


@router.get("/clearance/queue", summary="No-dues items for the units I clear")
def clearance_queue(status: Optional[str] = Query("pending"), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if current["role"] not in OFFICER_ROLES:
        raise HTTPException(status_code=403, detail="Clearance officers only")
    units = _my_units(db, current)
    if not units and current["role"] != "admin":
        return {"units": [], "items": []}
    q = db.query(ClearanceItemModel, ExitModel).join(ExitModel, ExitModel.id == ClearanceItemModel.exit_id)
    if status:
        q = q.filter(ClearanceItemModel.status == status)
    rows = q.order_by(ExitModel.created_at).limit(500).all()
    ids = {e.user_id for _, e in rows}
    users = {u.id: u for u in db.query(UserModel).filter(UserModel.id.in_(ids)).all()}
    rolls = {p.user_id: p.roll_no for p in db.query(StudentProfileModel).filter(StudentProfileModel.user_id.in_(ids)).all()}
    out = []
    for it, ex in rows:
        if not _may_act(db, current, it, ex):
            continue
        u = users.get(ex.user_id)
        d = _item_out(it, ex.department)
        roll = rolls.get(ex.user_id) or (u.roll_no if u else None)
        d.update({"student": {"name": u.name if u else "?", "roll_no": roll, "email": u.email if u else None},
                  "department": ex.department, "reason": ex.reason, "leaving_date": ex.leaving_date.isoformat()})
        out.append(d)
    labels = [f"{UNIT_LABELS[u]}{' · ' + d if d else ''}" for u, d in units] if units else ["All units (admin)"]
    return {"units": labels, "items": out}


def _get_item(db, item_id):
    item = db.query(ClearanceItemModel).filter(ClearanceItemModel.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item, db.query(ExitModel).filter(ExitModel.id == item.exit_id).first()


@router.post("/clearance/items/{item_id}/clear", summary="Clear a student (no dues, or dues settled at the counter)")
def clear_item(item_id: int, body: ClearIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    item, exit_rec = _get_item(db, item_id)
    if not _may_act(db, current, item, exit_rec):
        raise HTTPException(status_code=403, detail="You don't clear this unit")
    if item.status == "cleared":
        raise HTTPException(status_code=400, detail="Already cleared")
    if item.status == "dues" and len((body.remarks or "").strip()) < 5:
        raise HTTPException(status_code=422, detail="Note how the dues were settled (e.g. receipt no.)")
    note = (body.remarks or "").strip()
    if item.status == "dues":
        # Keep what was owed alongside how it was settled
        item.remarks = f"{item.remarks} · Settled at counter: {note}"
    else:
        item.remarks = note or item.remarks
    item.status = "cleared"
    item.acted_by = current["name"]
    item.acted_at = datetime.utcnow()
    P.refresh_exit(db, exit_rec)
    db.commit()
    return _item_out(item, exit_rec.department) | {"exit_status": exit_rec.status}


@router.post("/clearance/items/{item_id}/dues", summary="Record dues the student must clear")
def record_dues(item_id: int, body: DuesIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    item, exit_rec = _get_item(db, item_id)
    if not _may_act(db, current, item, exit_rec):
        raise HTTPException(status_code=403, detail="You don't clear this unit")
    if item.status == "cleared":
        raise HTTPException(status_code=400, detail="Already cleared")
    item.status = "dues"
    item.dues_amount = body.amount
    item.remarks = body.remarks.strip()
    item.acted_by = current["name"]
    item.acted_at = datetime.utcnow()
    db.commit()
    return _item_out(item, exit_rec.department)


# ── Admin ──────────────────────────────────────────────────────────────────────
@router.get("/admin/officers", summary="Clearance officers")
def list_officers(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    rows = db.query(ClearanceOfficerModel).order_by(ClearanceOfficerModel.unit, ClearanceOfficerModel.department).all()
    names = {u.id: u.name for u in db.query(UserModel).filter(UserModel.id.in_([r.user_id for r in rows])).all()}
    return [{"id": r.id, "unit": r.unit, "unit_label": UNIT_LABELS.get(r.unit, r.unit), "department": r.department,
             "user_id": r.user_id, "user_name": names.get(r.user_id)} for r in rows]


@router.post("/admin/officers", summary="Assign a clearance officer")
def add_officer(body: OfficerIn, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    if body.unit not in UNIT_KEYS:
        raise HTTPException(status_code=422, detail="Unknown unit")
    user = db.query(UserModel).filter(UserModel.id == body.user_id).first()
    if not user or user.role not in OFFICER_ROLES:
        raise HTTPException(status_code=400, detail="Officers must be faculty, staff or admin accounts")
    dept = (body.department or "").strip().upper() or None
    if body.unit == "department" and not dept:
        raise HTTPException(status_code=422, detail="Choose the department")
    if body.unit != "department":
        dept = None
    db.query(ClearanceOfficerModel).filter(ClearanceOfficerModel.unit == body.unit, ClearanceOfficerModel.department == dept).delete(synchronize_session=False)
    row = ClearanceOfficerModel(unit=body.unit, department=dept, user_id=user.id)
    db.add(row)
    db.commit()
    return {"id": row.id, "message": f"{user.name} now clears {UNIT_LABELS[body.unit]}{' · ' + dept if dept else ''}"}


@router.delete("/admin/officers/{officer_id}", summary="Remove a clearance officer")
def remove_officer(officer_id: int, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    row = db.query(ClearanceOfficerModel).filter(ClearanceOfficerModel.id == officer_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
    return {"message": "Removed"}


@router.get("/admin/document-fees", summary="Fees for leaving documents")
def document_fees(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    overrides = {f.doc_type: f.amount for f in db.query(DocumentFeeModel).all()}
    return [{"doc_type": k, "name": d["name"], "amount": overrides.get(k, d["fee"]), "per_copy": d.get("per_copy", False),
             "is_default": k not in overrides} for k, d in DOC_TYPES.items()]


@router.put("/admin/document-fees/{doc_type}", summary="Set a document's fee")
def set_document_fee(doc_type: str, body: FeeIn, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    if doc_type not in DOC_TYPES:
        raise HTTPException(status_code=404, detail="Unknown document")
    row = db.query(DocumentFeeModel).filter(DocumentFeeModel.doc_type == doc_type).first()
    if row:
        row.amount = body.amount
    else:
        db.add(DocumentFeeModel(doc_type=doc_type, amount=body.amount))
    db.commit()
    return {"doc_type": doc_type, "amount": body.amount}
