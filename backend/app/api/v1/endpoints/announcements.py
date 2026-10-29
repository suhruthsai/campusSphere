"""
Notices: everyone reads the ones meant for them; who may post depends on what they hold.

  read   a student sees notices for everyone or for students, of their department / year / section (or
         college-wide); staff see notices for everyone or for staff (college-wide or their department);
         admins see everything.
  post   admin or Principal: anyone · HOD: their department (students, staff or both) · faculty: students
         of a year (and section) in their own department · Admin Office: anyone (office notices).
"""
from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.roles import user_roles
from backend.app.core.security import get_current_user, require_admin, require_staff
from backend.app.db.session import get_db
from backend.app.models.campus import AnnouncementModel, UserModel
from backend.app.models.services import StudentProfileModel

router = APIRouter()

Audience = Literal["all", "students", "staff"]


class NoticeIn(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    body: str = Field(..., min_length=3, max_length=2000)
    audience: Audience = "all"
    department: Optional[str] = Field(None, max_length=30)
    year: Optional[int] = Field(None, ge=1, le=4)
    section: Optional[str] = Field(None, max_length=5)
    priority: Literal["normal", "urgent", "info"] = "normal"
    days: Optional[int] = Field(None, ge=1, le=365)     # show for this many days (None = until taken down)


def _up(v) -> Optional[str]:
    v = (v or "").strip().upper()
    return v or None


def serialize(a: AnnouncementModel) -> dict:
    who = {"all": "Everyone", "students": "Students", "staff": "Staff"}[a.audience or "all"]
    scope = " · ".join(x for x in [a.department or "Whole college", f"Year {a.year}" if a.year else None,
                                   f"Section {a.section}" if a.section else None] if x)
    return {"id": a.id, "title": a.title, "body": a.body, "priority": a.priority or "normal",
            "audience": a.audience or "all", "department": a.department, "year": a.year, "section": a.section,
            "for": f"{who} · {scope}", "author_id": a.author_id, "author_name": a.author_name,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None, "is_active": a.is_active}


def _live(db: Session):
    now = datetime.utcnow()
    return [a for a in db.query(AnnouncementModel).filter(AnnouncementModel.is_active == True).all()
            if not a.expires_at or a.expires_at > now]


def for_viewer(db: Session, current: dict) -> list:
    """Live notices meant for this person, urgent first, then newest."""
    role = current.get("role")
    notices = _live(db)
    if role != "admin":
        if role == "student":
            p = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
            dept, year, sec = _up(p.department) if p else None, p.year if p else None, _up(p.section) if p else None
            ok = lambda a: ((a.audience or "all") in ("all", "students")
                            and (not a.department or _up(a.department) == dept)
                            and (not a.year or a.year == year) and (not a.section or _up(a.section) == sec))
        else:
            user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
            dept = _up(user.department) if user else None
            ok = lambda a: (a.audience or "all") in ("all", "staff") and (not a.department or _up(a.department) == dept)
        notices = [a for a in notices if ok(a)]
    notices.sort(key=lambda a: (a.priority != "urgent", -(a.created_at or datetime.min).timestamp()))
    return notices


def posting_rights(db: Session, current: dict) -> dict:
    """What this person may post, for the form and for the checks."""
    role = current.get("role")
    r = user_roles(db, current)
    if role == "admin" or r["principal"] or role == "staff":
        return {"allowed": True, "audiences": ["all", "students", "staff"], "departments": None, "need_year": False}
    if r["hod"]:
        return {"allowed": True, "audiences": ["all", "students", "staff"], "departments": r["hod_departments"], "need_year": False}
    if role == "faculty":
        user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
        dept = _up(user.department) if user else None
        return {"allowed": bool(dept), "audiences": ["students"], "departments": [dept] if dept else [], "need_year": True}
    return {"allowed": False, "audiences": [], "departments": [], "need_year": False}


@router.get("/mine", summary="Notices meant for me (urgent first)")
def my_notices(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    return [serialize(a) for a in for_viewer(db, current)]


@router.get("/can-post", summary="Whether and where I may post notices")
def can_post(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    return posting_rights(db, current)


@router.get("/posted", summary="Notices I posted (admins: all), including expired and taken down")
def posted(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    q = db.query(AnnouncementModel)
    if current.get("role") != "admin":
        q = q.filter(AnnouncementModel.author_id == current["sub"])
    return [serialize(a) for a in q.order_by(AnnouncementModel.created_at.desc()).limit(100).all()]


@router.get("/", summary="All active notices (staff and admins; students use /mine)")
def list_announcements(
    department: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _staff: dict = Depends(require_staff),
):
    rows = _live(db)
    if department:
        rows = [a for a in rows if not a.department or _up(a.department) == _up(department)]
    if priority:
        rows = [a for a in rows if a.priority == priority]
    rows.sort(key=lambda a: a.created_at or datetime.min, reverse=True)
    return [serialize(a) for a in rows[:limit]]


@router.post("/", summary="Post a notice (within what I may post)")
def create_announcement(body: NoticeIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    rights = posting_rights(db, current)
    if not rights["allowed"]:
        raise HTTPException(status_code=403, detail="You can't post notices")
    if body.audience not in rights["audiences"]:
        raise HTTPException(status_code=403, detail="Faculty notices go to students of a class")
    dept = _up(body.department)
    if rights["departments"] is not None:
        if not dept and len(rights["departments"]) == 1:
            dept = rights["departments"][0]
        if dept not in rights["departments"]:
            raise HTTPException(status_code=403, detail=f"You can post to {', '.join(rights['departments'])} only")
    if rights["need_year"] and not body.year:
        raise HTTPException(status_code=422, detail="Choose the year (and section) of the class")
    if (body.year or body.section) and body.audience == "staff":
        raise HTTPException(status_code=422, detail="A year or section only applies to students")
    user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
    ann = AnnouncementModel(
        title=body.title.strip(), body=body.body.strip(), author_id=current["sub"], author_name=user.name if user else None,
        department=dept, priority=body.priority, audience=body.audience, year=body.year, section=_up(body.section),
        expires_at=datetime.utcnow() + timedelta(days=body.days) if body.days else None,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return serialize(ann)


@router.patch("/{ann_id}/deactivate", summary="Take a notice down (its author, the Principal or an admin)")
def deactivate_announcement(ann_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    ann = db.query(AnnouncementModel).filter(AnnouncementModel.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Notice not found")
    if ann.author_id != current["sub"] and current.get("role") != "admin" and not user_roles(db, current)["principal"]:
        raise HTTPException(status_code=403, detail="Only its author can take it down")
    ann.is_active = False
    db.commit()
    return {"message": "Notice taken down"}


@router.delete("/{ann_id}", summary="Delete a notice")
def delete_announcement(ann_id: int, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    ann = db.query(AnnouncementModel).filter(AnnouncementModel.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Notice not found")
    db.delete(ann)
    db.commit()
    return {"message": "Deleted"}
