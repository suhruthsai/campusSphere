# Student Services — document requests through their approval chain, issued as QR-verifiable PDFs.
#   V1: bonafide & NOC (Mentor -> Class In-charge -> AHOD -> HOD -> Principal)
#   V3: leaving documents (HOD/CoE -> Principal); fees paid online; Exam Cell uploads PC/CMM/transcripts.
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.security import get_current_user, require_admin
from backend.app.db.session import get_db
from backend.app.models.admissions import AdmissionModel
from backend.app.models.campus import UserModel
from backend.app.models.leaving import DocumentFeeModel, ExitModel
from backend.app.models.services import (
    ApproverAssignmentModel, DocumentRequestModel, StudentProfileModel,
)
from backend.app.student_services import joining as J
from backend.app.student_services import payments as P
from backend.app.student_services import workflow
from backend.app.student_services.catalog import (
    COURSE_COMPLETED, DOC_TYPES, NOC_DATED_PURPOSES, OTHER, ROLE_LABELS, public_catalog,
)
from backend.app.student_services.pdf import render_pdf

router = APIRouter()          # mounted under /services, login required
public_router = APIRouter()   # mounted under /services, no login (verification)

APPROVER_ROLES = ("faculty", "admin", "staff")
ASSIGNABLE_ROLES = ("class_incharge", "ahod", "hod", "coe", "principal")
COLLEGE_WIDE_ROLES = ("principal", "coe")


# ── Schemas ────────────────────────────────────────────────────────────────────
class ProfileIn(BaseModel):
    roll_no: Optional[str] = Field(None, max_length=30)
    year: int = Field(..., ge=1, le=4)
    section: str = Field(..., min_length=1, max_length=10)
    parent_name: str = Field(..., min_length=2, max_length=100)
    gender: Literal["male", "female", "other"]


class AdminProfileIn(ProfileIn):
    department: Optional[str] = Field(None, max_length=30)
    program: Optional[str] = Field(None, max_length=30)
    mentor_id: Optional[str] = None


class RequestIn(BaseModel):
    doc_type: Literal["bonafide", "noc", "tc", "conduct", "course_completion", "moi", "provisional", "cmm", "transcripts"]
    purpose: str = Field(..., max_length=80)
    details: dict = Field(default_factory=dict)


class ActionIn(BaseModel):
    remarks: Optional[str] = Field(None, max_length=500)


class DispatchIn(BaseModel):
    tracking: str = Field(..., min_length=3, max_length=80)


class AssignmentIn(BaseModel):
    role: Literal["class_incharge", "ahod", "hod", "coe", "principal"]
    user_id: str
    department: Optional[str] = Field(None, max_length=30)
    year: Optional[int] = Field(None, ge=1, le=4)
    section: Optional[str] = Field(None, max_length=10)


# ── Helpers ────────────────────────────────────────────────────────────────────
def _profile_out(db: Session, profile: Optional[StudentProfileModel], user: UserModel) -> dict:
    mentor = db.query(UserModel).filter(UserModel.id == profile.mentor_id).first() if profile and profile.mentor_id else None
    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "roll_no": (profile.roll_no if profile else None) or user.roll_no,
        "department": profile.department if profile else user.department,
        "program": profile.program if profile else "B.E.",
        "year": profile.year if profile else None,
        "section": profile.section if profile else None,
        "parent_name": profile.parent_name if profile else None,
        "gender": profile.gender if profile else None,
        "mentor_id": mentor.id if mentor else None,
        "mentor_name": mentor.name if mentor else None,
        "complete": bool(profile and profile.year and profile.section and profile.parent_name and profile.gender
                         and ((profile.roll_no or user.roll_no))),
    }


def _get_request(db: Session, req_id: int) -> DocumentRequestModel:
    req = db.query(DocumentRequestModel).filter(DocumentRequestModel.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


def _can_view(req: DocumentRequestModel, current: dict) -> bool:
    return (
        current["role"] == "admin"
        or req.student_id == current["sub"]
        or any(s["approver_id"] == current["sub"] for s in req.steps)
    )


def _validate_request(body: RequestIn) -> dict:
    doc = DOC_TYPES[body.doc_type]
    if body.purpose not in doc["purposes"]:
        raise HTTPException(status_code=422, detail="Choose a purpose from the list")
    details = {k: (str(v).strip() if v is not None else "") for k, v in (body.details or {}).items()}
    allowed = {f["key"] for f in doc["fields"]} | {"purpose_details"}
    details = {k: v for k, v in details.items() if k in allowed and v}
    if any(len(v) > 200 for v in details.values()):
        raise HTTPException(status_code=422, detail="Details are too long (200 characters max each)")
    if body.purpose == OTHER and not details.get("purpose_details"):
        raise HTTPException(status_code=422, detail="Please describe the purpose")
    for f in doc["fields"]:
        cond = f.get("show_if")
        shown = not cond or all(details.get(k) == v for k, v in cond.items())
        if not shown:
            details.pop(f["key"], None)
            continue
        if (f["required"] or cond) and not details.get(f["key"]):
            raise HTTPException(status_code=422, detail=f"{f['label']} is required")
        if f.get("type") == "select" and details.get(f["key"]) and details[f["key"]] not in f["options"]:
            raise HTTPException(status_code=422, detail=f"Choose {f['label'].lower()} from the list")
        if f.get("type") == "number" and details.get(f["key"]):
            try:
                n = int(details[f["key"]])
            except ValueError:
                raise HTTPException(status_code=422, detail=f"{f['label']} must be a number")
            if not (f.get("min", 0) <= n <= f.get("max", 1000)):
                raise HTTPException(status_code=422, detail=f"{f['label']} must be {f.get('min', 0)}–{f.get('max', 1000)}")
            details[f["key"]] = str(n)
    if body.doc_type == "noc" and body.purpose in NOC_DATED_PURPOSES:
        if not details.get("from_date") or not details.get("to_date"):
            raise HTTPException(status_code=422, detail="From and to dates are required for this NOC")
    for key in ("from_date", "to_date"):
        if details.get(key):
            try:
                datetime.strptime(details[key], "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=422, detail=f"{key.replace('_', ' ').capitalize()} must be a date")
    if details.get("from_date") and details.get("to_date") and details["to_date"] < details["from_date"]:
        raise HTTPException(status_code=422, detail="The to date is before the from date")
    return details


# ── Catalogue & student profile ────────────────────────────────────────────────
def _fees(db: Session) -> dict:
    return {f.doc_type: f.amount for f in db.query(DocumentFeeModel).all()}


def _eligibility(doc_type: str, exit_rec: Optional[ExitModel]) -> Optional[str]:
    """Why this student can't request the document now (None = they can)."""
    doc = DOC_TYPES[doc_type]
    if not doc["for_alumni"] and exit_rec and exit_rec.status == "cleared":
        return "Only for current students"
    if doc["needs_exit"] == "cleared" and not (exit_rec and exit_rec.status == "cleared"):
        return "Available after your no-dues clearance is complete"
    if doc["completed_only"] and not (exit_rec and exit_rec.reason == COURSE_COMPLETED):
        return "Only for students who have completed the course"
    return None


@router.get("/catalog", summary="Documents available at the service counters")
def catalog(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    items = public_catalog(_fees(db))
    if current["role"] == "student":
        exit_rec = db.query(ExitModel).filter(ExitModel.user_id == current["sub"]).first()
        for it in items:
            it["unavailable_reason"] = _eligibility(it["id"], exit_rec)
    return items


@router.get("/me/profile", summary="My academic profile (students)")
def my_profile(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
    return _profile_out(db, profile, user)


@router.put("/me/profile", summary="Complete my academic profile (students)")
def update_my_profile(body: ProfileIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if current["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students have an academic profile")
    user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == user.id).first()
    if not profile:
        profile = StudentProfileModel(user_id=user.id, department=(user.department or "CSE").upper())
        db.add(profile)
    profile.roll_no = (body.roll_no or "").strip() or profile.roll_no or user.roll_no
    profile.year = body.year
    profile.section = body.section.strip().upper()
    profile.parent_name = body.parent_name.strip()
    profile.gender = body.gender
    db.commit()
    db.refresh(profile)
    return _profile_out(db, profile, user)


# ── Requests (students) ────────────────────────────────────────────────────────
@router.post("/requests", summary="Request a document")
def create_request(body: RequestIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if current["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can request documents")
    user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == user.id).first()
    if not _profile_out(db, profile, user)["complete"]:
        raise HTTPException(status_code=400, detail="Please complete your academic profile first")
    doc = DOC_TYPES[body.doc_type]
    exit_rec = db.query(ExitModel).filter(ExitModel.user_id == user.id).first()
    why_not = _eligibility(body.doc_type, exit_rec)
    if why_not:
        raise HTTPException(status_code=400, detail=why_not)
    details = _validate_request(body)

    open_same = db.query(DocumentRequestModel).filter(
        DocumentRequestModel.student_id == user.id,
        DocumentRequestModel.doc_type == body.doc_type,
        DocumentRequestModel.purpose == body.purpose,
        DocumentRequestModel.status.in_(["in_review", "awaiting_payment"]),
    ).first()
    if open_same:
        raise HTTPException(status_code=409, detail=f"You already have this request open ({open_same.ref_no})")

    try:
        steps = workflow.resolve_chain(db, profile, doc["chain"])
    except workflow.ChainError as e:
        raise HTTPException(status_code=400, detail=str(e))

    fee = _fees(db).get(body.doc_type, doc["fee"])
    copies = int(details.get("copies", 1)) if doc.get("per_copy") else 1
    amount = fee * copies
    extra = {}
    if exit_rec:
        extra = {"leaving_date": exit_rec.leaving_date.isoformat(), "exit_reason": exit_rec.reason}
    adm = db.query(AdmissionModel).filter(AdmissionModel.user_id == user.id).first()
    if adm:
        extra.update({"date_of_birth": adm.date_of_birth.isoformat() if adm.date_of_birth else None,
                      "admitted_year": adm.academic_year})

    now = datetime.utcnow()
    req = DocumentRequestModel(
        student_id=user.id, doc_type=body.doc_type, purpose=body.purpose, details=details,
        student=workflow.student_snapshot(user, profile, extra), steps=steps, current_step=0,
        status="awaiting_payment" if amount > 0 else "in_review", step_since=now, created_at=now,
        verify_code=workflow.new_verify_code(db), amount=amount, fulfilment=doc["fulfilment"],
    )
    db.add(req)
    db.flush()                       # assigns the id used in the reference number
    workflow.assign_ref_no(req)
    if amount > 0:
        label = doc["name"] + (f" × {copies}" if copies > 1 else "")
        pay = P.new_payment(db, user.id, "document", [{"fee_head_id": None, "name": label, "amount": amount}],
                            {"request_id": req.id, "ref_no": req.ref_no})
        req.payment_id = pay.id
    db.commit()
    db.refresh(req)
    return workflow.serialize(req, current)


@router.get("/requests/mine", summary="My document requests")
def my_requests(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    rows = (db.query(DocumentRequestModel)
            .filter(DocumentRequestModel.student_id == current["sub"])
            .order_by(DocumentRequestModel.created_at.desc()).limit(100).all())
    return [workflow.serialize(r, current) for r in rows]


@router.get("/requests/{req_id}", summary="One request (its student, its approvers, or admins)")
def get_request(req_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    req = _get_request(db, req_id)
    if not _can_view(req, current):
        raise HTTPException(status_code=403, detail="Not your request")
    return workflow.serialize(req, current)


@router.post("/requests/{req_id}/cancel", summary="Withdraw a request that is still in review")
def cancel_request(req_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    req = _get_request(db, req_id)
    if req.student_id != current["sub"]:
        raise HTTPException(status_code=403, detail="Not your request")
    if req.status == "in_review" and (req.amount or 0) > 0:
        raise HTTPException(status_code=400, detail="This request is paid for; please contact the office to withdraw it")
    if req.status not in ("in_review", "awaiting_payment"):
        raise HTTPException(status_code=400, detail="Only open requests can be withdrawn")
    req.status = "cancelled"
    db.commit()
    db.refresh(req)
    return workflow.serialize(req, current)


@router.get("/requests/{req_id}/pdf", summary="Download the approved document")
def download_pdf(req_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    req = _get_request(db, req_id)
    if not _can_view(req, current):
        raise HTTPException(status_code=403, detail="Not your request")
    if req.status != "approved":
        raise HTTPException(status_code=400, detail="The document is not approved yet")
    filename = req.ref_no.replace("/", "-") + ".pdf"
    if req.fulfilment == "upload":
        path = J.issued_path(req.issued_file)
        if not path.exists():
            raise HTTPException(status_code=410, detail="The document file is no longer available")
        return FileResponse(path, media_type="application/pdf", filename=filename,
                            headers={"Cache-Control": "private, no-store"})
    return Response(render_pdf(req), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{filename}"'})


# ── Exam Cell: prepared documents (PC, CMM, transcripts) ────────────────────────
def _is_coe_or_admin(db: Session, current: dict) -> bool:
    if current["role"] == "admin":
        return True
    coe = db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.role == "coe",
                                                   ApproverAssignmentModel.user_id == current["sub"]).first()
    return bool(coe)


@router.get("/exam-cell/queue", summary="Approved Exam Cell documents waiting to be uploaded or dispatched")
def exam_cell_queue(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if not _is_coe_or_admin(db, current):
        raise HTTPException(status_code=403, detail="Controller of Examinations only")
    to_upload = db.query(DocumentRequestModel).filter(DocumentRequestModel.status == "processing").order_by(DocumentRequestModel.step_since).all()
    issued = (db.query(DocumentRequestModel).filter(DocumentRequestModel.status == "approved", DocumentRequestModel.fulfilment == "upload")
              .order_by(DocumentRequestModel.issued_at.desc()).limit(100).all())
    needs_dispatch = [r for r in issued if (r.details or {}).get("delivery", "").startswith(("Post", "Send")) and not r.dispatch]
    return {"to_upload": [workflow.serialize(r, current) for r in to_upload],
            "to_dispatch": [workflow.serialize(r, current) for r in needs_dispatch]}


@router.post("/requests/{req_id}/final-document", summary="Exam Cell uploads the prepared document (PDF)")
def upload_final_document(req_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if not _is_coe_or_admin(db, current):
        raise HTTPException(status_code=403, detail="Controller of Examinations only")
    req = _get_request(db, req_id)
    if req.status != "processing":
        raise HTTPException(status_code=400, detail="This request isn't waiting for its document")
    try:
        req.issued_file = J.save_issued_pdf(file)
    except J.UploadError as e:
        raise HTTPException(status_code=422, detail=str(e))
    req.status = "approved"
    req.issued_at = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return workflow.serialize(req, current)


@router.post("/requests/{req_id}/dispatch", summary="Record postal / WES dispatch")
def dispatch(req_id: int, body: DispatchIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if not _is_coe_or_admin(db, current):
        raise HTTPException(status_code=403, detail="Controller of Examinations only")
    req = _get_request(db, req_id)
    if req.status != "approved" or not (req.details or {}).get("delivery", "").startswith(("Post", "Send")):
        raise HTTPException(status_code=400, detail="Nothing to dispatch for this request")
    req.dispatch = {"mode": req.details["delivery"], "tracking": body.tracking.strip(),
                    "at": datetime.utcnow().isoformat(), "by": current["name"]}
    db.commit()
    db.refresh(req)
    return workflow.serialize(req, current)


# ── Approvals (mentors, class in-charges, AHODs, HODs, principal; admins) ──────
@router.get("/approvals/inbox", summary="Requests waiting for me")
def approvals_inbox(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if current["role"] not in APPROVER_ROLES:
        raise HTTPException(status_code=403, detail="Approvers only")
    rows = (db.query(DocumentRequestModel)
            .filter(DocumentRequestModel.status == "in_review")
            .order_by(DocumentRequestModel.step_since.asc()).all())
    mine = [r for r in rows if r.steps[r.current_step]["approver_id"] == current["sub"]]
    # Admins also see everyone's queue so they can step in when an approver is away
    others = [r for r in rows if r not in mine] if current["role"] == "admin" else []
    return {
        "mine": [workflow.serialize(r, current) for r in mine],
        "others": [workflow.serialize(r, current) for r in others],
    }


@router.get("/approvals/history", summary="Requests I have acted on")
def approvals_history(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if current["role"] not in APPROVER_ROLES:
        raise HTTPException(status_code=403, detail="Approvers only")
    rows = (db.query(DocumentRequestModel)
            .order_by(DocumentRequestModel.updated_at.desc()).limit(300).all())
    acted = [r for r in rows if any(s.get("acted_by_id") == current["sub"] for s in r.steps)][:50]
    return [workflow.serialize(r, current) for r in acted]


def _act(req_id: int, approve: bool, body: ActionIn, db: Session, current: dict):
    req = _get_request(db, req_id)
    if not workflow.can_act(req, current):
        raise HTTPException(status_code=403, detail="This request isn't waiting for you")
    if not approve and len((body.remarks or "").strip()) < 5:
        raise HTTPException(status_code=422, detail="Please give the student a reason (at least 5 characters)")
    workflow.act(db, req, current, approve, body.remarks)
    db.commit()
    db.refresh(req)
    return workflow.serialize(req, current)


@router.post("/requests/{req_id}/approve", summary="Approve the current step")
def approve(req_id: int, body: ActionIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    return _act(req_id, True, body, db, current)


@router.post("/requests/{req_id}/reject", summary="Reject the request (reason required)")
def reject(req_id: int, body: ActionIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    return _act(req_id, False, body, db, current)


# ── Admin setup ────────────────────────────────────────────────────────────────
@router.get("/admin/approvers", summary="Users who can be approvers")
def list_approver_users(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    users = (db.query(UserModel).filter(UserModel.role.in_(APPROVER_ROLES), UserModel.status == "active")
             .order_by(UserModel.name).all())
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "department": u.department} for u in users]


@router.get("/admin/assignments", summary="Approver role assignments")
def list_assignments(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    rows = db.query(ApproverAssignmentModel).order_by(ApproverAssignmentModel.role, ApproverAssignmentModel.department).all()
    names = {u.id: u.name for u in db.query(UserModel).filter(UserModel.id.in_([r.user_id for r in rows])).all()}
    return [{
        "id": r.id, "role": r.role, "role_label": ROLE_LABELS[r.role], "user_id": r.user_id,
        "user_name": names.get(r.user_id), "department": r.department, "year": r.year, "section": r.section,
    } for r in rows]


@router.post("/admin/assignments", summary="Assign an approver role")
def create_assignment(body: AssignmentIn, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == body.user_id).first()
    if not user or user.role not in APPROVER_ROLES:
        raise HTTPException(status_code=400, detail="Approvers must be faculty, staff or admin accounts")
    dept = (body.department or "").strip().upper() or None
    section = (body.section or "").strip().upper() or None
    if body.role in COLLEGE_WIDE_ROLES:
        dept, year, section = None, None, None
    elif body.role in ("ahod", "hod"):
        if not dept:
            raise HTTPException(status_code=422, detail="Department is required")
        year, section = None, None
    else:  # class_incharge
        if not (dept and body.year and section):
            raise HTTPException(status_code=422, detail="Department, year and section are required")
        year = body.year
    # One holder per scope: replace the previous assignment
    db.query(ApproverAssignmentModel).filter(
        ApproverAssignmentModel.role == body.role, ApproverAssignmentModel.department == dept,
        ApproverAssignmentModel.year == year, ApproverAssignmentModel.section == section,
    ).delete(synchronize_session=False)
    row = ApproverAssignmentModel(role=body.role, user_id=user.id, department=dept, year=year, section=section)
    db.add(row)
    db.commit()
    return {"id": row.id, "message": f"{user.name} is now {ROLE_LABELS[body.role]}"}


@router.delete("/admin/assignments/{assignment_id}", summary="Remove an approver assignment")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    row = db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.id == assignment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(row)
    db.commit()
    return {"message": "Removed"}


@router.get("/admin/students", summary="Students and their academic profiles")
def list_students(department: Optional[str] = Query(None), db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    q = db.query(UserModel).filter(UserModel.role == "student")
    if department:
        q = q.filter(UserModel.department == department)
    users = q.order_by(UserModel.name).limit(500).all()
    profiles = {p.user_id: p for p in db.query(StudentProfileModel).filter(
        StudentProfileModel.user_id.in_([u.id for u in users])).all()}
    return [_profile_out(db, profiles.get(u.id), u) for u in users]


@router.put("/admin/students/{user_id}/profile", summary="Set a student's profile and mentor")
def admin_update_profile(user_id: str, body: AdminProfileIn, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == user_id, UserModel.role == "student").first()
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")
    if body.mentor_id:
        mentor = db.query(UserModel).filter(UserModel.id == body.mentor_id).first()
        if not mentor or mentor.role not in APPROVER_ROLES:
            raise HTTPException(status_code=400, detail="Mentors must be faculty, staff or admin accounts")
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == user.id).first()
    if not profile:
        profile = StudentProfileModel(user_id=user.id, department=(user.department or "CSE").upper())
        db.add(profile)
    profile.department = ((body.department or "").strip().upper() or profile.department or user.department or "CSE")
    profile.program = (body.program or "").strip() or profile.program or "B.E."
    profile.roll_no = (body.roll_no or "").strip() or profile.roll_no or user.roll_no
    profile.year = body.year
    profile.section = body.section.strip().upper()
    profile.parent_name = body.parent_name.strip()
    profile.gender = body.gender
    profile.mentor_id = body.mentor_id or None
    db.commit()
    db.refresh(profile)
    return _profile_out(db, profile, user)


@router.get("/admin/requests", summary="All requests (management overview)")
def all_requests(status: Optional[str] = Query(None), db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    q = db.query(DocumentRequestModel)
    if status:
        q = q.filter(DocumentRequestModel.status == status)
    rows = q.order_by(DocumentRequestModel.created_at.desc()).limit(300).all()
    return [workflow.serialize(r) for r in rows]


# ── Public verification ────────────────────────────────────────────────────────
@public_router.get("/verify/{code}", summary="Verify a document by its QR code (public)")
def verify(code: str, db: Session = Depends(get_db)):
    req = db.query(DocumentRequestModel).filter(DocumentRequestModel.verify_code == code.strip().upper()).first()
    if not req or req.status != "approved":
        return {"valid": False}
    s = req.student or {}
    return {
        "valid": True,
        "ref_no": req.ref_no,
        "document": DOC_TYPES[req.doc_type]["name"],
        "purpose": req.purpose if req.purpose != OTHER else (req.details or {}).get("purpose_details", OTHER),
        "student_name": s.get("name"),
        "roll_no": s.get("roll_no"),
        "department": s.get("department"),
        "program": s.get("program"),
        "academic_year": s.get("academic_year"),
        "issued_at": req.issued_at.isoformat() if req.issued_at else None,
        "approved_by": [{"role": st["label"], "name": st.get("acted_by_name") or st["approver_name"]} for st in req.steps],
    }
