"""
Placements: the Placement Cell posts drives (jobs for the final year, internships for the pre-final year), students
register before the deadline, and the Cell records each round's results. Offers per batch feed the placement report
and NAAC 5.2 / NBA criterion 4.

  who may apply  the drive's branches and passing-out batch (from the roll number: 2451-23-... passes out in 2027),
                 registrations open; one-offer rule: a student who holds an offer may only apply to drives paying at
                 least DREAM_FACTOR times their best offer
  who manages    admins, the Training & Placement Officer and the Director (Placements & Projects) (approver
                 assignments "placement_officer", "placement_director"): create drives, record results. HODs see their department's drives and report; the Principal and management see all
"""
import math
from collections import Counter, defaultdict
from datetime import date, datetime
from statistics import median
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.roles import user_roles
from backend.app.core.security import get_current_user
from backend.app.db.session import get_db
from backend.app.models.campus import UserModel
from backend.app.models.placements import PlacementBatchSummaryModel, PlacementDriveModel, PlacementRegistrationModel
from backend.app.models.services import RosterEntryModel, StudentProfileModel

router = APIRouter()
DREAM_FACTOR = 1.5
RESULT_STATUSES = ("registered", "shortlisted", "selected", "not_selected", "absent")


# ── Who is who ───────────────────────────────────────────────────────────────────
def min_ctc(best: float) -> float:
    """The least a drive must pay for someone holding a `best` offer (rounded up, as it is a minimum)."""
    return math.ceil(DREAM_FACTOR * best * 100 - 1e-9) / 100


def batch_of(roll_no: str) -> Optional[int]:
    """Passing-out year from a roll number: 2451-23-737-001 -> 2027 (four years after joining)."""
    try:
        return 2000 + int(roll_no.split("-")[1]) + 4
    except (IndexError, ValueError, AttributeError):
        return None


def _access(db: Session, current: dict) -> dict:
    r = user_roles(db, current)
    manage = r["admin"] or r.get("placement_officer", False)
    return {"manage": manage, "all_departments": manage or r["management"], "departments": r["hod_departments"],
            "report": manage or r["management"] or r["hod"], "student": current.get("role") == "student"}


def _student(db: Session, current: dict):
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
    if not profile or not profile.roll_no:
        return None, None
    return profile, db.get(RosterEntryModel, profile.roll_no)


def _status(d: PlacementDriveModel, now: datetime) -> str:
    if d.cancelled:
        return "cancelled"
    if d.results_out:
        return "completed"
    if now < d.opens_at:
        return "upcoming"
    if now <= d.register_by:
        return "open"
    return "results_awaited" if d.drive_date <= now.date() else "closed"


def _pay(d: PlacementDriveModel) -> str:
    if d.kind == "internship":
        return f"₹{d.stipend:,}/month" if d.stipend else "Unpaid"
    return f"{d.ctc_lpa:g} LPA" if d.ctc_lpa else "—"


def _drive_out(d: PlacementDriveModel, now: datetime, extra: Optional[dict] = None) -> dict:
    return {"id": d.id, "company": d.company, "role": d.role, "kind": d.kind, "ctc_lpa": d.ctc_lpa, "stipend": d.stipend,
            "pay": _pay(d), "location": d.location, "mode": d.mode, "departments": d.departments, "batch": d.batch,
            "eligibility": d.eligibility, "rounds": d.rounds or [], "description": d.description,
            "opens_at": d.opens_at.isoformat(), "register_by": d.register_by.isoformat(), "drive_date": d.drive_date.isoformat(),
            "results_out": d.results_out.isoformat() if d.results_out else None, "status": _status(d, now), **(extra or {})}


def best_offers(db: Session, rolls=None) -> dict:
    """roll -> best job offer (LPA) from selections in drives with declared results."""
    q = (db.query(PlacementRegistrationModel.roll_no, PlacementDriveModel.ctc_lpa)
         .join(PlacementDriveModel, PlacementDriveModel.id == PlacementRegistrationModel.drive_id)
         .filter(PlacementRegistrationModel.status == "selected", PlacementDriveModel.kind == "job"))
    out = {}
    for roll, ctc in q:
        if rolls is None or roll in rolls:
            out[roll] = max(out.get(roll, 0), ctc or 0)
    return out


@router.get("/access", summary="What I can do in Placements")
def access(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    return _access(db, current)


# ── Students ─────────────────────────────────────────────────────────────────────
@router.get("/me", summary="Drives I can apply to, my applications and my offers")
def my_placements(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    profile, entry = _student(db, current)
    if not entry:
        return {"ready": False, "reason": "Your roll number isn't linked to the college roll list yet."}
    now = datetime.utcnow()
    batch = batch_of(entry.roll_no)
    mine = {r.drive_id: r for r in db.query(PlacementRegistrationModel).filter(PlacementRegistrationModel.roll_no == entry.roll_no)}
    best = best_offers(db, {entry.roll_no}).get(entry.roll_no, 0)
    drives = [d for d in db.query(PlacementDriveModel).filter(PlacementDriveModel.batch == batch).all()
              if entry.department in (d.departments or []) or d.id in mine]
    out = []
    for d in sorted(drives, key=lambda d: d.drive_date, reverse=True):
        reg = mine.get(d.id)
        st = _status(d, now)
        why_not = None
        if not reg and d.kind == "job" and best and (d.ctc_lpa or 0) < DREAM_FACTOR * best:
            why_not = f"You hold a {best:g} LPA offer: you can apply to drives paying {min_ctc(best):g} LPA or more."
        out.append(_drive_out(d, now, {
            "my_status": reg.status if reg else None, "my_round": reg.round_reached if reg else None,
            "can_register": st == "open" and not reg and not why_not,
            "can_withdraw": st == "open" and bool(reg) and reg.status == "registered",
            "why_not": why_not}))
    offers = [{"company": d["company"], "role": d["role"], "pay": d["pay"], "kind": d["kind"], "date": d["drive_date"]}
              for d in out if d["my_status"] == "selected"]
    return {"ready": True, "roll_no": entry.roll_no, "batch": batch, "department": entry.department,
            "best_offer_lpa": best or None, "dream_factor": DREAM_FACTOR, "min_new_offer_lpa": min_ctc(best) if best else None, "drives": out, "offers": offers}


def _my_drive(db: Session, current: dict, drive_id: int):
    if current.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students apply to drives")
    _, entry = _student(db, current)
    if not entry:
        raise HTTPException(status_code=400, detail="Your roll number isn't linked to the college roll list yet")
    d = db.get(PlacementDriveModel, drive_id)
    if not d:
        raise HTTPException(status_code=404, detail="Drive not found")
    return d, entry


@router.post("/drives/{drive_id}/register", summary="Apply to a drive (students)")
def register(drive_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    d, entry = _my_drive(db, current, drive_id)
    if entry.department not in (d.departments or []) or batch_of(entry.roll_no) != d.batch:
        raise HTTPException(status_code=403, detail="This drive isn't open to your branch and batch")
    if _status(d, datetime.utcnow()) != "open":
        raise HTTPException(status_code=400, detail="Registrations for this drive are not open")
    best = best_offers(db, {entry.roll_no}).get(entry.roll_no, 0)
    if d.kind == "job" and best and (d.ctc_lpa or 0) < DREAM_FACTOR * best:
        raise HTTPException(status_code=400, detail=f"You hold a {best:g} LPA offer: you can apply to drives paying "
                                                    f"{min_ctc(best):g} LPA or more")
    reg = db.query(PlacementRegistrationModel).filter(PlacementRegistrationModel.drive_id == d.id,
                                                      PlacementRegistrationModel.roll_no == entry.roll_no).first()
    if reg and reg.status != "withdrawn":
        raise HTTPException(status_code=409, detail="You have already applied")
    if reg:
        reg.status, reg.registered_at = "registered", datetime.utcnow()
    else:
        db.add(PlacementRegistrationModel(drive_id=d.id, roll_no=entry.roll_no, user_id=current["sub"]))
    db.commit()
    return {"message": f"Applied to {d.company}"}


@router.post("/drives/{drive_id}/withdraw", summary="Withdraw an application while registrations are open")
def withdraw(drive_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    d, entry = _my_drive(db, current, drive_id)
    reg = db.query(PlacementRegistrationModel).filter(PlacementRegistrationModel.drive_id == d.id,
                                                      PlacementRegistrationModel.roll_no == entry.roll_no).first()
    if not reg or reg.status != "registered" or _status(d, datetime.utcnow()) != "open":
        raise HTTPException(status_code=400, detail="You can withdraw only while registrations are open")
    reg.status = "withdrawn"
    db.commit()
    return {"message": "Application withdrawn"}


# ── Placement Cell ───────────────────────────────────────────────────────────────
class DriveIn(BaseModel):
    company: str = Field(..., min_length=2, max_length=80)
    role: str = Field(..., min_length=2, max_length=80)
    kind: Literal["job", "internship"] = "job"
    ctc_lpa: Optional[float] = Field(None, ge=0, le=200)
    stipend: Optional[int] = Field(None, ge=0, le=500000)
    location: Optional[str] = Field(None, max_length=80)
    mode: Literal["on-campus", "virtual", "pool"] = "on-campus"
    departments: List[str] = Field(..., min_length=1)
    batch: int = Field(..., ge=2020, le=2040)
    eligibility: Optional[str] = Field(None, max_length=200)
    rounds: List[str] = []
    description: Optional[str] = Field(None, max_length=2000)
    opens_at: datetime
    register_by: datetime
    drive_date: date


def _need(db: Session, current: dict, what: str) -> dict:
    a = _access(db, current)
    if not a[what]:
        raise HTTPException(status_code=403, detail="Only the Placement Cell" + (", HODs and management" if what == "report" else ""))
    return a


def _visible(a: dict, d: PlacementDriveModel) -> bool:
    return a["all_departments"] or bool(set(d.departments or []) & set(a["departments"]))


@router.get("/drives", summary="All drives with registration counts (Placement Cell, HODs, management)")
def list_drives(batch: Optional[int] = None, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = _need(db, current, "report")
    now = datetime.utcnow()
    q = db.query(PlacementDriveModel)
    if batch:
        q = q.filter(PlacementDriveModel.batch == batch)
    drives = [d for d in q.all() if _visible(a, d)]
    counts = defaultdict(Counter)
    for drive_id, status in db.query(PlacementRegistrationModel.drive_id, PlacementRegistrationModel.status):
        counts[drive_id][status] += 1
    return [_drive_out(d, now, {"registered": sum(v for k, v in counts[d.id].items() if k != "withdrawn"),
                                "selected": counts[d.id]["selected"], "shortlisted": counts[d.id]["shortlisted"]})
            for d in sorted(drives, key=lambda d: d.drive_date, reverse=True)]


@router.post("/drives", summary="Post a drive (Placement Cell)")
def create_drive(body: DriveIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _need(db, current, "manage")
    if body.register_by < body.opens_at:
        raise HTTPException(status_code=422, detail="Registrations must close after they open")
    if body.kind == "job" and not body.ctc_lpa:
        raise HTTPException(status_code=422, detail="Give the CTC for a job")
    d = PlacementDriveModel(**body.model_dump(exclude={"departments"}), departments=sorted({x.strip().upper() for x in body.departments}),
                            created_by=current["sub"])
    db.add(d)
    db.commit()
    return _drive_out(d, datetime.utcnow())


@router.get("/drives/{drive_id}", summary="A drive and everyone who applied")
def get_drive(drive_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = _need(db, current, "report")
    d = db.get(PlacementDriveModel, drive_id)
    if not d or not _visible(a, d):
        raise HTTPException(status_code=404, detail="Drive not found")
    regs = db.query(PlacementRegistrationModel).filter(PlacementRegistrationModel.drive_id == d.id).all()
    roster = {r.roll_no: r for r in db.query(RosterEntryModel).filter(RosterEntryModel.roll_no.in_([r.roll_no for r in regs]))}
    best = best_offers(db, {r.roll_no for r in regs})
    rows = [{"roll_no": r.roll_no, "name": roster[r.roll_no].name if r.roll_no in roster else None,
             "section": f"{roster[r.roll_no].department}-{roster[r.roll_no].year}{roster[r.roll_no].section}" if r.roll_no in roster else None,
             "status": r.status, "round_reached": r.round_reached, "registered_at": r.registered_at.isoformat() if r.registered_at else None,
             "best_offer_lpa": best.get(r.roll_no)} for r in regs if r.status != "withdrawn"]
    return {**_drive_out(d, datetime.utcnow()), "can_manage": a["manage"], "registrations": sorted(rows, key=lambda x: x["roll_no"])}


class ResultIn(BaseModel):
    roll_no: str = Field(..., max_length=30)
    status: Literal["registered", "shortlisted", "selected", "not_selected", "absent"]
    round_reached: int = Field(0, ge=0, le=10)


class ResultsIn(BaseModel):
    results: List[ResultIn]
    declare: bool = False          # results are final: the drive is completed and offers count


@router.put("/drives/{drive_id}/results", summary="Record round results / selections (Placement Cell)")
def save_results(drive_id: int, body: ResultsIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _need(db, current, "manage")
    d = db.get(PlacementDriveModel, drive_id)
    if not d:
        raise HTTPException(status_code=404, detail="Drive not found")
    regs = {r.roll_no: r for r in db.query(PlacementRegistrationModel).filter(PlacementRegistrationModel.drive_id == d.id)}
    unknown = [x.roll_no for x in body.results if x.roll_no not in regs]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Not registered for this drive: {', '.join(unknown[:5])}")
    for x in body.results:
        r = regs[x.roll_no]
        r.status, r.round_reached, r.updated_by = x.status, x.round_reached, current["sub"]
    if body.declare:
        d.results_out = datetime.utcnow()
    db.commit()
    return {"message": f"Saved {len(body.results)} results" + (" and declared them" if body.declare else "")}


# ── Report ───────────────────────────────────────────────────────────────────────
def batch_report(db: Session, department: str, batch: int) -> dict:
    """Placement numbers for one branch's passing-out batch (live: from drives and registrations)."""
    roster = [r for r in db.query(RosterEntryModel).filter(RosterEntryModel.department == department).all()
              if batch_of(r.roll_no) == batch and r.year]
    rolls = {r.roll_no for r in roster}
    drives = {d.id: d for d in db.query(PlacementDriveModel).filter(PlacementDriveModel.batch == batch).all()
              if department in (d.departments or [])}
    regs = [r for r in db.query(PlacementRegistrationModel).filter(PlacementRegistrationModel.drive_id.in_(list(drives))).all()
            if r.roll_no in rolls]
    jobs = [r for r in regs if drives[r.drive_id].kind == "job"]
    selected = [r for r in jobs if r.status == "selected"]
    per_student = defaultdict(list)
    for r in selected:
        per_student[r.roll_no].append(drives[r.drive_id].ctc_lpa or 0)
    best = [max(v) for v in per_student.values()]
    applied = {r.roll_no for r in jobs if r.status != "withdrawn"}
    sec_of = {r.roll_no: f"{r.department}-{r.year}{r.section}" for r in roster}
    sections = sorted(set(sec_of.values()))
    by_section = [{"section": s, "students": sum(1 for v in sec_of.values() if v == s),
                   "placed": sum(1 for roll in per_student if sec_of.get(roll) == s),
                   "applied": sum(1 for roll in applied if sec_of.get(roll) == s)} for s in sections]
    companies = defaultdict(lambda: {"offers": 0, "registered": 0, "ctc": None, "role": None, "status": None, "date": None})
    now = datetime.utcnow()
    for d in drives.values():
        if d.kind != "job":
            continue
        c = companies[d.id]
        c.update(company=d.company, role=d.role, ctc=d.ctc_lpa, status=_status(d, now), date=d.drive_date.isoformat())
    for r in jobs:
        if r.status != "withdrawn":
            companies[r.drive_id]["registered"] += 1
        if r.status == "selected":
            companies[r.drive_id]["offers"] += 1
    bands = [("Below 4 LPA", 0, 4), ("4–6 LPA", 4, 6), ("6–10 LPA", 6, 10), ("10 LPA and above", 10, 999)]
    by_month = Counter()
    for r in selected:
        if drives[r.drive_id].results_out:
            by_month[drives[r.drive_id].drive_date.strftime("%Y-%m")] += 1
    interns = [r for r in regs if drives[r.drive_id].kind == "internship" and r.status == "selected"]
    return {
        "department": department, "batch": batch, "students": len(rolls), "applied": len(applied),
        "placed": len(per_student), "offers": len(selected),
        "placed_pct": round(100 * len(per_student) / len(rolls), 1) if rolls else None,
        "highest_ctc": max(best) if best else None, "median_ctc": round(median(best), 2) if best else None,
        "average_ctc": round(sum(best) / len(best), 2) if best else None,
        "multiple_offers": sum(1 for v in per_student.values() if len(v) > 1),
        "recruiters": len({drives[r.drive_id].company for r in selected}),
        "drives": sum(1 for d in drives.values() if d.kind == "job"),
        "internships": len(interns),
        "bands": [{"band": b, "students": sum(1 for x in best if lo <= x < hi)} for b, lo, hi in bands],
        "by_section": by_section,
        "companies": sorted(companies.values(), key=lambda c: c["date"] or "", reverse=True),
        "by_month": [{"month": m, "offers": n} for m, n in sorted(by_month.items())],
    }


def summaries(db: Session, departments: Optional[set] = None) -> list:
    rows = db.query(PlacementBatchSummaryModel).order_by(PlacementBatchSummaryModel.batch).all()
    return [{"department": s.department, "batch": s.batch, "eligible": s.eligible, "placed": s.placed, "offers": s.offers,
             "placed_pct": round(100 * s.placed / s.eligible, 1) if s.eligible else None, "higher_studies": s.higher_studies,
             "entrepreneurs": s.entrepreneurs, "median_ctc": s.median_ctc, "highest_ctc": s.highest_ctc, "recruiters": s.recruiters}
            for s in rows if departments is None or s.department in departments]


@router.get("/report", summary="Placement report for a branch's batch, with earlier batches")
def report(department: str = Query("IT", max_length=20), batch: Optional[int] = None,
           db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = _need(db, current, "report")
    dept = department.strip().upper()
    if not a["all_departments"] and dept not in a["departments"]:
        raise HTTPException(status_code=403, detail="Only the HOD of this department, the Placement Cell or management")
    batches = sorted({d.batch for d in db.query(PlacementDriveModel).all() if dept in (d.departments or [])})
    batch = batch or (min((b for b in batches if b >= date.today().year), default=None) or (batches[-1] if batches else None))
    if not batch:
        return {"department": dept, "empty": True, "history": summaries(db, {dept})}
    return {**batch_report(db, dept, batch), "batches": batches, "history": summaries(db, {dept})}
