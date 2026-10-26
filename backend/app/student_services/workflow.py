# Approval-chain logic for document requests: who approves each step, advancing the
# chain, and the views of a request sent to students, approvers and admins.
import secrets
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from backend.app.models.campus import UserModel
from backend.app.models.services import (
    ApproverAssignmentModel, DocumentRequestModel, StudentProfileModel,
)
from backend.app.student_services.catalog import (
    CHAIN, COE_BUILDING, DOC_TYPES, ROLE_LABELS, STEP_SLA_HOURS, PRINCIPAL_BUILDING, department_building,
)


class ChainError(ValueError):
    """The approval chain can't be built (e.g. no HOD assigned)."""


def academic_year(when: Optional[datetime] = None) -> str:
    """Indian academic year, starting in July: Oct 2026 -> "2026-27", Mar 2027 -> "2026-27"."""
    when = when or datetime.utcnow()
    start = when.year if when.month >= 7 else when.year - 1
    return f"{start}-{(start + 1) % 100:02d}"


def _assignment(db: Session, role: str, department=None, year=None, section=None):
    q = db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.role == role)
    if department is not None:
        # Departments are stored in capitals; older profiles may say 'Mech' or 'Civil'
        q = q.filter(func.upper(ApproverAssignmentModel.department) == department.upper())
    if year is not None:
        q = q.filter(ApproverAssignmentModel.year == year)
    if section is not None:
        q = q.filter(ApproverAssignmentModel.section == section)
    return q.order_by(ApproverAssignmentModel.id.desc()).first()


def _approver_id(db: Session, profile: StudentProfileModel, role: str):
    if role == "mentor":
        return profile.mentor_id
    if role == "class_incharge":
        return getattr(_assignment(db, "class_incharge", profile.department, profile.year, profile.section), "user_id", None)
    if role in ("ahod", "hod"):
        return getattr(_assignment(db, role, profile.department), "user_id", None)
    return getattr(_assignment(db, role), "user_id", None)   # principal, coe: college-wide


def resolve_chain(db: Session, profile: StudentProfileModel, roles: list | None = None) -> list:
    """The approvers for this student and document, or ChainError naming the first missing one."""
    roles = roles or CHAIN
    approver_ids = {role: _approver_id(db, profile, role) for role in roles}
    steps = []
    for role in roles:
        user = db.query(UserModel).filter(UserModel.id == approver_ids[role]).first() if approver_ids[role] else None
        if not user or user.status != "active":
            raise ChainError(
                f"Your {ROLE_LABELS[role]} isn't set up yet. Please contact the admin office."
            )
        steps.append({
            "role": role,
            "label": ROLE_LABELS[role],
            "approver_id": user.id,
            "approver_name": user.name,
            "status": "pending",
            "acted_at": None,
            "acted_by_id": None,
            "acted_by_name": None,
            "remarks": None,
        })
    return steps


def student_snapshot(user: UserModel, profile: StudentProfileModel, extra: dict | None = None) -> dict:
    """extra: leaving details for V3 documents (leaving_date, exit_reason, date_of_birth, admitted_year)."""
    return {
        **(extra or {}),
        "name": user.name,
        "email": user.email,
        "roll_no": profile.roll_no or user.roll_no,
        "department": profile.department,
        "program": profile.program,
        "year": profile.year,
        "section": profile.section,
        "parent_name": profile.parent_name,
        "gender": profile.gender,
        "academic_year": academic_year(),
    }


def new_verify_code(db: Session) -> str:
    while True:
        code = secrets.token_hex(6).upper()   # 12 hex chars, e.g. 3F9A0C1B7E22
        if not db.query(DocumentRequestModel).filter(DocumentRequestModel.verify_code == code).first():
            return code


def assign_ref_no(req: DocumentRequestModel) -> None:
    year = (req.created_at or datetime.utcnow()).year
    req.ref_no = f"MVSR/{DOC_TYPES[req.doc_type]['code']}/{year}/{req.id:05d}"


def can_act(req: DocumentRequestModel, current: dict) -> bool:
    """Whether this user may approve/reject the current step (its approver, or an admin)."""
    if req.status != "in_review" or req.current_step >= len(req.steps):
        return False
    return current["role"] == "admin" or req.steps[req.current_step]["approver_id"] == current["sub"]


def act(db: Session, req: DocumentRequestModel, current: dict, approve: bool, remarks: Optional[str]) -> None:
    """Approve or reject the current step. On approval, also completes any directly
    following steps held by the same person (e.g. a mentor who is also class in-charge)."""
    now = datetime.utcnow()
    steps = [dict(s) for s in req.steps]
    step = steps[req.current_step]
    acting_as_admin = current["role"] == "admin" and step["approver_id"] != current["sub"]
    note = (remarks or "").strip() or None
    if acting_as_admin:
        note = f"[Admin override] {note or ''}".strip()

    def stamp(s, status):
        s.update(status=status, acted_at=now.isoformat(), acted_by_id=current["sub"],
                 acted_by_name=current["name"], remarks=note)

    if not approve:
        stamp(step, "rejected")
        req.status = "rejected"
    else:
        stamp(step, "approved")
        nxt = req.current_step + 1
        while nxt < len(steps) and steps[nxt]["approver_id"] == step["approver_id"]:
            stamp(steps[nxt], "approved")
            nxt += 1
        req.current_step = nxt
        if nxt >= len(steps):
            if req.fulfilment == "upload":
                req.status = "processing"   # approved; the Exam Cell now uploads the prepared document
                req.step_since = now
            else:
                req.status = "approved"
                req.issued_at = now
        else:
            req.step_since = now

    req.steps = steps
    flag_modified(req, "steps")


def location_building(req: DocumentRequestModel) -> str:
    """Twin building where the request is right now (for the document token)."""
    if req.status != "in_review":   # awaiting payment, processing, approved, rejected, cancelled
        return DOC_TYPES[req.doc_type]["counter"]
    role = req.steps[req.current_step]["role"] if req.current_step < len(req.steps) else "principal"
    if role == "principal":
        return PRINCIPAL_BUILDING
    if role == "coe":
        return COE_BUILDING
    return department_building((req.student or {}).get("department"))


def serialize(req: DocumentRequestModel, viewer: Optional[dict] = None) -> dict:
    doc = DOC_TYPES[req.doc_type]
    waiting_hours = None
    overdue = False
    current = None
    if req.status == "in_review" and req.current_step < len(req.steps):
        current = req.steps[req.current_step]
        waiting_hours = round((datetime.utcnow() - (req.step_since or req.created_at)).total_seconds() / 3600, 1)
        overdue = waiting_hours >= STEP_SLA_HOURS
    return {
        "id": req.id,
        "ref_no": req.ref_no,
        "doc_type": req.doc_type,
        "doc_name": doc["name"],
        "counter": doc["counter"],
        "counter_name": doc["counter_name"],
        "purpose": req.purpose,
        "details": req.details or {},
        "student": req.student or {},
        "student_id": req.student_id,
        "status": req.status,
        "steps": req.steps,
        "current_step": req.current_step,
        "current_role": current["role"] if current else None,
        "current_label": current["label"] if current else None,
        "current_approver": current["approver_name"] if current else None,
        "waiting_hours": waiting_hours,
        "overdue": overdue,
        "location": location_building(req),
        "verify_code": req.verify_code if req.status == "approved" else None,
        "amount": req.amount or 0,
        "payment_id": req.payment_id,
        "fulfilment": req.fulfilment or doc["fulfilment"],
        "has_file": bool(req.issued_file),
        "dispatch": req.dispatch,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "updated_at": req.updated_at.isoformat() if req.updated_at else None,
        "issued_at": req.issued_at.isoformat() if req.issued_at else None,
        "can_act": bool(viewer) and can_act(req, viewer),
    }
