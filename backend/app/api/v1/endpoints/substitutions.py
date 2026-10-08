"""
Temporary Faculty Substitution Management — FastAPI Router
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime

from backend.app.db.session import get_db
from backend.app.models.campus import (
    SubstitutionModel,
    SubstitutionAuditLogModel,
    TimetableEntryModel,
    FacultyProfileModel,
    ClassroomModel,
)
from backend.app.schemas.campus import (
    SubstitutionCreate,
    SubstitutionUpdate,
    SubstitutionOut,
    SubstitutionCancelRequest,
    FacultyConflictCheckRequest,
    FacultyConflictResult,
    SubstitutionAuditLogOut,
)

router = APIRouter()

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _overlaps(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    return (
        _time_to_minutes(a_start) < _time_to_minutes(b_end)
        and _time_to_minutes(a_end) > _time_to_minutes(b_start)
    )


def _sub_to_snapshot(sub: SubstitutionModel) -> dict:
    return {
        "id": sub.id,
        "date": str(sub.date),
        "period_number": sub.period_number,
        "classroom_id": sub.classroom_id,
        "section": sub.section,
        "subject_name": sub.subject_name,
        "original_faculty_name": sub.original_faculty_name,
        "replacement_faculty_name": sub.replacement_faculty_name,
        "reason": sub.reason,
        "status": sub.status,
    }


def _broadcast(event_type: str, payload: dict):
    try:
        from backend.app.main import timetable_manager
        import asyncio
        asyncio.create_task(timetable_manager.broadcast({"type": event_type, **payload}))
    except Exception as e:
        print(f"[substitutions] WebSocket broadcast error: {e}")


@router.post("/check-conflict", response_model=FacultyConflictResult)
def check_faculty_conflict(
    payload: FacultyConflictCheckRequest,
    db: Session = Depends(get_db),
):
    dow = payload.date.weekday()

    if not payload.replacement_faculty_id:
        return FacultyConflictResult(has_conflict=False)

    tt_entries = db.query(TimetableEntryModel).filter(
        TimetableEntryModel.faculty_id == payload.replacement_faculty_id,
        TimetableEntryModel.day_of_week == dow,
        TimetableEntryModel.is_active == True,
    ).all()

    for entry in tt_entries:
        if _overlaps(payload.start_time, payload.end_time, entry.start_time, entry.end_time):
            return FacultyConflictResult(
                has_conflict=True,
                conflict_type="timetable",
                conflict_detail=(
                    f"Faculty is already scheduled in room {entry.classroom_id} "
                    f"({entry.section} - {entry.subject_name}) "
                    f"from {entry.start_time} to {entry.end_time} on {DAY_NAMES[dow]}s."
                ),
            )

    sub_query = db.query(SubstitutionModel).filter(
        SubstitutionModel.replacement_faculty_id == payload.replacement_faculty_id,
        SubstitutionModel.date == payload.date,
        SubstitutionModel.status == "active",
    )
    if payload.exclude_substitution_id:
        sub_query = sub_query.filter(SubstitutionModel.id != payload.exclude_substitution_id)

    for sub in sub_query.all():
        if _overlaps(payload.start_time, payload.end_time, sub.start_time, sub.end_time):
            return FacultyConflictResult(
                has_conflict=True,
                conflict_type="substitution",
                conflict_detail=(
                    f"Faculty is already assigned as substitute in room {sub.classroom_id} "
                    f"({sub.section} - {sub.subject_name}) "
                    f"from {sub.start_time} to {sub.end_time} on {sub.date}."
                ),
            )

    return FacultyConflictResult(has_conflict=False)


@router.get("/today", response_model=List[SubstitutionOut])
def get_today_substitutions(db: Session = Depends(get_db)):
    today = date.today()
    return (
        db.query(SubstitutionModel)
        .filter(SubstitutionModel.date == today, SubstitutionModel.status == "active")
        .order_by(SubstitutionModel.period_number)
        .all()
    )


@router.get("/history/audit", response_model=List[SubstitutionAuditLogOut])
def get_audit_history(
    substitution_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(SubstitutionAuditLogModel)
    if substitution_id:
        q = q.filter(SubstitutionAuditLogModel.substitution_id == substitution_id)
    return q.order_by(SubstitutionAuditLogModel.timestamp.desc()).all()


@router.get("/", response_model=List[SubstitutionOut])
def list_substitutions(
    date_filter: Optional[date] = Query(None, alias="date"),
    classroom_id: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    original_faculty_id: Optional[str] = Query(None),
    replacement_faculty_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(SubstitutionModel)
    if date_filter:
        q = q.filter(SubstitutionModel.date == date_filter)
    if classroom_id:
        q = q.filter(SubstitutionModel.classroom_id == classroom_id)
    if section:
        q = q.filter(SubstitutionModel.section == section)
    if original_faculty_id:
        q = q.filter(SubstitutionModel.original_faculty_id == original_faculty_id)
    if replacement_faculty_id:
        q = q.filter(SubstitutionModel.replacement_faculty_id == replacement_faculty_id)
    if status:
        q = q.filter(SubstitutionModel.status == status)
    return q.order_by(SubstitutionModel.date.desc(), SubstitutionModel.period_number).all()


@router.post("/", response_model=SubstitutionOut)
def create_substitution(payload: SubstitutionCreate, db: Session = Depends(get_db)):
    if not db.query(ClassroomModel).filter(ClassroomModel.id == payload.classroom_id).first():
        raise HTTPException(status_code=404, detail="Classroom not found")

    if payload.replacement_faculty_id:
        if not db.query(FacultyProfileModel).filter(
            FacultyProfileModel.id == payload.replacement_faculty_id,
            FacultyProfileModel.is_active == True,
        ).first():
            raise HTTPException(status_code=404, detail="Replacement faculty not found or inactive")

    existing = db.query(SubstitutionModel).filter(
        SubstitutionModel.classroom_id == payload.classroom_id,
        SubstitutionModel.date == payload.date,
        SubstitutionModel.period_number == payload.period_number,
        SubstitutionModel.status == "active",
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"An active substitution already exists for room {payload.classroom_id} on {payload.date}, period {payload.period_number}.",
        )

    dow = payload.date.weekday()
    if payload.replacement_faculty_id:
        result = check_faculty_conflict(
            FacultyConflictCheckRequest(
                replacement_faculty_id=payload.replacement_faculty_id,
                date=payload.date,
                period_number=payload.period_number,
                start_time=payload.start_time,
                end_time=payload.end_time,
            ),
            db=db,
        )
        if result.has_conflict:
            raise HTTPException(status_code=400, detail=f"FACULTY CONFLICT: {result.conflict_detail}")

    sub = SubstitutionModel(
        date=payload.date,
        day_of_week=dow,
        period_number=payload.period_number,
        start_time=payload.start_time,
        end_time=payload.end_time,
        classroom_id=payload.classroom_id,
        section=payload.section,
        subject_id=payload.subject_id,
        subject_name=payload.subject_name,
        original_faculty_id=payload.original_faculty_id,
        original_faculty_name=payload.original_faculty_name,
        replacement_faculty_id=payload.replacement_faculty_id,
        replacement_faculty_name=payload.replacement_faculty_name,
        reason=payload.reason,
        notes=payload.notes,
        status="active",
        created_by=payload.created_by,
    )
    db.add(sub)
    db.flush()

    audit = SubstitutionAuditLogModel(
        substitution_id=sub.id,
        action="CREATED",
        snapshot=_sub_to_snapshot(sub),
        changed_by=payload.created_by,
    )
    db.add(audit)
    db.commit()
    db.refresh(sub)

    _broadcast("SUBSTITUTION_CREATED", {
        "substitution_id": sub.id,
        "classroom_id": sub.classroom_id,
        "date": str(sub.date),
        "period_number": sub.period_number,
        "replacement_faculty_name": sub.replacement_faculty_name,
        "reason": sub.reason,
    })

    return sub


@router.put("/{sub_id}", response_model=SubstitutionOut)
def update_substitution(sub_id: int, payload: SubstitutionUpdate, db: Session = Depends(get_db)):
    sub = db.query(SubstitutionModel).filter(SubstitutionModel.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Substitution not found")
    if sub.status != "active":
        raise HTTPException(status_code=400, detail="Cannot edit a cancelled substitution")

    new_fac_id = payload.replacement_faculty_id or sub.replacement_faculty_id
    if new_fac_id and new_fac_id != sub.replacement_faculty_id:
        result = check_faculty_conflict(
            FacultyConflictCheckRequest(
                replacement_faculty_id=new_fac_id,
                date=sub.date,
                period_number=sub.period_number,
                start_time=sub.start_time,
                end_time=sub.end_time,
                exclude_substitution_id=sub_id,
            ),
            db=db,
        )
        if result.has_conflict:
            raise HTTPException(status_code=400, detail=f"FACULTY CONFLICT: {result.conflict_detail}")

    old_snapshot = _sub_to_snapshot(sub)

    if payload.replacement_faculty_id is not None:
        sub.replacement_faculty_id = payload.replacement_faculty_id
    if payload.replacement_faculty_name is not None:
        sub.replacement_faculty_name = payload.replacement_faculty_name
    if payload.reason is not None:
        sub.reason = payload.reason
    if payload.notes is not None:
        sub.notes = payload.notes
    sub.updated_at = datetime.utcnow()

    audit = SubstitutionAuditLogModel(
        substitution_id=sub.id,
        action="EDITED",
        snapshot={"before": old_snapshot, "after": _sub_to_snapshot(sub), "changed_by": payload.updated_by},
        changed_by=payload.updated_by,
    )
    db.add(audit)
    db.commit()
    db.refresh(sub)

    _broadcast("SUBSTITUTION_UPDATED", {
        "substitution_id": sub.id,
        "classroom_id": sub.classroom_id,
        "date": str(sub.date),
        "period_number": sub.period_number,
    })

    return sub


@router.post("/{sub_id}/cancel", response_model=SubstitutionOut)
def cancel_substitution(
    sub_id: int,
    payload: SubstitutionCancelRequest,
    db: Session = Depends(get_db),
):
    sub = db.query(SubstitutionModel).filter(SubstitutionModel.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Substitution not found")
    if sub.status == "cancelled":
        raise HTTPException(status_code=400, detail="Substitution is already cancelled")

    sub.status = "cancelled"
    sub.cancelled_by = payload.cancelled_by
    sub.cancelled_at = datetime.utcnow()

    audit = SubstitutionAuditLogModel(
        substitution_id=sub.id,
        action="CANCELLED",
        snapshot={**_sub_to_snapshot(sub), "cancelled_by": payload.cancelled_by},
        changed_by=payload.cancelled_by,
    )
    db.add(audit)
    db.commit()
    db.refresh(sub)

    _broadcast("SUBSTITUTION_CANCELLED", {
        "substitution_id": sub.id,
        "classroom_id": sub.classroom_id,
        "date": str(sub.date),
        "period_number": sub.period_number,
    })

    return sub


@router.get("/{sub_id}", response_model=SubstitutionOut)
def get_substitution(sub_id: int, db: Session = Depends(get_db)):
    sub = db.query(SubstitutionModel).filter(SubstitutionModel.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Substitution not found")
    return sub
