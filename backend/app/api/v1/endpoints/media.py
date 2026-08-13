from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os, shutil, uuid

from backend.app.db.session import get_db
from backend.app.models.campus import RoomMediaModel

router = APIRouter()

MEDIA_DIR = "media_uploads"
os.makedirs(MEDIA_DIR, exist_ok=True)


@router.get("/{building_id}", summary="Get all media for a building")
def get_building_media(building_id: str, db: Session = Depends(get_db)):
    items = db.query(RoomMediaModel).filter(RoomMediaModel.building_id == building_id).all()
    return items


@router.get("/{building_id}/{room_label}", summary="Get media for a specific room")
def get_room_media(building_id: str, room_label: str, db: Session = Depends(get_db)):
    items = db.query(RoomMediaModel).filter(
        RoomMediaModel.building_id == building_id,
        RoomMediaModel.room_label == room_label
    ).all()
    return items


@router.post("/{building_id}", summary="Upload media for a room")
def upload_room_media(
    building_id: str,
    room_label: str = Form(...),
    floor: str = Form(...),
    media_type: str = Form(...),
    caption: Optional[str] = Form(None),
    uploaded_by: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Save file to disk
    ext = os.path.splitext(file.filename)[-1]
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(MEDIA_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    media = RoomMediaModel(
        building_id=building_id,
        room_label=room_label,
        floor=floor,
        media_type=media_type,
        url=f"/media/{filename}",
        caption=caption,
        uploaded_by=uploaded_by,
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


@router.delete("/{media_id}", summary="Delete a media item")
def delete_media(media_id: int, db: Session = Depends(get_db)):
    item = db.query(RoomMediaModel).filter(RoomMediaModel.id == media_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    db.delete(item)
    db.commit()
    return {"message": "Deleted successfully"}
