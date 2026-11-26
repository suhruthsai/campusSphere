from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import mimetypes, os, uuid

from backend.app.core import storage

from backend.app.db.session import get_db
from backend.app.core.security import require_admin, require_staff
from backend.app.models.campus import RoomMediaModel

router = APIRouter()

# Files are stored under the key media/<name> (backend/app/core/storage.py: ./media_uploads locally, or the R2
# bucket) and served publicly at /media/<name> by main.py
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm"}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


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

    # Random name, so the client cannot choose the path
    filename = f"{uuid.uuid4().hex}{ext}"
    try:
        storage.save_upload(storage.key("media", filename), b"", file.file, MAX_UPLOAD_BYTES,
                            mimetypes.guess_type(filename)[0] or "application/octet-stream")
    except storage.TooLarge:
        raise HTTPException(status_code=413, detail="File too large (max 25 MB)") from None

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
