from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
import io, csv
from backend.app.db.session import get_db
from backend.app.core.security import get_current_user, require_admin
from backend.app.core.realtime import broadcast_timetable
from backend.app.core.campus_time import campus_now, campus_today, parse_campus_time
from backend.app.models.campus import TimetableEntryModel, ClassroomModel, TimetableOverrideModel, TimetableAuditLogModel, SubstitutionModel
from backend.app.schemas.campus import (
    TimetableEntryCreate, TimetableEntryUpdate, TimetableEntryOut,
    CurrentClassResponse, ConflictReport, ConflictItem,
    TimetableOverrideCreate, TimetableOverrideOut
)

router = APIRouter()

DAY_NAMES  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_MAP    = {d.lower(): i for i, d in enumerate(DAY_NAMES)}
DAY_ABBR   = {d[:3].lower(): i for i, d in enumerate(DAY_NAMES)}
MAX_CSV_BYTES = 2 * 1024 * 1024

def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)

def _overlaps(a_start, a_end, b_start, b_end) -> bool:
    return _time_to_minutes(a_start) < _time_to_minutes(b_end) and            _time_to_minutes(a_end)   > _time_to_minutes(b_start)

def _section_matches(entry_section: str, dept: str, year: int, letter: str) -> bool:
    """Timetable sections look like 'IT-2A' (IT, year 2, section A) or 'Civil-5' (Civil, semester 5)."""
    head, _, tail = (entry_section or "").partition("-")
    if head.upper() != (dept or "").upper() or not tail:
        return False
    digits = "".join(ch for ch in tail if ch.isdigit())
    letters = "".join(ch for ch in tail if ch.isalpha())
    if not digits:
        return False
    n = int(digits)
    # A letter after the number means "year + section"; a bare number is the semester
    entry_year = n if letters else (n + 1) // 2
    return entry_year == year and (not letters or letters.upper() == (letter or "").upper())


@router.get("/stats", summary="Campus statistics computed from the timetable")
def timetable_stats(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    """Everything here is derived from the official timetable and the room list (no sensors)."""
    from collections import Counter, defaultdict
    from backend.app.models.campus import FacultyProfileModel, UserModel
    entries = db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True).all()
    rooms = {c.id: c for c in db.query(ClassroomModel).all()}
    days = sorted({e.day_of_week for e in entries})
    periods = sorted({e.period_number for e in entries})
    slots_per_week = sum(len({e.period_number for e in entries if e.day_of_week == d}) for d in days) or 1

    # Rooms: periods booked per week out of the teaching slots
    booked = defaultdict(set)
    for e in entries:
        booked[e.classroom_id].add((e.day_of_week, e.period_number))
    room_rows = sorted(({"id": rid, "name": rooms[rid].name if rid in rooms else rid,
                         "building": rooms[rid].building if rid in rooms else None,
                         "type": rooms[rid].type if rid in rooms else None,
                         "booked": len(slots), "utilization": round(100 * len(slots) / slots_per_week)}
                        for rid, slots in booked.items()), key=lambda r: -r["booked"])
    unused = [{"id": c.id, "name": c.name, "type": c.type} for c in rooms.values()
              if c.id not in booked and c.location_type in ("CLASSROOM", "LABORATORY")]

    # Departments
    by_dept = defaultdict(lambda: {"classes_per_week": 0, "sections": set(), "faculty": set()})
    for e in entries:
        d = by_dept[e.department]
        d["classes_per_week"] += 1
        d["sections"].add(e.section)
        if e.faculty_id:
            d["faculty"].add(e.faculty_id)
    students = Counter((u.department or "").upper() for u in db.query(UserModel).filter(UserModel.role == "student").all())
    faculty_profiles = Counter(f.department for f in db.query(FacultyProfileModel).all())
    dept_rows = [{"department": k, "classes_per_week": v["classes_per_week"], "sections": len(v["sections"]),
                  "teaching_faculty": len(v["faculty"]), "registered_students": students.get(k.upper(), 0)}
                 for k, v in sorted(by_dept.items())]

    # When is the campus busiest (classes running in each day × period)
    grid = Counter((e.day_of_week, e.period_number) for e in entries)
    slot_times = {}
    for e in entries:
        slot_times.setdefault(e.period_number, f"{e.start_time}–{e.end_time}")

    # Faculty load
    load = Counter((e.faculty_id, e.faculty_name) for e in entries if e.faculty_id)
    faculty_rows = [{"id": fid, "name": name, "periods_per_week": n} for (fid, name), n in load.most_common()]

    return {
        "totals": {"classes_per_week": len(entries), "sections": len({e.section for e in entries}),
                   "rooms_in_timetable": len(booked), "rooms_total": len(rooms), "teaching_slots_per_week": slots_per_week,
                   "faculty_teaching": len(load), "faculty_profiles": sum(faculty_profiles.values())},
        "days": days, "periods": [{"n": p, "time": slot_times.get(p)} for p in periods],
        "grid": [{"day": d, "period": p, "classes": grid.get((d, p), 0)} for d in days for p in periods],
        "rooms": room_rows, "unused_rooms": unused, "departments": dept_rows, "faculty": faculty_rows,
    }


@router.get("/mine", summary="My week: a student's section timetable or a faculty member's classes")
def my_timetable(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    from backend.app.models.campus import FacultyProfileModel, UserModel
    from backend.app.models.services import StudentProfileModel
    entries, label, reason = [], None, None
    if current["role"] == "student":
        prof = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
        if not prof or not prof.year:
            reason = "Complete your academic details (department, year, section) on the Services page."
        else:
            rows = db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True).all()
            entries = [e for e in rows if _section_matches(e.section, prof.department, prof.year, prof.section)]
            label = f"{prof.department} · Year {prof.year}" + (f" · Section {prof.section}" if prof.section else "")
            if not entries:
                reason = f"The timetable for {label} hasn't been uploaded yet (only IT and Civil timetables are loaded)."
    else:
        user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
        fac = db.query(FacultyProfileModel).filter(FacultyProfileModel.email.ilike(user.email)).first() if user else None
        if not fac:
            reason = "Your account isn't linked to a faculty profile in the timetable (the emails must match)."
        else:
            entries = db.query(TimetableEntryModel).filter(TimetableEntryModel.faculty_id == fac.id,
                                                          TimetableEntryModel.is_active == True).all()
            label = fac.name
    entries.sort(key=lambda e: (e.day_of_week, e.period_number))
    sections = {e.section for e in entries}
    today = campus_today()
    subs = [s for s in db.query(SubstitutionModel).filter(SubstitutionModel.date == today, SubstitutionModel.status == "active").all()
            if s.section in sections or any(e.id for e in entries if e.faculty_id and e.faculty_id == s.original_faculty_id)]
    rooms = {c.id: {"name": c.name, "building": c.building, "floor": c.floor} for c in db.query(ClassroomModel).all()}
    return {
        "label": label, "reason": reason,
        "entries": [TimetableEntryOut.model_validate(e).model_dump() | {"room": rooms.get(e.classroom_id)} for e in entries],
        "substitutions_today": [{"period_number": s.period_number, "section": s.section, "subject_name": s.subject_name,
                                 "original_faculty_name": s.original_faculty_name, "replacement_faculty_name": s.replacement_faculty_name,
                                 "classroom_id": s.classroom_id} for s in subs],
    }


@router.get("/", response_model=List[TimetableEntryOut])
def list_entries(
    classroom_id: Optional[str]  = Query(None),
    day_of_week:  Optional[int]  = Query(None),
    faculty_id:   Optional[str]  = Query(None),
    section:      Optional[str]  = Query(None),
    department:   Optional[str]  = Query(None),
    semester:     Optional[int]  = Query(None),
    active_only:  bool           = Query(True),
    db: Session = Depends(get_db)
):
    q = db.query(TimetableEntryModel)
    if classroom_id: q = q.filter(TimetableEntryModel.classroom_id == classroom_id)
    if day_of_week is not None: q = q.filter(TimetableEntryModel.day_of_week == day_of_week)
    if faculty_id:   q = q.filter(TimetableEntryModel.faculty_id == faculty_id)
    if section:      q = q.filter(TimetableEntryModel.section == section)
    if department:   q = q.filter(TimetableEntryModel.department == department)
    if semester:     q = q.filter(TimetableEntryModel.semester == semester)
    if active_only:  q = q.filter(TimetableEntryModel.is_active == True)
    return q.order_by(TimetableEntryModel.day_of_week, TimetableEntryModel.period_number).all()

@router.post("/", response_model=TimetableEntryOut)
def create_entry(payload: TimetableEntryCreate, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    if not db.query(ClassroomModel).filter(ClassroomModel.id == payload.classroom_id).first():
        raise HTTPException(status_code=404, detail="Classroom not found")

    # Conflict Detection (Room, Faculty, Section)
    overlapping_entries = db.query(TimetableEntryModel).filter(
        TimetableEntryModel.day_of_week == payload.day_of_week,
        TimetableEntryModel.is_active == True
    ).all()

    for existing in overlapping_entries:
        if _overlaps(existing.start_time, existing.end_time, payload.start_time, payload.end_time):
            if existing.classroom_id == payload.classroom_id:
                raise HTTPException(status_code=400, detail=f"Room conflict: {payload.classroom_id} is already booked from {existing.start_time} to {existing.end_time}")
            if existing.faculty_id and payload.faculty_id and existing.faculty_id == payload.faculty_id:
                raise HTTPException(status_code=400, detail=f"Faculty conflict: {payload.faculty_name} is already teaching in {existing.classroom_id} from {existing.start_time} to {existing.end_time}")
            if existing.section == payload.section and existing.section != "":
                if not (existing.batch and payload.batch and existing.batch != payload.batch):
                    raise HTTPException(status_code=400, detail=f"Section conflict: Section {payload.section} is already scheduled in {existing.classroom_id} from {existing.start_time} to {existing.end_time}")

    entry = TimetableEntryModel(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.put("/{entry_id}", response_model=TimetableEntryOut)
def update_entry(entry_id: int, payload: TimetableEntryUpdate, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    entry = db.query(TimetableEntryModel).filter(TimetableEntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Snapshot the old state before mutating
    old_state = {
        "faculty_id":    entry.faculty_id,
        "faculty_name":  entry.faculty_name,
        "subject_id":    entry.subject_id,
        "subject_name":  entry.subject_name,
        "classroom_id":  entry.classroom_id,
        "section":       entry.section,
        "day_of_week":   entry.day_of_week,
        "period_number": entry.period_number,
        "start_time":    entry.start_time,
        "end_time":      entry.end_time,
        "semester":      entry.semester,
        "batch":         entry.batch,
    }

    update_data = payload.model_dump(exclude_none=True)
    for k, v in update_data.items():
        setattr(entry, k, v)

    # Audit log — permanent timetable edit
    changed_by = _admin["name"]
    audit = TimetableAuditLogModel(
        action="TIMETABLE_ENTRY_EDITED",
        details={"entry_id": entry_id, "before": old_state, "after": update_data},
        user=changed_by,
    )
    db.add(audit)
    db.commit()
    db.refresh(entry)

    # Broadcast WebSocket so Digital Twin updates immediately
    broadcast_timetable({
        "type": "TIMETABLE_UPDATED",
        "entry_id": entry_id,
        "classroom_id": entry.classroom_id,
        "action": "entry_edited",
    })

    return entry


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    entry = db.query(TimetableEntryModel).filter(TimetableEntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Deleted"}


def _with_changes(db: Session, entry, on_date: date) -> dict:
    """The entry as served on a date: an active substitution, else a date-range override, applied to a copy."""
    out = TimetableEntryOut.model_validate(entry).model_dump()
    sub = db.query(SubstitutionModel).filter(
        SubstitutionModel.classroom_id == entry.classroom_id, SubstitutionModel.period_number == entry.period_number,
        SubstitutionModel.date == on_date, SubstitutionModel.status == "active").first()
    if sub:
        out["faculty_id"] = sub.replacement_faculty_id or out["faculty_id"]
        out["faculty_name"] = sub.replacement_faculty_name
        return out | {"_sub": sub}
    ov = db.query(TimetableOverrideModel).filter(
        TimetableOverrideModel.classroom_id == entry.classroom_id, TimetableOverrideModel.period_number == entry.period_number,
        TimetableOverrideModel.start_date <= on_date, TimetableOverrideModel.end_date >= on_date).first()
    if ov:
        out["faculty_id"] = ov.new_faculty_id or out["faculty_id"]
        out["faculty_name"] = ov.new_faculty_name
        if ov.new_subject_name:
            out["subject_name"] = ov.new_subject_name
    return out


def current_class(db: Session, classroom_id: str, at_datetime: Optional[str] = None) -> CurrentClassResponse:
    """The class running in a room at a campus time (default: now, India time) and the next one."""
    room = db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    now = parse_campus_time(at_datetime) or campus_now()
    dow, cur_min = now.weekday(), now.hour * 60 + now.minute

    def day_entries(d):
        return db.query(TimetableEntryModel).filter(
            TimetableEntryModel.classroom_id == classroom_id, TimetableEntryModel.day_of_week == d,
            TimetableEntryModel.is_active == True).order_by(TimetableEntryModel.period_number).all()

    today = day_entries(dow)
    current = next((e for e in today if _time_to_minutes(e.start_time) <= cur_min < _time_to_minutes(e.end_time)), None)
    later = sorted((e for e in today if _time_to_minutes(e.start_time) > cur_min), key=lambda e: _time_to_minutes(e.start_time))
    next_e, next_date = (later[0], now.date()) if later else (None, None)
    if not next_e:   # first class on a following day, wrapping round the week
        for k in range(1, 8):
            d = (dow + k) % 7
            found = day_entries(d)
            if found:
                next_e, next_date = found[0], now.date() + timedelta(days=k)
                break

    cur = _with_changes(db, current, now.date()) if current else None
    nxt = _with_changes(db, next_e, next_date) if next_e else None
    sub = cur.pop("_sub", None) if cur else None
    if nxt:
        nxt.pop("_sub", None)
    return CurrentClassResponse(
        classroom_id=room.id, classroom_name=room.name, building=room.building, floor=room.floor,
        status="occupied" if cur else "available",
        day_name=DAY_NAMES[dow],
        current_entry=TimetableEntryOut(**cur) if cur else None,
        next_entry=TimetableEntryOut(**nxt) if nxt else None,
        is_substitution=bool(sub),
        substitution_reason=sub.reason if sub else None,
        substitution_original_faculty=sub.original_faculty_name if sub else None,
    )


@router.get("/classroom/{classroom_id}/current", response_model=CurrentClassResponse)
def get_current_class(
    classroom_id: str,
    at_datetime: Optional[str] = Query(None, description="Optional campus (India) time, e.g. 2026-10-26T10:30"),
    db: Session = Depends(get_db)
):
    return current_class(db, classroom_id, at_datetime)

@router.get("/classroom/{classroom_id}/week")
def get_week_schedule(classroom_id: str, db: Session = Depends(get_db)):
    room = db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    entries = db.query(TimetableEntryModel).filter(
        TimetableEntryModel.classroom_id == classroom_id,
        TimetableEntryModel.is_active    == True,
    ).order_by(TimetableEntryModel.day_of_week, TimetableEntryModel.period_number).all()
    schedule = {d: [] for d in DAY_NAMES[:6]}
    for e in entries:
        schedule[DAY_NAMES[e.day_of_week]].append(TimetableEntryOut.model_validate(e).model_dump())
    return {"classroom_id": classroom_id, "classroom_name": room.name, "schedule": schedule}

@router.get("/conflicts", response_model=ConflictReport)
def detect_conflicts(db: Session = Depends(get_db)):
    all_entries = db.query(TimetableEntryModel).filter(
        TimetableEntryModel.is_active == True
    ).all()

    conflicts: List[ConflictItem] = []
    by_day: dict = {}
    for e in all_entries:
        by_day.setdefault(e.day_of_week, []).append(e)

    for day, day_entries in by_day.items():
        day_name = DAY_NAMES[day]
        n = len(day_entries)
        for i in range(n):
            for j in range(i + 1, n):
                a, b = day_entries[i], day_entries[j]
                if not _overlaps(a.start_time, a.end_time, b.start_time, b.end_time):
                    continue
                # Combined class: two sections taught together (same room, teacher and subject) is not a clash
                if (a.classroom_id == b.classroom_id and a.faculty_id and a.faculty_id == b.faculty_id
                        and a.subject_name.strip().lower() == b.subject_name.strip().lower()):
                    continue

                if a.classroom_id == b.classroom_id:
                    conflicts.append(ConflictItem(
                        conflict_type="classroom",
                        description=f"{day_name}: Room {a.classroom_id} double-booked {a.start_time}-{a.end_time}",
                        entries=[TimetableEntryOut.model_validate(a), TimetableEntryOut.model_validate(b)]
                    ))

                if a.faculty_id and b.faculty_id and a.faculty_id == b.faculty_id:
                    conflicts.append(ConflictItem(
                        conflict_type="faculty",
                        description=f"{day_name} {a.start_time}-{a.end_time}: {a.faculty_name} assigned to {a.classroom_id} and {b.classroom_id} simultaneously",
                        entries=[TimetableEntryOut.model_validate(a), TimetableEntryOut.model_validate(b)]
                    ))

                if a.section == b.section and a.section != "":
                    if a.batch and b.batch and a.batch != b.batch:
                        continue
                    if a.classroom_id != b.classroom_id:
                        conflicts.append(ConflictItem(
                            conflict_type="section",
                            description=f"{day_name} {a.start_time}-{a.end_time}: Section {a.section} assigned to {a.classroom_id} and {b.classroom_id} simultaneously",
                            entries=[TimetableEntryOut.model_validate(a), TimetableEntryOut.model_validate(b)]
                        ))

    return ConflictReport(total_conflicts=len(conflicts), conflicts=conflicts)

@router.post("/import/csv")
async def import_csv(
    file: UploadFile = File(...),
    dry_run: bool = Query(False, description="If true, validate without inserting"),
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    content = await file.read(MAX_CSV_BYTES + 1)
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="CSV file too large (max 2 MB)")
    reader  = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))

    inserted, skipped, errors = 0, 0, []
    rows_to_insert = []

    for idx, row in enumerate(reader, start=2):
        try:
            raw_day = row.get("day_of_week", "").strip()
            if raw_day.isdigit():
                dow = int(raw_day)
            else:
                dow = DAY_MAP.get(raw_day.lower()) or DAY_ABBR.get(raw_day[:3].lower())
                if dow is None:
                    raise ValueError(f"Unknown day: {raw_day}")

            classroom_id = row["classroom_id"].strip()
            if not db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first():
                raise ValueError(f"Classroom '{classroom_id}' not found")

            entry = TimetableEntryModel(
                day_of_week   = dow,
                period_number = int(row["period_number"]),
                start_time    = row["start_time"].strip(),
                end_time      = row["end_time"].strip(),
                classroom_id  = classroom_id,
                subject_id    = row.get("subject_id", "").strip() or None,
                subject_name  = row["subject_name"].strip(),
                faculty_id    = row.get("faculty_id", "").strip() or None,
                faculty_name  = row["faculty_name"].strip(),
                department    = row.get("department", "IT").strip(),
                academic_year = row.get("academic_year", "2026-2027").strip(),
                section       = row["section"].strip(),
                semester      = int(row.get("semester", 7)),
                batch         = row.get("batch", "").strip() or None,
            )
            rows_to_insert.append(entry)
        except (KeyError, ValueError) as e:
            errors.append({"row": idx, "error": str(e)})
            skipped += 1

    if not dry_run:
        for entry in rows_to_insert:
            db.add(entry)
        db.commit()
        inserted = len(rows_to_insert)
    else:
        inserted = 0

    return {
        "dry_run": dry_run,
        "inserted": inserted,
        "would_insert": len(rows_to_insert) if dry_run else None,
        "skipped": skipped,
        "errors": errors,
    }

@router.post("/overrides", response_model=TimetableOverrideOut)
async def create_override(payload: TimetableOverrideCreate, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    payload.created_by = _admin["name"]
    # Create the override
    override = TimetableOverrideModel(**payload.model_dump())
    db.add(override)
    
    # Audit log
    audit = TimetableAuditLogModel(
        action="OVERRIDE_CREATED",
        details=payload.model_dump(mode="json"),
        user=payload.created_by
    )
    db.add(audit)
    db.commit()
    db.refresh(override)

    # Broadcast websocket update
    broadcast_timetable({
        "type": "TIMETABLE_UPDATED",
        "classroom_id": payload.classroom_id,
        "action": "override_created"
    })

    return override

@router.get("/overrides", response_model=List[TimetableOverrideOut])
def list_overrides(classroom_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(TimetableOverrideModel)
    if classroom_id:
        q = q.filter(TimetableOverrideModel.classroom_id == classroom_id)
    return q.all()
