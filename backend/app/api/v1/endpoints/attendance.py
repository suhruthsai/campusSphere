"""
Class attendance (replaces the old per-account attendance log, which nothing used).

  faculty     GET /classes (today's periods to mark), GET /session (the class list), PUT /session (save), PUT /group
  students    GET /me: overall and per subject, with the 75% / 65% bunk analysis
  reports     GET /section (a section: teacher, its HOD, admins, Principal), GET /overview (HOD: their departments;
              admin and Principal: all), GET /my-sections (sections I teach, for the report picker)
  rules       GET /rules (everyone), PUT /rules (admins)
"""
from collections import defaultdict
from datetime import date, datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.attendance import core as A
from backend.app.core.campus_time import campus_now
from backend.app.core.roles import user_roles
from backend.app.core.security import get_current_user, require_admin
from backend.app.db.session import get_db
from backend.app.models.attendance import AttendanceGroupModel, AttendanceMarkModel, AttendanceSessionModel
from backend.app.models.campus import SubstitutionModel, TimetableEntryModel
from backend.app.models.services import RosterEntryModel, StudentProfileModel

router = APIRouter()


def _today() -> date:
    return campus_now().date()


def _entry(db: Session, entry_id: int) -> TimetableEntryModel:
    e = db.query(TimetableEntryModel).filter(TimetableEntryModel.id == entry_id, TimetableEntryModel.is_active == True).first()
    if not e:
        raise HTTPException(status_code=404, detail="That class isn't in the timetable")
    return e


def _check_day(e: TimetableEntryModel, day: date):
    if day > _today():
        raise HTTPException(status_code=422, detail="Attendance can't be marked for a future date")
    if day.weekday() != e.day_of_week:
        raise HTTPException(status_code=422, detail="This class doesn't run on that day")


def _session(db: Session, entry_id: int, day: date) -> Optional[AttendanceSessionModel]:
    return db.query(AttendanceSessionModel).filter(AttendanceSessionModel.timetable_entry_id == entry_id,
                                                   AttendanceSessionModel.date == day).first()


# ── Rules ────────────────────────────────────────────────────────────────────────
class RulesIn(BaseModel):
    target_pct: int = Field(..., ge=50, le=100)
    floor_pct: int = Field(..., ge=0, le=100)
    semester_start: Optional[date] = None
    semester_end: Optional[date] = None
    edit_hours: int = Field(24, ge=1, le=24 * 14)


@router.get("/rules", summary="The attendance rules (target, condonation floor, semester dates)")
def get_rules(db: Session = Depends(get_db)):
    return A.rules_out(A.rules(db))


@router.put("/rules", summary="Change the attendance rules (admins)")
def put_rules(body: RulesIn, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    if body.floor_pct > body.target_pct:
        raise HTTPException(status_code=422, detail="The floor can't be above the target")
    if body.semester_start and body.semester_end and body.semester_end <= body.semester_start:
        raise HTTPException(status_code=422, detail="The semester must end after it starts")
    r = A.rules(db)
    r.target_pct, r.floor_pct, r.edit_hours = body.target_pct, body.floor_pct, body.edit_hours
    r.semester_start, r.semester_end, r.updated_by = body.semester_start, body.semester_end, admin["name"]
    db.commit()
    return A.rules_out(r)


# ── Faculty: marking ─────────────────────────────────────────────────────────────
@router.get("/classes", summary="Periods I can mark on a day (mine and the ones I'm substituting; HODs: the department)")
def classes(day: Optional[date] = Query(None, alias="date"), scope: Literal["mine", "department"] = "mine",
            db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    day = day or _today()
    entries = db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True,
                                                   TimetableEntryModel.day_of_week == day.weekday()).all()
    roles = user_roles(db, current)
    fac = A.faculty_profile(db, current)
    subs = {(s.section, s.period_number): s for s in db.query(SubstitutionModel).filter(
        SubstitutionModel.date == day, SubstitutionModel.status == "active").all()}
    out = []
    for e in sorted(entries, key=lambda e: (e.period_number, e.section)):
        sub = subs.get((e.section, e.period_number))
        mine = fac and ((e.faculty_id == fac.id and not (sub and sub.replacement_faculty_id != fac.id))
                        or (sub and sub.replacement_faculty_id == fac.id))
        dept_view = scope == "department" and (current["role"] == "admin" or A._dept(e.department) in roles["hod_departments"])
        if not (mine or dept_view):
            continue
        s = _session(db, e.id, day)
        counts = None
        if s:
            marks = [m.status for m in db.query(AttendanceMarkModel.status).filter(AttendanceMarkModel.session_id == s.id)]
            counts = {"present": marks.count("present"), "late": marks.count("late"), "absent": marks.count("absent")}
        out.append({"entry_id": e.id, "period": e.period_number, "time": f"{e.start_time}–{e.end_time}",
                    "section": e.section, "batch": e.batch, "subject": e.subject_name, "classroom": e.classroom_id,
                    "teacher": sub.replacement_faculty_name if sub else e.faculty_name,
                    "substitute": bool(sub), "marked": bool(s), "counts": counts,
                    "started": campus_now() >= datetime.combine(day, datetime.min.time()).replace(
                        hour=int(e.start_time[:2]), minute=int(e.start_time[3:5])) if day == _today() else True})
    linked = fac is not None
    return {"date": day.isoformat(), "classes": out, "linked": linked,
            "note": None if linked or scope == "department" else
            "Your account isn't linked to a timetable profile (your email must match the faculty list), so no periods are shown."}


@router.get("/session", summary="A period's class list with each student's mark (present unless saved otherwise)")
def get_session(entry_id: int, day: date = Query(..., alias="date"), db: Session = Depends(get_db),
                current: dict = Depends(get_current_user)):
    e = _entry(db, entry_id)
    _check_day(e, day)
    acc = A.access(db, current, e, day)
    if not acc["mark"]:
        raise HTTPException(status_code=403, detail=acc.get("why", "Not your class"))
    roster = A.class_list(db, e.section)
    members = A.group_members(db, e.section, e.batch, roster)
    s = _session(db, e.id, day)
    saved = {m.roll_no: m.status for m in db.query(AttendanceMarkModel).filter(AttendanceMarkModel.session_id == s.id)} if s else {}
    in_group = {r.roll_no for r in members}
    r = A.rules(db)
    note = None
    if not roster:
        note = f"The roll list for {e.section} hasn't been imported yet (Services → Roll list)."
    elif e.batch and not members:
        note = (f"Nobody is in {e.batch} yet. Tick the students who take it, below." if e.batch not in A.SPLIT_BATCHES
                else f"Nobody is in batch {e.batch}.")
    return {
        "entry_id": e.id, "date": day.isoformat(), "section": e.section, "batch": e.batch, "subject": e.subject_name,
        "period": e.period_number, "time": f"{e.start_time}–{e.end_time}", "classroom": e.classroom_id,
        "saved": bool(s), "marked_by": s.marked_by_name if s else None,
        "marked_at": s.updated_at.isoformat() if s and s.updated_at else None,
        "can_edit": A.editable(r, acc, e, day, bool(s)), "manage": acc["manage"], "edit_hours": r.edit_hours,
        "placeholder_roll_list": any((x.source or "").startswith("GENERATED") for x in roster[:1]),
        "note": note,
        "students": [{"roll_no": x.roll_no, "name": x.name, "in_group": x.roll_no in in_group,
                      "status": saved.get(x.roll_no, "present")} for x in (roster if e.batch else members)],
    }


class SessionIn(BaseModel):
    entry_id: int
    date: date
    absent: List[str] = Field(default_factory=list, max_length=300)
    late: List[str] = Field(default_factory=list, max_length=300)


@router.put("/session", summary="Save a period's attendance: everyone in the class is present except those listed")
def put_session(body: SessionIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    e = _entry(db, body.entry_id)
    _check_day(e, body.date)
    acc = A.access(db, current, e, body.date)
    if not acc["mark"]:
        raise HTTPException(status_code=403, detail=acc.get("why", "Not your class"))
    s = _session(db, e.id, body.date)
    r = A.rules(db)
    if not A.editable(r, acc, e, body.date, bool(s)):
        raise HTTPException(status_code=403, detail=f"Attendance locks {r.edit_hours} hours after class; ask your HOD to correct it")
    members = A.group_members(db, e.section, e.batch, A.class_list(db, e.section))
    rolls = {m.roll_no for m in members}
    if not rolls:
        raise HTTPException(status_code=422, detail="There are no students on this class list yet")
    unknown = (set(body.absent) | set(body.late)) - rolls
    if unknown:
        raise HTTPException(status_code=422, detail=f"Not in this class: {', '.join(sorted(unknown)[:5])}")
    if set(body.absent) & set(body.late):
        raise HTTPException(status_code=422, detail="A student can't be both absent and late")
    if not s:
        s = AttendanceSessionModel(timetable_entry_id=e.id, date=body.date, section=e.section, department=e.department,
                                   subject_name=e.subject_name, batch=e.batch, period_number=e.period_number)
        db.add(s)
        db.flush()
    s.marked_by, s.marked_by_name, s.updated_at = current["sub"], current["name"], datetime.utcnow()
    db.query(AttendanceMarkModel).filter(AttendanceMarkModel.session_id == s.id).delete(synchronize_session=False)
    absent, late = set(body.absent), set(body.late)
    for roll in sorted(rolls):
        db.add(AttendanceMarkModel(session_id=s.id, roll_no=roll,
                                   status="absent" if roll in absent else "late" if roll in late else "present"))
    db.commit()
    return {"saved": True, "present": len(rolls) - len(absent) - len(late), "late": len(late), "absent": len(absent)}


class GroupIn(BaseModel):
    entry_id: int
    roll_no: str = Field(..., max_length=30)
    member: bool


@router.put("/group", summary="Put a student in or out of a lab batch / elective group (remembered)")
def put_group(body: GroupIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    e = _entry(db, body.entry_id)
    if not e.batch:
        raise HTTPException(status_code=422, detail="This class isn't split into batches")
    if not A.teaches_or_manages(db, current, e):
        raise HTTPException(status_code=403, detail="Only the class's teacher, the HOD or an admin can change its groups")
    if body.roll_no not in {r.roll_no for r in A.class_list(db, e.section)}:
        raise HTTPException(status_code=422, detail="That roll number isn't in this class")
    g = db.query(AttendanceGroupModel).filter(AttendanceGroupModel.section == e.section, AttendanceGroupModel.batch == e.batch,
                                              AttendanceGroupModel.roll_no == body.roll_no).first()
    if not g:
        g = AttendanceGroupModel(section=e.section, batch=e.batch, roll_no=body.roll_no)
        db.add(g)
    g.member = 1 if body.member else 0
    db.commit()
    return {"roll_no": body.roll_no, "batch": e.batch, "member": body.member}


# ── Students ─────────────────────────────────────────────────────────────────────
def student_report(db: Session, roll_no: str, roster_row: RosterEntryModel) -> dict:
    r = A.rules(db)
    start, end, _auto = A.semester(r)
    marks = A.marks_by_subject(db, roll_no, start, end)
    sections = A.student_sections(db, roster_row.department, roster_row.year, roster_row.section)
    entries = [e for e in db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True,
                                                               TimetableEntryModel.section.in_(sections)).all()] if sections else []
    # Only periods the student is actually in (their lab batch, their electives)
    mine = []
    for e in entries:
        if not e.batch or roll_no in {m.roll_no for m in A.group_members(db, e.section, e.batch, A.class_list(db, e.section))}:
            mine.append(e)
    remaining = A.remaining_classes(mine, r, _today())
    subjects = sorted({e.subject_name for e in mine} | set(marks))
    rows = []
    for subj in subjects:
        attended, held = marks.get(subj, [0, 0])
        rows.append({"subject": subj, **A.analyse(attended, held, remaining.get(subj, 0), r.target_pct, r.floor_pct)})
    total_a = sum(x["attended"] for x in rows)
    total_h = sum(x["held"] for x in rows)
    total_rem = sum(x["remaining"] or 0 for x in rows)
    return {"roll_no": roll_no, "name": roster_row.name, "sections": sections, "rules": A.rules_out(r),
            "overall": A.analyse(total_a, total_h, total_rem, r.target_pct, r.floor_pct),
            "subjects": sorted(rows, key=lambda x: (x["pct"] is None, x["pct"] if x["pct"] is not None else 0)),
            "placeholder": (roster_row.source or "").startswith("GENERATED")}


@router.get("/me", summary="My attendance: overall and per subject, with how many classes I can miss or must attend")
def my_attendance(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if current["role"] != "student":
        raise HTTPException(status_code=403, detail="Students only")
    p = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
    if not p or not p.roll_no:
        return {"ready": False, "reason": "Add your roll number on the Certificates page (your profile) to see your attendance."}
    row = db.get(RosterEntryModel, p.roll_no)
    if not row:
        return {"ready": False, "reason": f"Roll number {p.roll_no} isn't on the college roll list yet."}
    return {"ready": True, **student_report(db, p.roll_no, row)}


# ── Reports ──────────────────────────────────────────────────────────────────────
def _may_report(db: Session, current: dict, section: str) -> bool:
    if current["role"] == "admin":
        return True
    r = user_roles(db, current)
    if r["principal"] or A.section_parts(section)[0] in r["hod_departments"]:
        return True
    fac = A.faculty_profile(db, current)
    return bool(fac) and db.query(TimetableEntryModel.id).filter(TimetableEntryModel.section == section,
                                                                 TimetableEntryModel.faculty_id == fac.id).first() is not None


@router.get("/my-sections", summary="Sections I may see reports for")
def my_sections(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    all_secs = sorted({s for (s,) in db.query(TimetableEntryModel.section).filter(TimetableEntryModel.is_active == True).distinct()})
    return [s for s in all_secs if _may_report(db, current, s)]


@router.get("/section", summary="A section's attendance: per subject and per student, below 75% / 65% first")
def section_report(section: str, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    if not _may_report(db, current, section):
        raise HTTPException(status_code=403, detail="Not your section")
    r = A.rules(db)
    roster = {x.roll_no: x for x in A.class_list(db, section)}
    start, end, _auto = A.semester(r)
    sessions = db.query(AttendanceSessionModel).filter(AttendanceSessionModel.section == section,
                                                       AttendanceSessionModel.date >= start,
                                                       AttendanceSessionModel.date <= end).all()
    ids = [s.id for s in sessions]
    marks = db.query(AttendanceMarkModel).filter(AttendanceMarkModel.session_id.in_(ids)).all() if ids else []
    subj_of = {s.id: s.subject_name for s in sessions}
    per_student = defaultdict(lambda: [0, 0])
    per_subject = defaultdict(lambda: {"sessions": set(), "a": 0, "h": 0})
    for m in marks:
        att = m.status in ("present", "late")
        per_student[m.roll_no][1] += 1
        per_student[m.roll_no][0] += att
        ps = per_subject[subj_of[m.session_id]]
        ps["sessions"].add(m.session_id); ps["h"] += 1; ps["a"] += att
    students = []
    for roll, (a, h) in per_student.items():
        pct = round(100 * a / h, 1) if h else None
        students.append({"roll_no": roll, "name": roster[roll].name if roll in roster else roll, "attended": a, "held": h,
                         "pct": pct, "status": A.status_of(pct, r.target_pct, r.floor_pct),
                         "need_for_target": A.need_in_row(a, h, r.target_pct / 100)})
    students.sort(key=lambda x: x["pct"] if x["pct"] is not None else 101)
    subjects = [{"subject": k, "sessions": len(v["sessions"]), "avg_pct": round(100 * v["a"] / v["h"], 1) if v["h"] else None}
                for k, v in sorted(per_subject.items())]
    return {"section": section, "rules": A.rules_out(r), "class_size": len(roster), "sessions": len(sessions),
            "subjects": subjects, "students": students,
            "below_target": sum(1 for s in students if s["status"] in ("condonation", "detained")),
            "below_floor": sum(1 for s in students if s["status"] == "detained")}


@router.get("/overview", summary="Attendance by section (HOD: their departments; admin and Principal: all)")
def overview(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    r = user_roles(db, current)
    if not (current["role"] == "admin" or r["principal"] or r["hod"]):
        raise HTTPException(status_code=403, detail="HODs, the Principal and admins only")
    secs = [s for s in my_sections(db, current)
            if current["role"] == "admin" or r["principal"] or A.section_parts(s)[0] in r["hod_departments"]]
    rows = []
    for s in secs:
        rep = section_report(s, db, current)
        held = sum(x["held"] for x in rep["students"])
        att = sum(x["attended"] for x in rep["students"])
        rows.append({"section": s, "department": A.section_parts(s)[0], "class_size": rep["class_size"],
                     "sessions": rep["sessions"], "avg_pct": round(100 * att / held, 1) if held else None,
                     "below_target": rep["below_target"], "below_floor": rep["below_floor"]})
    return {"rules": A.rules_out(A.rules(db)), "sections": rows}
