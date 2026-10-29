"""
Faculty and research: service records, research items each teacher reports (with evidence) and the HOD / IQAC
verifies, department activities (MoUs, extension, collaborations, IPR workshops), and the yearly NBA criterion 5 /
NAAC 2.4, 3, 6.3 figures.

  a teacher         adds, edits and deletes their own unverified items; attaches evidence
  manages           admins, the Principal, the IQAC Coordinator, criterion 3 in-charges, and the programme's HOD /
                    NBA coordinator: service records, verification, activities
  sees              the accreditation workspace's people (management, NBA coordinators, HODs)
"""
from datetime import date, datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.accreditation import workspace as W
from backend.app.attendance.core import faculty_profile
from backend.app.core.security import get_current_user
from backend.app.db.session import get_db
from backend.app.models.research import DeptActivityModel, FacultyRecordModel, ResearchItemModel
from backend.app.research import summary as S
from backend.app.student_services.workflow import academic_year

router = APIRouter()
KINDS = ("journal", "conference", "book", "chapter", "patent", "project", "consultancy", "fdp_attended",
         "fdp_organised", "resource_person", "phd_guided", "award")
Kind = Literal["journal", "conference", "book", "chapter", "patent", "project", "consultancy", "fdp_attended",
               "fdp_organised", "resource_person", "phd_guided", "award"]


def _access(db: Session, current: dict, programme: Optional[str] = None) -> dict:
    a = W.access(db, current)
    manage = a["edit_all"] or "3" in a["criteria"] or (programme is not None and programme in a["programmes"])
    return {"manage": manage, "view": a["view"] or manage, "programmes": a["programmes"], "all": a["edit_all"] or "3" in a["criteria"]}


def _need(db, current, programme, what="manage"):
    a = _access(db, current, programme)
    if not a[what]:
        raise HTTPException(status_code=403, detail="Only the IQAC, the Criterion 3 in-charge and the department's HOD / NBA coordinator")
    return a


def my_record(db: Session, current: dict) -> Optional[FacultyRecordModel]:
    prof = faculty_profile(db, current)
    if not prof:
        return None
    return db.query(FacultyRecordModel).filter(FacultyRecordModel.profile_id == prof.id).first()


def _record_out(r: FacultyRecordModel, counts: Optional[dict] = None) -> dict:
    return {"id": r.id, "profile_id": r.profile_id, "name": r.name, "department": r.department, "designation": r.designation,
            "qualification": r.qualification, "phd_year": r.phd_year, "specialisation": r.specialisation, "nature": r.nature,
            "joined_on": r.joined_on.isoformat(), "left_on": r.left_on.isoformat() if r.left_on else None,
            "prior_experience": r.prior_experience, "industry_experience": r.industry_experience, "net_set": r.net_set,
            "research_guide": r.research_guide, "experience_now": round(S.experience(r, academic_year()), 1), **(counts or {})}


def _item_out(i: ResearchItemModel, names: Optional[dict] = None) -> dict:
    return {"id": i.id, "faculty_id": i.faculty_id, "faculty": (names or {}).get(i.faculty_id), "department": i.department,
            "kind": i.kind, "title": i.title, "venue": i.venue, "indexing": i.indexing, "year": i.year,
            "on_date": i.on_date.isoformat() if i.on_date else None, "amount_lakh": i.amount_lakh, "status": i.status,
            "days": i.days, "link": i.link, "has_evidence": bool(i.evidence or i.link), "evidence_name": i.evidence_name,
            "verified": i.verified, "verified_at": i.verified_at.isoformat() if i.verified_at else None}


@router.get("/access", summary="What I can do in Faculty & research")
def access(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    rec = my_record(db, current)
    return {**_access(db, current), "my_record": rec.id if rec else None}


# ── Service records ──────────────────────────────────────────────────────────────
@router.get("/faculty", summary="A department's faculty service records with their verified research counts")
def faculty(programme: str = Query("IT", max_length=20), include_former: bool = False, db: Session = Depends(get_db),
            current: dict = Depends(get_current_user)):
    prog = programme.upper()
    _need(db, current, prog, "view")
    q = db.query(FacultyRecordModel).filter(FacultyRecordModel.department == prog)
    if not include_former:
        q = q.filter(FacultyRecordModel.left_on.is_(None))
    rows = q.order_by(FacultyRecordModel.designation, FacultyRecordModel.name).all()
    counts = {}
    for fid, kind, verified in db.query(ResearchItemModel.faculty_id, ResearchItemModel.kind, ResearchItemModel.verified).filter(
            ResearchItemModel.faculty_id.in_([r.id for r in rows])):
        c = counts.setdefault(fid, {"items": 0, "unverified": 0, "journals": 0})
        c["items"] += 1
        c["unverified"] += not verified
        c["journals"] += kind == "journal" and verified
    order = {"Professor": 0, "Associate Professor": 1, "Assistant Professor": 2}
    return sorted((_record_out(r, counts.get(r.id, {"items": 0, "unverified": 0, "journals": 0})) for r in rows),
                  key=lambda x: (order.get(x["designation"], 3), x["name"]))


class RecordIn(BaseModel):
    id: Optional[int] = None
    profile_id: Optional[str] = Field(None, max_length=40)
    name: str = Field(..., min_length=2, max_length=120)
    department: str = Field(..., max_length=20)
    designation: Literal["Professor", "Associate Professor", "Assistant Professor"]
    qualification: Literal["PhD", "M.Tech", "M.E", "M.Sc", "MBA", "MCA", "Other"]
    phd_year: Optional[int] = Field(None, ge=1960, le=2100)
    specialisation: Optional[str] = Field(None, max_length=120)
    nature: Literal["regular", "contract", "visiting", "adjunct"] = "regular"
    joined_on: date
    left_on: Optional[date] = None
    prior_experience: float = Field(0, ge=0, le=60)
    industry_experience: float = Field(0, ge=0, le=60)
    net_set: bool = False
    research_guide: bool = False


@router.put("/faculty", summary="Add or update a faculty service record")
def save_record(body: RecordIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = body.department.upper()
    _need(db, current, prog)
    if body.left_on and body.left_on < body.joined_on:
        raise HTTPException(status_code=422, detail="Leaving date before joining date")
    if body.qualification == "PhD" and not body.phd_year:
        raise HTTPException(status_code=422, detail="Give the year the PhD was awarded")
    r = db.get(FacultyRecordModel, body.id) if body.id else None
    if body.id and not r:
        raise HTTPException(status_code=404, detail="Record not found")
    if body.profile_id:
        other = db.query(FacultyRecordModel).filter(FacultyRecordModel.profile_id == body.profile_id).first()
        if other and (not r or other.id != r.id):
            raise HTTPException(status_code=409, detail="That faculty member already has a record")
    r = r or FacultyRecordModel()
    for k, v in body.model_dump(exclude={"id"}).items():
        setattr(r, k, v)
    r.department, r.updated_by = prog, current["sub"]
    db.add(r)
    db.commit()
    return _record_out(r)


# ── Research items ───────────────────────────────────────────────────────────────
@router.get("/items", summary="Research items of a department (filter by year, kind, faculty, verification)")
def items(programme: str = Query("IT", max_length=20), year: Optional[str] = None, kind: Optional[Kind] = None,
          faculty_id: Optional[int] = None, verified: Optional[bool] = None, db: Session = Depends(get_db),
          current: dict = Depends(get_current_user)):
    prog = programme.upper()
    a = _need(db, current, prog, "view")
    q = db.query(ResearchItemModel).filter(ResearchItemModel.department == prog)
    for col, v in ((ResearchItemModel.year, year), (ResearchItemModel.kind, kind), (ResearchItemModel.faculty_id, faculty_id),
                   (ResearchItemModel.verified, verified)):
        if v is not None:
            q = q.filter(col == v)
    rows = q.order_by(ResearchItemModel.year.desc(), ResearchItemModel.kind, ResearchItemModel.id.desc()).limit(500).all()
    names = {r.id: r.name for r in db.query(FacultyRecordModel).filter(FacultyRecordModel.id.in_({i.faculty_id for i in rows}))}
    return {"items": [_item_out(i, names) for i in rows], "can_verify": a["manage"]}


@router.get("/mine", summary="My service record and research items")
def mine(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    rec = my_record(db, current)
    if not rec:
        return {"record": None, "items": [], "reason": "Your account isn't linked to a faculty service record yet: ask your HOD."}
    rows = db.query(ResearchItemModel).filter(ResearchItemModel.faculty_id == rec.id).order_by(ResearchItemModel.year.desc(), ResearchItemModel.id.desc()).all()
    return {"record": _record_out(rec), "items": [_item_out(i) for i in rows]}


class ItemIn(BaseModel):
    faculty_id: Optional[int] = None                 # others' items: managers only
    kind: Kind
    title: str = Field(..., min_length=3, max_length=300)
    venue: Optional[str] = Field(None, max_length=200)
    indexing: Optional[Literal["scopus", "wos", "ugc_care", "other"]] = None
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    on_date: Optional[date] = None
    amount_lakh: Optional[float] = Field(None, ge=0, le=100000)
    status: Optional[Literal["published", "accepted", "filed", "published_patent", "granted", "sanctioned", "ongoing", "completed", "awarded"]] = None
    days: Optional[int] = Field(None, ge=1, le=365)
    link: Optional[str] = Field(None, pattern=r"^https?://", max_length=600)


def _owner_or_manager(db: Session, current: dict, faculty_id: int) -> FacultyRecordModel:
    rec = db.get(FacultyRecordModel, faculty_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Faculty record not found")
    mine = my_record(db, current)
    if not (mine and mine.id == rec.id) and not _access(db, current, rec.department)["manage"]:
        raise HTTPException(status_code=403, detail="You can add items only to your own record")
    return rec


@router.post("/items", summary="Report a research item (my own, or anyone's for those who manage)")
def add_item(body: ItemIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    fid = body.faculty_id or (my_record(db, current).id if my_record(db, current) else None)
    if not fid:
        raise HTTPException(status_code=400, detail="Your account isn't linked to a faculty service record yet")
    rec = _owner_or_manager(db, current, fid)
    if body.kind == "journal" and not body.indexing:
        raise HTTPException(status_code=422, detail="Say where the journal is indexed (Scopus, Web of Science, UGC-CARE or other)")
    if body.kind in ("project", "consultancy") and not body.amount_lakh:
        raise HTTPException(status_code=422, detail="Give the amount (₹ lakh)")
    i = ResearchItemModel(**body.model_dump(exclude={"faculty_id"}), faculty_id=rec.id, department=rec.department, created_by=current["sub"])
    db.add(i)
    db.commit()
    return _item_out(i)


def _item(db: Session, item_id: int) -> ResearchItemModel:
    i = db.get(ResearchItemModel, item_id)
    if not i:
        raise HTTPException(status_code=404, detail="Item not found")
    return i


@router.post("/items/{item_id}/evidence", summary="Attach evidence (PDF / image / Word / Excel)")
def item_evidence(item_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    i = _item(db, item_id)
    _owner_or_manager(db, current, i.faculty_id)
    if i.verified:
        raise HTTPException(status_code=409, detail="Verified items are frozen")
    try:
        saved = W.save_evidence_file(file)
    except W.EvidenceError as e:
        raise HTTPException(status_code=422, detail=str(e))
    i.evidence, i.evidence_name = saved["filename"], (file.filename or "")[:200]
    db.commit()
    return _item_out(i)


@router.get("/items/{item_id}/evidence", summary="Open an item's evidence file")
def item_evidence_file(item_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    i = _item(db, item_id)
    mine = my_record(db, current)
    if not (mine and mine.id == i.faculty_id) and not _access(db, current, i.department)["view"]:
        raise HTTPException(status_code=403, detail="Not yours to see")
    if not i.evidence:
        raise HTTPException(status_code=404, detail="No file attached")
    path = W.evidence_path(i.evidence)
    if not path.exists():
        raise HTTPException(status_code=410, detail="The file is no longer available")
    return FileResponse(path, filename=i.evidence_name or i.evidence, headers={"Cache-Control": "private, no-store"})


@router.delete("/items/{item_id}", summary="Delete an unverified item")
def delete_item(item_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    i = _item(db, item_id)
    _owner_or_manager(db, current, i.faculty_id)
    if i.verified and not _access(db, current, i.department)["manage"]:
        raise HTTPException(status_code=409, detail="Verified items can be removed only by the HOD / IQAC")
    db.delete(i)
    db.commit()
    return {"message": "Deleted"}


class VerifyIn(BaseModel):
    verified: bool = True


@router.post("/items/{item_id}/verify", summary="Verify an item against its evidence (HOD / IQAC)")
def verify(item_id: int, body: VerifyIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    i = _item(db, item_id)
    _need(db, current, i.department)
    if body.verified and not (i.evidence or i.link):
        raise HTTPException(status_code=400, detail="Attach the evidence (file or DOI / link) before verifying")
    i.verified = body.verified
    i.verified_by, i.verified_at = (current["sub"], datetime.utcnow()) if body.verified else (None, None)
    db.commit()
    return _item_out(i)


# ── Department activities ────────────────────────────────────────────────────────
def _activity_out(a: DeptActivityModel) -> dict:
    return {"id": a.id, "kind": a.kind, "department": a.department, "title": a.title, "partner": a.partner, "year": a.year,
            "on_date": a.on_date.isoformat() if a.on_date else None, "valid_until": a.valid_until.isoformat() if a.valid_until else None,
            "participants": a.participants, "description": a.description, "link": a.link}


@router.get("/activities", summary="MoUs, extension programmes, collaborations and IPR workshops")
def activities(programme: Optional[str] = Query(None, max_length=20), year: Optional[str] = None, db: Session = Depends(get_db),
               current: dict = Depends(get_current_user)):
    _need(db, current, (programme or "").upper() or None, "view")
    q = db.query(DeptActivityModel)
    if programme:
        q = q.filter((DeptActivityModel.department == programme.upper()) | (DeptActivityModel.department.is_(None)))
    if year:
        q = q.filter(DeptActivityModel.year == year)
    return [_activity_out(a) for a in q.order_by(DeptActivityModel.year.desc(), DeptActivityModel.kind).all()]


class ActivityIn(BaseModel):
    kind: Literal["mou", "extension", "collaboration", "ipr_workshop"]
    department: Optional[str] = Field(None, max_length=20)
    title: str = Field(..., min_length=3, max_length=300)
    partner: Optional[str] = Field(None, max_length=200)
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    on_date: Optional[date] = None
    valid_until: Optional[date] = None
    participants: Optional[int] = Field(None, ge=0, le=100000)
    description: Optional[str] = Field(None, max_length=2000)
    link: Optional[str] = Field(None, pattern=r"^https?://", max_length=600)


@router.post("/activities", summary="Record a department / college activity")
def add_activity(body: ActivityIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    dept = (body.department or "").upper() or None
    a = _need(db, current, dept)
    if not dept and not a["all"]:
        raise HTTPException(status_code=403, detail="College-wide activities are for the IQAC and the Criterion 3 in-charge")
    if body.kind == "mou" and not body.partner:
        raise HTTPException(status_code=422, detail="Name the MoU partner")
    row = DeptActivityModel(**body.model_dump(exclude={"department"}), department=dept, created_by=current["sub"])
    db.add(row)
    db.commit()
    return _activity_out(row)


@router.delete("/activities/{activity_id}", summary="Delete an activity")
def delete_activity(activity_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = db.get(DeptActivityModel, activity_id)
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    _need(db, current, a.department)
    db.delete(a)
    db.commit()
    return {"message": "Deleted"}


# ── Summary ──────────────────────────────────────────────────────────────────────
@router.get("/summary", summary="Yearly NBA criterion 5 and NAAC 2.4 / 3 / 6.3 figures for a department")
def summary(programme: str = Query("IT", max_length=20), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = programme.upper()
    _need(db, current, prog, "view")
    current_year = academic_year()
    y0 = int(current_year[:4])
    years = [f"{y}-{(y + 1) % 100:02d}" for y in range(y0 - 5, y0 + 1)]
    return {"programme": prog, "current_year": current_year, "years": [S.year_summary(db, prog, y) for y in years]}
