from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from backend.app.db.session import get_db
from backend.app.models.campus import AttendanceLogModel

router = APIRouter()


@router.get("/", summary="Get attendance logs with filters")
def get_attendance(
    student_id: Optional[str] = Query(None),
    building_id: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db)
):
    q = db.query(AttendanceLogModel)
    if student_id: q = q.filter(AttendanceLogModel.student_id == student_id)
    if building_id: q = q.filter(AttendanceLogModel.building_id == building_id)
    if date:        q = q.filter(AttendanceLogModel.date == date)
    if subject:     q = q.filter(AttendanceLogModel.subject.ilike(f"%{subject}%"))
    if status:      q = q.filter(AttendanceLogModel.status == status)
    return q.order_by(AttendanceLogModel.timestamp.desc()).limit(limit).all()


@router.post("/", summary="Mark attendance for a student")
def mark_attendance(
    student_id: str,
    building_id: Optional[str] = None,
    room_label: Optional[str] = None,
    subject: str = "",
    status: str = "present",
    period: Optional[int] = None,
    marked_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    log = AttendanceLogModel(
        student_id=student_id,
        building_id=building_id,
        room_label=room_label,
        subject=subject,
        status=status,
        date=datetime.utcnow().strftime("%Y-%m-%d"),
        period=period,
        marked_by=marked_by,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/summary/{student_id}", summary="Attendance summary for a student")
def attendance_summary(student_id: str, db: Session = Depends(get_db)):
    logs = db.query(AttendanceLogModel).filter(AttendanceLogModel.student_id == student_id).all()
    total = len(logs)
    present = sum(1 for l in logs if l.status == "present")
    absent = sum(1 for l in logs if l.status == "absent")
    late = sum(1 for l in logs if l.status == "late")
    percentage = round((present / total) * 100, 2) if total > 0 else 0
    return {
        "student_id": student_id,
        "total_classes": total,
        "present": present,
        "absent": absent,
        "late": late,
        "attendance_percentage": percentage
    }


@router.delete("/{log_id}", summary="Delete an attendance record")
def delete_attendance(log_id: int, db: Session = Depends(get_db)):
    log = db.query(AttendanceLogModel).filter(AttendanceLogModel.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Attendance log not found")
    db.delete(log)
    db.commit()
    return {"message": "Deleted"}
