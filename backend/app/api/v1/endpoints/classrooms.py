from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.db.session import get_db
from backend.app.core.security import require_admin
from backend.app.models.campus import ClassroomModel, TimetableEntryModel
from backend.app.schemas.campus import ClassroomCreate, ClassroomUpdate, ClassroomOut, CurrentClassResponse, TimetableEntryOut

router = APIRouter()

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)

@router.get("/", response_model=List[ClassroomOut])
def list_classrooms(
    building: Optional[str] = Query(None),
    floor: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(ClassroomModel)
    if building:
        q = q.filter(ClassroomModel.building == building)
    if floor is not None:
        q = q.filter(ClassroomModel.floor == floor)
    if status:
        q = q.filter(ClassroomModel.status == status)
    return q.all()

@router.post("/", response_model=ClassroomOut)
def create_classroom(payload: ClassroomCreate, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    if db.query(ClassroomModel).filter(ClassroomModel.id == payload.id).first():
        raise HTTPException(status_code=409, detail="Classroom ID already exists")
    room = ClassroomModel(**payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room

@router.get("/{classroom_id}", response_model=ClassroomOut)
def get_classroom(classroom_id: str, db: Session = Depends(get_db)):
    room = db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return room

@router.put("/{classroom_id}", response_model=ClassroomOut)
def update_classroom(classroom_id: str, payload: ClassroomUpdate, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    room = db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(room, k, v)
    db.commit()
    db.refresh(room)
    return room

@router.delete("/{classroom_id}")
def delete_classroom(classroom_id: str, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    room = db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    db.delete(room)
    db.commit()
    return {"message": "Deleted"}

@router.get("/{classroom_id}/current", response_model=CurrentClassResponse)
def get_current_class(
    classroom_id: str,
    at_datetime: Optional[str] = Query(None, description="Optional campus (India) time, e.g. 2026-10-26T10:30"),
    db: Session = Depends(get_db)
):
    from backend.app.api.v1.endpoints.timetable import current_class
    return current_class(db, classroom_id, at_datetime)

@router.get("/{classroom_id}/week")
def get_week_schedule(classroom_id: str, db: Session = Depends(get_db)):
    room = db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    entries = db.query(TimetableEntryModel).filter(
        TimetableEntryModel.classroom_id == classroom_id,
        TimetableEntryModel.is_active == True,
    ).order_by(TimetableEntryModel.day_of_week, TimetableEntryModel.period_number).all()
    schedule = {}
    for e in entries:
        day = DAY_NAMES[e.day_of_week]
        if day not in schedule:
            schedule[day] = []
        schedule[day].append(TimetableEntryOut.model_validate(e).model_dump())
    return {"classroom_id": classroom_id, "classroom_name": room.name, "schedule": schedule}
