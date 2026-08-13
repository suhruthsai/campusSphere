from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from backend.app.db.session import get_db
from backend.app.models.campus import ClassroomModel, TimetableEntryModel
from backend.app.schemas.campus import ClassroomCreate, ClassroomUpdate, ClassroomOut, CurrentClassResponse, TimetableEntryOut

router = APIRouter()

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)

def _get_current_entry(classroom_id: str, db: Session, target_dt: Optional[datetime] = None):
    now = target_dt if target_dt else datetime.now()
    dow = now.weekday()  # 0=Mon, 6=Sun
    current_time = now.strftime("%H:%M")
    cur_min = _time_to_minutes(current_time)

    entries = db.query(TimetableEntryModel).filter(
        TimetableEntryModel.classroom_id == classroom_id,
        TimetableEntryModel.day_of_week == dow,
        TimetableEntryModel.is_active == True,
    ).all()

    current = None
    for e in entries:
        s = _time_to_minutes(e.start_time)
        en = _time_to_minutes(e.end_time)
        if s <= cur_min < en:
            current = e
            break
    return current, entries, dow, cur_min

def _get_next_entry(entries, cur_min, classroom_id: str, db: Session, dow: int):
    future_today = sorted(
        [e for e in entries if _time_to_minutes(e.start_time) > cur_min],
        key=lambda e: _time_to_minutes(e.start_time)
    )
    if future_today:
        return future_today[0]
    for d in range(dow + 1, 6):
        next_day = db.query(TimetableEntryModel).filter(
            TimetableEntryModel.classroom_id == classroom_id,
            TimetableEntryModel.day_of_week == d,
            TimetableEntryModel.is_active == True,
        ).order_by(TimetableEntryModel.period_number).first()
        if next_day:
            return next_day
    return None

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
def create_classroom(payload: ClassroomCreate, db: Session = Depends(get_db)):
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
def update_classroom(classroom_id: str, payload: ClassroomUpdate, db: Session = Depends(get_db)):
    room = db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(room, k, v)
    db.commit()
    db.refresh(room)
    return room

@router.delete("/{classroom_id}")
def delete_classroom(classroom_id: str, db: Session = Depends(get_db)):
    room = db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    db.delete(room)
    db.commit()
    return {"message": "Deleted"}

@router.get("/{classroom_id}/current", response_model=CurrentClassResponse)
def get_current_class(
    classroom_id: str,
    at_datetime: Optional[str] = Query(None, description="Optional ISO or HH:MM target date/time simulation"),
    db: Session = Depends(get_db)
):
    room = db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")

    target_dt = None
    if at_datetime:
        try:
            target_dt = datetime.fromisoformat(at_datetime)
        except Exception:
            try:
                # Try format YYYY-MM-DDTHH:MM or YYYY-MM-DD HH:MM
                clean_str = at_datetime.replace(' ', 'T')
                target_dt = datetime.strptime(clean_str, "%Y-%m-%dT%H:%M")
            except Exception:
                target_dt = None

    current, entries, dow, cur_min = _get_current_entry(classroom_id, db, target_dt)
    next_e = _get_next_entry(entries, cur_min, classroom_id, db, dow)

    return CurrentClassResponse(
        classroom_id=room.id,
        classroom_name=room.name,
        building=room.building,
        floor=room.floor,
        status="occupied" if current else "available",
        day_name=DAY_NAMES[dow] if dow < len(DAY_NAMES) else None,
        current_entry=TimetableEntryOut.model_validate(current) if current else None,
        next_entry=TimetableEntryOut.model_validate(next_e) if next_e else None,
    )

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
