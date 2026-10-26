# Finishing a payment and applying its effect: a document fee moves the request into review,
# no-dues paid online clears that unit. (Joining fees are handled in endpoints/joining.py.)
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from backend.app.models.admissions import PaymentModel
from backend.app.models.leaving import ClearanceItemModel, ExitModel
from backend.app.models.services import DocumentRequestModel


def new_payment(db: Session, user_id: str, purpose: str, items: list, details: dict) -> PaymentModel:
    pay = PaymentModel(user_id=user_id, purpose=purpose, items=items, amount=sum(i["amount"] for i in items),
                       status="created", provider="test", provider_order_id=f"test_order_{uuid.uuid4().hex[:12]}",
                       details=details)
    db.add(pay)
    db.flush()
    return pay


def refresh_exit(db: Session, exit_rec: ExitModel) -> None:
    """Mark the exit cleared once every unit has cleared it."""
    items = db.query(ClearanceItemModel).filter(ClearanceItemModel.exit_id == exit_rec.id).all()
    if items and all(i.status == "cleared" for i in items) and exit_rec.status != "cleared":
        exit_rec.status = "cleared"
        exit_rec.cleared_at = datetime.utcnow()


def finish(db: Session, pay: PaymentModel, success: bool) -> None:
    """Complete a created payment (test gateway) and apply what it pays for."""
    if not success:
        pay.status = "failed"
        return
    now = datetime.utcnow()
    pay.status = "paid"
    pay.paid_at = now
    pay.provider_payment_id = f"test_pay_{uuid.uuid4().hex[:12]}"
    pay.receipt_no = f"MVSR/RCPT/{now.year}/{pay.id:05d}"

    if pay.purpose == "document":
        req = db.query(DocumentRequestModel).filter(DocumentRequestModel.id == pay.details.get("request_id")).first()
        if req and req.status == "awaiting_payment":
            req.status = "in_review"
            req.step_since = now
    elif pay.purpose == "no_dues":
        item = db.query(ClearanceItemModel).filter(ClearanceItemModel.id == pay.details.get("clearance_item_id")).first()
        if item and item.status == "dues":
            item.status = "cleared"
            item.payment_id = pay.id
            item.acted_at = now
            item.acted_by = "Paid online"
            item.remarks = (item.remarks or "") + f" · Paid online ({pay.receipt_no})"
            exit_rec = db.query(ExitModel).filter(ExitModel.id == item.exit_id).first()
            if exit_rec:
                refresh_exit(db, exit_rec)
