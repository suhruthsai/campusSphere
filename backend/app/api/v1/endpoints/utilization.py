"""Classroom utilization: ML model details, weekly report with recommendations,
retraining, and recording real session headcounts."""
import threading
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.security import get_current_user, require_admin, require_staff
from backend.app.db.session import get_db
from backend.app.models.campus import ClassroomModel, ClassSessionLogModel, TimetableEntryModel
from backend.app.ai.utilization import model as M
from backend.app.ai.utilization.calendar import HISTORY_WEEKS, enrolled_for
from backend.app.ai.utilization.recommend import build_report

router = APIRouter()

# Reports take a few seconds to build; cache them until the model or data changes
_report_cache: dict = {}
_report_lock = threading.Lock()


def _cache_key(db: Session, week: int):
    info = M.get_bundle(db)["info"]
    n_sessions = db.query(ClassSessionLogModel.id).count()
    return (week, info["trained_at"], n_sessions)


@router.get("/model", summary="Utilization model: algorithm, evaluation and feature importance")
def model_info(db: Session = Depends(get_db), _user: dict = Depends(get_current_user)):
    return M.get_bundle(db)["info"]


@router.get("/report", summary="Next-week utilization forecast with recommendations (admin/faculty)")
def utilization_report(
    week: Optional[int] = Query(None, ge=1, le=HISTORY_WEEKS + 4, description="Semester week (default: next week)"),
    db: Session = Depends(get_db),
    _staff: dict = Depends(require_staff),
):
    week = week or M.default_forecast_week()
    key = _cache_key(db, week)
    with _report_lock:
        if key not in _report_cache:
            _report_cache.clear()
            _report_cache[key] = build_report(db, week)
        return _report_cache[key]


@router.post("/train", summary="Retrain the utilization model on all recorded history (admin)")
def retrain(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    info = M.train(db)
    _report_cache.clear()
    return info


class SessionHeadcount(BaseModel):
    timetable_entry_id: int
    date: date
    present: int = Field(..., ge=0)


@router.post("/sessions", summary="Record the real headcount of a held session (admin/faculty)")
def record_session(payload: SessionHeadcount, db: Session = Depends(get_db), staff: dict = Depends(require_staff)):
    entry = db.query(TimetableEntryModel).filter(TimetableEntryModel.id == payload.timetable_entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found")
    if payload.date.weekday() != entry.day_of_week:
        raise HTTPException(status_code=400, detail="That date is not on this session's weekday")
    if payload.date > date.today():
        raise HTTPException(status_code=400, detail="Cannot record a session in the future")
    enrolled = enrolled_for(entry.section, entry.batch)
    if payload.present > enrolled:
        raise HTTPException(status_code=400, detail=f"Present ({payload.present}) exceeds enrolled ({enrolled})")
    room = db.query(ClassroomModel).filter(ClassroomModel.id == entry.classroom_id).first()

    row = db.query(ClassSessionLogModel).filter(
        ClassSessionLogModel.timetable_entry_id == entry.id, ClassSessionLogModel.date == payload.date).first()
    if row is None:
        row = ClassSessionLogModel(timetable_entry_id=entry.id, date=payload.date)
        db.add(row)
    row.classroom_id = entry.classroom_id
    row.enrolled = enrolled
    row.present = payload.present
    row.capacity = room.capacity if room else 60
    row.source = "recorded"
    row.recorded_by = staff["name"]
    db.commit()
    return {"message": "Headcount recorded. Retrain the model to include it.", "enrolled": enrolled}
