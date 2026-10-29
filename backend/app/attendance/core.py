"""
Attendance rules and arithmetic.

  sections   a timetable section "IT-4A" is IT, year 4, section A; "Civil-3" is Civil semester 3 = year 2, every
             section. Its class list is that slice of the roll list.
  groups     lab batches 1/2 and G1/G2 split the class list by roll number (first half / second half); a teacher
             can move a student once and it is remembered. Electives (any other code) start empty: the teacher
             picks who takes them, so nobody is marked absent from a class they don't take.
  who marks  the teacher of the period, the substitute on that date, the department's HOD, or an admin. The
             teacher can correct a saved session for `edit_hours` after the class ends; the HOD and admins always.
  analysis   present and late count as attended. At or above the target (75%) is safe; between the floor (65%)
             and the target needs condonation; below the floor means detention. "Can miss" and "need to attend"
             are exact: the largest k with a/(n+k) >= r, and the smallest x with (a+x)/(n+x) >= r.
"""
import math
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from backend.app.core.campus_time import campus_now
from backend.app.core.roles import user_roles
from backend.app.models.attendance import (
    AttendanceGroupModel, AttendanceMarkModel, AttendanceRulesModel, AttendanceSessionModel,
)
from backend.app.models.campus import FacultyProfileModel, SubstitutionModel, TimetableEntryModel, UserModel
from backend.app.models.services import RosterEntryModel

SPLIT_BATCHES = {"1": 0, "G1": 0, "2": 1, "G2": 1}   # batch -> which half of the class list


# ── Rules ────────────────────────────────────────────────────────────────────────
def rules(db: Session) -> AttendanceRulesModel:
    r = db.get(AttendanceRulesModel, 1)
    if not r:
        r = AttendanceRulesModel(id=1, target_pct=75, floor_pct=65, edit_hours=24)
        db.add(r)
        db.commit()
        db.refresh(r)
    return r


def auto_semester(today: date) -> tuple:
    """Six-month semesters: odd July-December, even January-June."""
    if today.month >= 7:
        return date(today.year, 7, 1), date(today.year, 12, 31)
    return date(today.year, 1, 1), date(today.year, 6, 30)


def semester(r: AttendanceRulesModel, today: Optional[date] = None) -> tuple:
    """(start, end, automatic): the admin's dates while today falls inside them, otherwise the automatic semester."""
    today = today or campus_now().date()
    if r.semester_start and r.semester_end and r.semester_start <= today <= r.semester_end:
        return r.semester_start, r.semester_end, False
    start, end = auto_semester(today)
    return start, end, True


def rules_out(r: AttendanceRulesModel) -> dict:
    start, end, auto = semester(r)
    return {"target_pct": r.target_pct, "floor_pct": r.floor_pct, "edit_hours": r.edit_hours,
            "semester_start": start.isoformat(), "semester_end": end.isoformat(), "semester_auto": auto}


# ── Sections, class lists and groups ─────────────────────────────────────────────
def section_parts(section: str):
    """'IT-4A' -> ('IT', 4, 'A'); 'Civil-3' (semester 3) -> ('CIVIL', 2, None)."""
    head, _, tail = (section or "").partition("-")
    digits = "".join(c for c in tail if c.isdigit())
    letters = "".join(c for c in tail if c.isalpha()).upper() or None
    if not digits:
        return head.upper(), None, letters
    n = int(digits)
    return head.upper(), (n if letters else (n + 1) // 2), letters


def class_list(db: Session, section: str) -> list:
    dept, year, letter = section_parts(section)
    if not year:
        return []
    q = db.query(RosterEntryModel).filter(RosterEntryModel.department == dept, RosterEntryModel.year == year)
    if letter:
        q = q.filter(RosterEntryModel.section == letter)
    return sorted(q.all(), key=lambda r: r.roll_no)


def group_members(db: Session, section: str, batch: Optional[str], roster: list) -> list:
    if not batch:
        return roster
    moves = {g.roll_no: g.member for g in db.query(AttendanceGroupModel).filter(
        AttendanceGroupModel.section == section, AttendanceGroupModel.batch == batch).all()}
    if batch in SPLIT_BATCHES:
        half = math.ceil(len(roster) / 2)
        default = set(r.roll_no for r in (roster[:half] if SPLIT_BATCHES[batch] == 0 else roster[half:]))
    else:
        default = set()                       # elective: nobody until the teacher picks
    members = {r for r in default if moves.get(r, 1)} | {r for r, m in moves.items() if m}
    return [r for r in roster if r.roll_no in members]


def student_sections(db: Session, dept: str, year: int, letter: Optional[str]) -> list:
    """Timetable sections a student (by roll list department / year / section) belongs to."""
    out = set()
    for (sec,) in db.query(TimetableEntryModel.section).filter(TimetableEntryModel.is_active == True).distinct():
        d, y, l = section_parts(sec)
        if d == (dept or "").upper() and y == year and (not l or not letter or l == letter.upper()):
            out.add(sec)
    return sorted(out)


# ── Who may mark ─────────────────────────────────────────────────────────────────
def faculty_profile(db: Session, current: dict) -> Optional[FacultyProfileModel]:
    user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
    if not user or not user.email:
        return None
    return db.query(FacultyProfileModel).filter(FacultyProfileModel.email.ilike(user.email)).first()


def _dept(d) -> str:
    return (d or "").strip().upper()


def access(db: Session, current: dict, entry: TimetableEntryModel, day: date) -> dict:
    """{'mark': may save this period, 'manage': HOD / admin (may correct any time), 'why': reason if not}."""
    if current.get("role") == "admin":
        return {"mark": True, "manage": True}
    r = user_roles(db, current)
    if _dept(entry.department) in r["hod_departments"]:
        return {"mark": True, "manage": True}
    fac = faculty_profile(db, current)
    if fac and fac.id == entry.faculty_id:
        sub = db.query(SubstitutionModel).filter(SubstitutionModel.date == day, SubstitutionModel.status == "active",
                                                 SubstitutionModel.period_number == entry.period_number,
                                                 SubstitutionModel.section == entry.section).first()
        if sub and sub.replacement_faculty_id != fac.id:
            return {"mark": False, "manage": False, "why": f"{sub.replacement_faculty_name} is taking this class today"}
        return {"mark": True, "manage": False}
    if fac:
        sub = db.query(SubstitutionModel).filter(SubstitutionModel.date == day, SubstitutionModel.status == "active",
                                                 SubstitutionModel.period_number == entry.period_number,
                                                 SubstitutionModel.section == entry.section,
                                                 SubstitutionModel.replacement_faculty_id == fac.id).first()
        if sub:
            return {"mark": True, "manage": False}
    return {"mark": False, "manage": False, "why": "Only the teacher of this class, its substitute, the HOD or an admin can mark it"}


def teaches_or_manages(db: Session, current: dict, entry: TimetableEntryModel) -> bool:
    """The class's regular teacher, its department's HOD, or an admin (for lab batch / elective groups)."""
    if current.get("role") == "admin" or _dept(entry.department) in user_roles(db, current)["hod_departments"]:
        return True
    fac = faculty_profile(db, current)
    return bool(fac) and fac.id == entry.faculty_id


def class_end(entry: TimetableEntryModel, day: date) -> datetime:
    h, m = (entry.end_time or "23:59").split(":")[:2]
    return datetime.combine(day, datetime.min.time()).replace(hour=int(h), minute=int(m))


def editable(rules_row: AttendanceRulesModel, acc: dict, entry: TimetableEntryModel, day: date, saved: bool) -> bool:
    if not acc["mark"]:
        return False
    if acc["manage"] or not saved:
        return True
    return campus_now() <= class_end(entry, day) + timedelta(hours=rules_row.edit_hours)


# ── Arithmetic ───────────────────────────────────────────────────────────────────
def status_of(pct: Optional[float], target: int, floor: int) -> str:
    if pct is None:
        return "none"
    return "good" if pct >= target else "condonation" if pct >= floor else "detained"


def can_miss(attended: int, held: int, r: float) -> int:
    """Classes that can be missed in a row from now and still be at r or above."""
    if held == 0 or attended < r * held:
        return 0
    return max(0, math.floor(attended / r - held + 1e-9))


def need_in_row(attended: int, held: int, r: float) -> int:
    """Classes to attend in a row from now to get back to r."""
    if attended >= r * held - 1e-9:
        return 0
    return math.ceil((r * held - attended) / (1 - r) - 1e-9)


def analyse(attended: int, held: int, remaining: Optional[int], target: int, floor: int) -> dict:
    rt, rf = target / 100, floor / 100
    pct = round(100 * attended / held, 1) if held else None
    out = {"held": held, "attended": attended, "absent": held - attended, "pct": pct,
           "status": status_of(pct, target, floor),
           "can_miss": can_miss(attended, held, rt), "need_for_target": need_in_row(attended, held, rt),
           "need_for_floor": need_in_row(attended, held, rf), "remaining": remaining}
    if remaining is not None:
        total = held + remaining
        out["semester_bunks_left"] = max(0, math.floor(total * (1 - rt) + 1e-9) - (held - attended)) if total else None
        out["best_possible_pct"] = round(100 * (attended + remaining) / total, 1) if total else None
    return out


def remaining_classes(entries: list, rules_row: AttendanceRulesModel, today: date) -> dict:
    """Classes still to come per subject until the semester ends (from tomorrow), from the timetable."""
    end = semester(rules_row, today)[1]
    if end <= today:
        return {}
    weekly = defaultdict(int)
    for e in entries:
        weekly[(e.subject_name, e.day_of_week)] += 1
    out = defaultdict(int)
    d = today + timedelta(days=1)
    while d <= end:
        for (subject, dow), n in weekly.items():
            if d.weekday() == dow:
                out[subject] += n
        d += timedelta(days=1)
    return dict(out)


def marks_by_subject(db: Session, roll_no: str, start: Optional[date] = None, end: Optional[date] = None) -> dict:
    """subject -> [attended, held] for one student, from the saved marks (of this semester, when given)."""
    q = (db.query(AttendanceMarkModel.status, AttendanceSessionModel.subject_name)
         .join(AttendanceSessionModel, AttendanceSessionModel.id == AttendanceMarkModel.session_id)
         .filter(AttendanceMarkModel.roll_no == roll_no))
    if start and end:
        q = q.filter(AttendanceSessionModel.date >= start, AttendanceSessionModel.date <= end)
    rows = q.all()
    out = defaultdict(lambda: [0, 0])
    for status, subject in rows:
        out[subject][1] += 1
        if status in ("present", "late"):
            out[subject][0] += 1
    return out
