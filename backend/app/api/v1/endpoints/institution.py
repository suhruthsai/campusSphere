"""
Institution records: student progression and achievements, yearly facility / library / ICT / finance figures and
audits, and meetings of statutory bodies with their decisions. NAAC criteria 4-7; NBA 1, 4.5-4.6, 6, 9-10.

  who records   admins, the Principal, the IQAC Coordinator and criterion in-charges (4 for facilities, 5 for
                progression, 6 for meetings); a programme's HOD / NBA coordinator for that programme's progression
                and its BoS / DAB / PAC meetings
  who sees      the accreditation workspace's people
"""
from collections import Counter, defaultdict
from datetime import date
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.accreditation import workspace as W
from backend.app.core.security import get_current_user
from backend.app.db.session import get_db
from backend.app.models.institution import InstitutionStatModel, MeetingModel, StudentAchievementModel
from backend.app.student_services.workflow import academic_year

router = APIRouter()

# Yearly figures: key -> (label, unit, NAAC / NBA metric it feeds, group)
KEYS = {
    "expenditure_total":     ("Expenditure excluding salary (₹ lakh)", "lakh", "EP4.2", "finance"),
    "infra_augmentation":    ("Infrastructure augmentation, excluding salary (₹ lakh)", "lakh", "4.1.2", "finance"),
    "maintenance":           ("Maintenance of physical and academic facilities (₹ lakh)", "lakh", "4.4.1", "finance"),
    "library_books_spend":   ("Books and journals purchased (₹ lakh)", "lakh", "4.2.3", "library"),
    "library_eresources":    ("E-resources subscribed (e-journals, e-books, databases)", "count", "4.2.2", "library"),
    "library_footfall":      ("Library users per day (students and teachers)", "count", "4.2.4", "library"),
    "library_volumes":       ("Library volumes", "count", "10.4", "library"),
    "computers":             ("Computers for students", "count", "4.3.2", "ict"),
    "bandwidth_mbps":        ("Internet bandwidth (Mbps)", "mbps", "4.3.3", "ict"),
    "smart_rooms":           ("ICT-enabled classrooms and seminar halls", "count", "4.3.1", "ict"),
    "green_audit":           ("Green / energy / environment audit done", "yes_no", "7.1.6", "audits"),
    "gender_audit":          ("Gender audit done", "yes_no", "7.1.1", "audits"),
    "solar_kw":              ("Solar capacity installed (kW)", "count", "7.1.2", "audits"),
    "rainwater_harvesting":  ("Rainwater harvesting in place", "yes_no", "7.1.4", "audits"),
}
BODIES = {"iqac": "IQAC", "bos": "Board of Studies", "academic_council": "Academic Council", "governing_body": "Governing Body",
          "finance": "Finance Committee", "dab": "Department Advisory Board", "pac": "Programme Assessment Committee",
          "anti_ragging": "Anti-ragging Committee", "grievance": "Grievance Redressal Committee", "icc": "Internal Complaints Committee"}
PER_PROGRAMME = ("bos", "dab", "pac")


def _access(db: Session, current: dict, programme: Optional[str] = None, criterion: Optional[str] = None) -> dict:
    a = W.access(db, current)
    manage = a["edit_all"] or (criterion in a["criteria"]) or (programme is not None and programme in a["programmes"])
    return {"manage": manage, "view": a["view"] or manage}


def _need(db, current, programme=None, criterion=None, what="manage"):
    a = _access(db, current, programme, criterion)
    if not a[what]:
        raise HTTPException(status_code=403, detail="Only the IQAC, the criterion in-charge and the programme's HOD / NBA coordinator")
    return a


# ── Progression and achievements ─────────────────────────────────────────────────
Kind = Literal["higher_studies", "exam", "startup", "award", "event", "alumni_contribution"]


def _ach_out(a: StudentAchievementModel) -> dict:
    return {"id": a.id, "kind": a.kind, "programme": a.programme, "year": a.year, "roll_no": a.roll_no, "student_name": a.student_name,
            "title": a.title, "level": a.level, "category": a.category, "participants": a.participants, "amount_lakh": a.amount_lakh,
            "on_date": a.on_date.isoformat() if a.on_date else None, "link": a.link}


@router.get("/achievements", summary="Progression and achievements (filter by programme, year, kind)")
def achievements(programme: Optional[str] = None, year: Optional[str] = None, kind: Optional[Kind] = None,
                 db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _need(db, current, (programme or "").upper() or None, "5", "view")
    q = db.query(StudentAchievementModel)
    if programme:
        q = q.filter((StudentAchievementModel.programme == programme.upper()) | (StudentAchievementModel.programme.is_(None)))
    if year:
        q = q.filter(StudentAchievementModel.year == year)
    if kind:
        q = q.filter(StudentAchievementModel.kind == kind)
    return [_ach_out(a) for a in q.order_by(StudentAchievementModel.year.desc(), StudentAchievementModel.kind).limit(800)]


class AchievementIn(BaseModel):
    kind: Kind
    programme: Optional[str] = Field(None, max_length=20)
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    roll_no: Optional[str] = Field(None, max_length=30)
    student_name: Optional[str] = Field(None, max_length=120)
    title: str = Field(..., min_length=3, max_length=300)
    level: Optional[Literal["college", "state", "national", "international"]] = None
    category: Optional[Literal["sports", "cultural", "technical"]] = None
    participants: Optional[int] = Field(None, ge=0, le=100000)
    amount_lakh: Optional[float] = Field(None, ge=0, le=100000)
    on_date: Optional[date] = None
    link: Optional[str] = Field(None, pattern=r"^https?://", max_length=600)


@router.post("/achievements", summary="Record a progression / achievement / event")
def add_achievement(body: AchievementIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = (body.programme or "").upper() or None
    _need(db, current, prog, "5")
    if body.kind in ("higher_studies", "exam", "startup") and not (prog and (body.roll_no or body.student_name)):
        raise HTTPException(status_code=422, detail="Give the programme and the student")
    if body.kind == "award" and not (body.level and body.category):
        raise HTTPException(status_code=422, detail="Give the award's level and category")
    if body.kind == "alumni_contribution" and body.amount_lakh is None:
        raise HTTPException(status_code=422, detail="Give the amount (₹ lakh)")
    a = StudentAchievementModel(**body.model_dump(exclude={"programme"}), programme=prog, created_by=current["sub"])
    db.add(a)
    db.commit()
    return _ach_out(a)


@router.delete("/achievements/{item_id}", summary="Delete a progression / achievement record")
def delete_achievement(item_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = db.get(StudentAchievementModel, item_id)
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    _need(db, current, a.programme, "5")
    db.delete(a)
    db.commit()
    return {"message": "Deleted"}


# ── Yearly figures ───────────────────────────────────────────────────────────────
@router.get("/stats", summary="Yearly facility, library, ICT, finance and audit figures")
def stats(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _need(db, current, None, "4", "view")
    rows = db.query(InstitutionStatModel).all()
    years = sorted({r.year for r in rows} | {academic_year()})
    vals = {(r.key, r.year): (r.value if r.value is not None else r.text) for r in rows}
    return {"keys": [{"key": k, "label": v[0], "unit": v[1], "metric": v[2], "group": v[3]} for k, v in KEYS.items()],
            "years": years, "values": {f"{k}|{y}": vals[(k, y)] for (k, y) in vals}}


class StatIn(BaseModel):
    key: str = Field(..., max_length=40)
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    value: Optional[float] = Field(None, ge=0, le=1e9)
    text: Optional[str] = Field(None, max_length=300)


@router.put("/stats", summary="Set a yearly figure (Criterion 4 in-charge / IQAC)")
def set_stat(body: StatIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _need(db, current, None, "4")
    if body.key not in KEYS:
        raise HTTPException(status_code=422, detail="Unknown figure")
    unit = KEYS[body.key][1]
    if unit == "yes_no" and body.text not in ("yes", "no"):
        raise HTTPException(status_code=422, detail="Answer yes or no")
    if unit != "yes_no" and body.value is None:
        raise HTTPException(status_code=422, detail="Give a number")
    r = db.query(InstitutionStatModel).filter(InstitutionStatModel.key == body.key, InstitutionStatModel.year == body.year).first() or \
        InstitutionStatModel(key=body.key, year=body.year)
    r.value, r.text, r.updated_by = (None if unit == "yes_no" else body.value), (body.text if unit == "yes_no" else None), current["sub"]
    db.add(r)
    db.commit()
    return {"message": "Saved"}


# ── Meetings ─────────────────────────────────────────────────────────────────────
class Decision(BaseModel):
    text: str = Field(..., min_length=3, max_length=500)
    owner: Optional[str] = Field(None, max_length=120)
    status: Literal["open", "done"] = "open"


def _meeting_out(m: MeetingModel) -> dict:
    d = m.decisions or []
    return {"id": m.id, "body": m.body, "body_label": BODIES.get(m.body, m.body), "programme": m.programme,
            "held_on": m.held_on.isoformat(), "year": m.year, "attendees": m.attendees, "agenda": m.agenda, "decisions": d,
            "done": sum(1 for x in d if x.get("status") == "done"), "minutes": m.minutes}


@router.get("/meetings", summary="Meetings of statutory bodies and committees")
def meetings(body: Optional[str] = None, year: Optional[str] = None, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _need(db, current, None, "6", "view")
    q = db.query(MeetingModel)
    if body:
        q = q.filter(MeetingModel.body == body)
    if year:
        q = q.filter(MeetingModel.year == year)
    return {"bodies": BODIES, "meetings": [_meeting_out(m) for m in q.order_by(MeetingModel.held_on.desc()).limit(400)]}


class MeetingIn(BaseModel):
    body: Literal["iqac", "bos", "academic_council", "governing_body", "finance", "dab", "pac", "anti_ragging", "grievance", "icc"]
    programme: Optional[str] = Field(None, max_length=20)
    held_on: date
    attendees: Optional[int] = Field(None, ge=1, le=500)
    agenda: Optional[str] = Field(None, max_length=3000)
    decisions: List[Decision] = []
    minutes: Optional[str] = Field(None, pattern=r"^https?://", max_length=600)


def _year_of(d: date) -> str:
    y = d.year if d.month >= 7 else d.year - 1
    return f"{y}-{(y + 1) % 100:02d}"


@router.post("/meetings", summary="Record a meeting with its decisions")
def add_meeting(body: MeetingIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = (body.programme or "").upper() or None
    if body.body in PER_PROGRAMME and not prog:
        raise HTTPException(status_code=422, detail=f"A {BODIES[body.body]} meeting belongs to a programme")
    _need(db, current, prog if body.body in PER_PROGRAMME else None, "6")
    m = MeetingModel(body=body.body, programme=prog, held_on=body.held_on, year=_year_of(body.held_on), attendees=body.attendees,
                     agenda=body.agenda, decisions=[d.model_dump() for d in body.decisions], minutes=body.minutes, created_by=current["sub"])
    db.add(m)
    db.commit()
    return _meeting_out(m)


class DecisionStatus(BaseModel):
    index: int = Field(..., ge=0)
    status: Literal["open", "done"]


@router.patch("/meetings/{meeting_id}", summary="Mark a decision done (or reopen it)")
def set_decision(meeting_id: int, body: DecisionStatus, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    m = db.get(MeetingModel, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Not found")
    _need(db, current, m.programme if m.body in PER_PROGRAMME else None, "6")
    d = [dict(x) for x in (m.decisions or [])]
    if body.index >= len(d):
        raise HTTPException(status_code=422, detail="No such decision")
    d[body.index]["status"] = body.status
    m.decisions = d
    db.commit()
    return _meeting_out(m)


# ── Summary for the accreditation report ─────────────────────────────────────────
def progression_summary(db: Session, programme: str, year: str, outgoing: Optional[int]) -> dict:
    rows = db.query(StudentAchievementModel).filter(StudentAchievementModel.year == year).all()
    mine = [a for a in rows if a.programme == programme]
    k = Counter(a.kind for a in mine)
    awards = [a for a in rows if a.kind == "award" and (a.programme in (None, programme))]
    return {"year": year, "higher_studies": k["higher_studies"], "exams": k["exam"], "startups": k["startup"],
            "higher_studies_pct": round(100 * k["higher_studies"] / outgoing, 1) if outgoing else None,
            "exams_pct": round(100 * k["exam"] / outgoing, 1) if outgoing else None,
            "awards": len(awards), "awards_by_level": dict(Counter(a.level for a in awards)),
            "events": sum(1 for a in rows if a.kind == "event"),
            "alumni_lakh": round(sum(a.amount_lakh or 0 for a in rows if a.kind == "alumni_contribution"), 2)}


def governance_summary(db: Session, year: str) -> dict:
    ms = db.query(MeetingModel).filter(MeetingModel.year == year).all()
    by = Counter(m.body for m in ms)
    decisions = [d for m in ms for d in (m.decisions or [])]
    return {"year": year, "meetings": len(ms), "by_body": dict(by), "decisions": len(decisions),
            "done": sum(1 for d in decisions if d.get("status") == "done"),
            "with_minutes": sum(1 for m in ms if m.minutes)}


def stat(db: Session, key: str, year: str):
    r = db.query(InstitutionStatModel).filter(InstitutionStatModel.key == key, InstitutionStatModel.year == year).first()
    return (r.value if r.value is not None else r.text) if r else None
