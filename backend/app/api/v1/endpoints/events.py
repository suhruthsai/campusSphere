from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from backend.app.db.session import get_db
from backend.app.models.campus import CampusEventModel

router = APIRouter()


# ─── Pydantic schemas ──────────────────────────────────────────────────────────
class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    building_id: Optional[str] = None
    room_label: Optional[str] = None
    event_type: str = "academic"
    start_datetime: datetime
    end_datetime: datetime
    organizer: Optional[str] = None
    max_attendees: int = 100
    is_public: bool = True


# ─── Routes ────────────────────────────────────────────────────────────────────
@router.get("/", summary="List all campus events")
def list_events(
    building_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    upcoming_only: bool = Query(False),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    q = db.query(CampusEventModel)
    if building_id:  q = q.filter(CampusEventModel.building_id == building_id)
    if event_type:   q = q.filter(CampusEventModel.event_type == event_type)
    if upcoming_only:
        q = q.filter(CampusEventModel.start_datetime >= datetime.utcnow())
    return q.order_by(CampusEventModel.start_datetime.asc()).limit(limit).all()


@router.post("/", summary="Create a new campus event")
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    if event.end_datetime <= event.start_datetime:
        raise HTTPException(status_code=400, detail="end_datetime must be after start_datetime")
    db_event = CampusEventModel(**event.dict())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.get("/{event_id}", summary="Get a specific event")
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(CampusEventModel).filter(CampusEventModel.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.put("/{event_id}", summary="Update a campus event")
def update_event(event_id: int, updates: EventCreate, db: Session = Depends(get_db)):
    event = db.query(CampusEventModel).filter(CampusEventModel.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in updates.dict(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", summary="Delete a campus event")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(CampusEventModel).filter(CampusEventModel.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"message": "Event deleted"}
