from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from backend.app.db.session import get_db
from backend.app.models.campus import AnnouncementModel

router = APIRouter()


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    author_id: Optional[str] = None
    department: Optional[str] = None
    priority: str = "normal"
    expires_at: Optional[datetime] = None


@router.get("/", summary="List active announcements")
def list_announcements(
    department: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    active_only: bool = Query(True),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    q = db.query(AnnouncementModel)
    if active_only: q = q.filter(AnnouncementModel.is_active == True)
    if department:  q = q.filter(
        (AnnouncementModel.department == department) | (AnnouncementModel.department == None)
    )
    if priority:    q = q.filter(AnnouncementModel.priority == priority)
    return q.order_by(AnnouncementModel.created_at.desc()).limit(limit).all()


@router.post("/", summary="Post a new announcement")
def create_announcement(ann: AnnouncementCreate, db: Session = Depends(get_db)):
    db_ann = AnnouncementModel(**ann.dict())
    db.add(db_ann)
    db.commit()
    db.refresh(db_ann)
    return db_ann


@router.patch("/{ann_id}/deactivate", summary="Deactivate an announcement")
def deactivate_announcement(ann_id: int, db: Session = Depends(get_db)):
    ann = db.query(AnnouncementModel).filter(AnnouncementModel.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    ann.is_active = False
    db.commit()
    return {"message": "Announcement deactivated"}


@router.delete("/{ann_id}", summary="Delete an announcement")
def delete_announcement(ann_id: int, db: Session = Depends(get_db)):
    ann = db.query(AnnouncementModel).filter(AnnouncementModel.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(ann)
    db.commit()
    return {"message": "Deleted"}
