from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io, csv
from backend.app.db.session import get_db
from backend.app.models.campus import TimetableEntryModel, ClassroomModel
from backend.app.schemas.campus import (
    TimetableEntryCreate, TimetableEntryUpdate, TimetableEntryOut,
    CurrentClassResponse, ConflictReport, ConflictItem
)

router = APIRouter()

DAY_NAMES  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_MAP    = {d.lower(): i for i, d in enumerate(DAY_NAMES)}
DAY_ABBR   = {d[:3].lower(): i for i, d in enumerate(DAY_NAMES)}

def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)

def _overlaps(a_start, a_end, b_start, b_end) -> bool:
    return _time_to_minutes(a_start) < _time_to_minutes(b_end) and            _time_to_minutes(a_end)   > _time_to_minutes(b_start)

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
def create_entry(payload: TimetableEntryCreate, db: Session = Depends(get_db)):
    if not db.query(ClassroomModel).filter(ClassroomModel.id == payload.classroom_id).first():
        raise HTTPException(status_code=404, detail="Classroom not found")
    entry = TimetableEntryModel(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.put("/{entry_id}", response_model=TimetableEntryOut)
def update_entry(entry_id: int, payload: TimetableEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(TimetableEntryModel).filter(TimetableEntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return entry

@router.delete("/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(TimetableEntryModel).filter(TimetableEntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Deleted"}

@router.get("/classroom/{classroom_id}/current", response_model=CurrentClassResponse)
def get_current_class(classroom_id: str, db: Session = Depends(get_db)):
    room = db.query(ClassroomModel).filter(ClassroomModel.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")

    now     = datetime.now()
    dow     = now.weekday()
    cur_min = _time_to_minutes(now.strftime("%H:%M"))

    today_entries = db.query(TimetableEntryModel).filter(
        TimetableEntryModel.classroom_id == classroom_id,
        TimetableEntryModel.day_of_week  == dow,
        TimetableEntryModel.is_active    == True,
    ).order_by(TimetableEntryModel.period_number).all()

    current = None
    for e in today_entries:
        if _time_to_minutes(e.start_time) <= cur_min < _time_to_minutes(e.end_time):
            current = e
            break

    future_today = [e for e in today_entries if _time_to_minutes(e.start_time) > cur_min]
    next_e = sorted(future_today, key=lambda e: _time_to_minutes(e.start_time))[0] if future_today else None

    if not next_e:
        for d in range(dow + 1, 6):
            nxt = db.query(TimetableEntryModel).filter(
                TimetableEntryModel.classroom_id == classroom_id,
                TimetableEntryModel.day_of_week  == d,
                TimetableEntryModel.is_active    == True,
            ).order_by(TimetableEntryModel.period_number).first()
            if nxt:
                next_e = nxt
                break

    return CurrentClassResponse(
        classroom_id   = room.id,
        classroom_name = room.name,
        building       = room.building,
        floor          = room.floor,
        status         = "occupied" if current else room.status,
        day_name       = DAY_NAMES[dow],
        current_entry  = TimetableEntryOut.model_validate(current) if current else None,
        next_entry     = TimetableEntryOut.model_validate(next_e)  if next_e  else None,
    )

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

                if a.classroom_id == b.classroom_id:
                    conflicts.append(ConflictItem(
                        conflict_type="classroom",
                        description=f"{day_name}: Room {a.classroom_id} double-booked {a.start_time}-{a.end_time}",
                        entries=[TimetableEntryOut.model_validate(a), TimetableEntryOut.model_validate(b)]
                    ))

                if a.faculty_id and b.faculty_id and a.faculty_id == b.faculty_id:
                    conflicts.append(ConflictItem(
                        conflict_type="faculty",
                        description=f"{day_name}: {a.faculty_name} assigned to {a.classroom_id} and {b.classroom_id} simultaneously",
                        entries=[TimetableEntryOut.model_validate(a), TimetableEntryOut.model_validate(b)]
                    ))

                if a.section == b.section and a.section != "":
                    if a.batch and b.batch and a.batch != b.batch:
                        continue
                    if a.classroom_id != b.classroom_id:
                        conflicts.append(ConflictItem(
                            conflict_type="section",
                            description=f"{day_name}: Section {a.section} assigned to {a.classroom_id} and {b.classroom_id} simultaneously",
                            entries=[TimetableEntryOut.model_validate(a), TimetableEntryOut.model_validate(b)]
                        ))

    return ConflictReport(total_conflicts=len(conflicts), conflicts=conflicts)

@router.post("/import/csv")
async def import_csv(
    file: UploadFile = File(...),
    dry_run: bool = Query(False, description="If true, validate without inserting"),
    db: Session = Depends(get_db)
):
    content = await file.read()
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
