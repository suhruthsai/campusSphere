from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os, uuid

from backend.app.db.session import get_db
from backend.app.core.security import require_admin, require_staff, get_current_user
from backend.app.models.campus import RoomMediaModel

router = APIRouter()

MEDIA_DIR = "media_uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm"}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB
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
    db: Session = Depends(get_db),
    _staff: dict = Depends(require_staff),
):
    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    uploaded_by = _staff["name"]

    # Save file to disk (random name, so the client cannot choose the path)
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(MEDIA_DIR, filename)
    written = 0
    with open(filepath, "wb") as f:
        while chunk := file.file.read(1024 * 1024):
            written += len(chunk)
            if written > MAX_UPLOAD_BYTES:
                f.close()
                os.remove(filepath)
                raise HTTPException(status_code=413, detail="File too large (max 25 MB)")
            f.write(chunk)

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
def delete_media(media_id: int, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    item = db.query(RoomMediaModel).filter(RoomMediaModel.id == media_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    db.delete(item)
    db.commit()
    return {"message": "Deleted successfully"}
