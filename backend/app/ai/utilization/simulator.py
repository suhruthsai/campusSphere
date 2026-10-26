"""
Attendance history simulator.

The institution has no recorded per-session headcounts yet, so this generates
HISTORY_WEEKS of plausible history from the *real* timetable. The generating
process mixes known patterns (slot, day, session type, semester rhythm) with
hidden per-faculty, per-section and per-subject effects that the model is never
told about — it has to learn them from past sessions, which is what makes the
held-out evaluation meaningful.

Rows are stored with source='simulated'. Real headcounts recorded by faculty
(source='recorded') go into the same table and are used the same way.
"""
import random
from statistics import NormalDist

import numpy as np
from sqlalchemy.orm import Session

from backend.app.models.campus import ClassroomModel, ClassSessionLogModel, TimetableEntryModel
from backend.app.ai.utilization.calendar import (
    HISTORY_WEEKS, days_since_exam, days_to_exam, enrolled_for, is_teaching_day, near_holiday,
    session_date, session_kind, stable_unit, week_of,
)

BASE_RATE = {"theory": 0.82, "lab": 0.91, "tutorial": 0.72, "project": 0.76, "activity": 0.58}
PERIOD_EFFECT = {1: -0.04, 2: 0.00, 3: 0.01, 4: -0.01, 5: -0.05, 6: -0.08}
DAY_EFFECT = {0: -0.03, 1: 0.01, 2: 0.01, 3: 0.00, 4: -0.02, 5: -0.10}
CANCELLATION_RATE = 0.02


def calendar_effect(d) -> float:
    """Semester rhythm, driven by facts in the published academic calendar."""
    effect = 0.0
    if week_of(d) <= 2:
        effect -= 0.06                     # semester just started
    to_exam = days_to_exam(d)
    if to_exam <= 14:
        effect += 0.05 * (14 - to_exam) / 14   # attendance rises as exams approach
    since = days_since_exam(d)
    if since <= 7:
        effect -= 0.04                     # post-exam slump
    if near_holiday(d):
        effect -= 0.08                     # long weekends / travel
    effect -= 0.003 * max(0, week_of(d) - 9)    # gradual mid-semester fatigue
    return effect


def _hidden(kind: str, key: str, sd: float) -> float:
    """Deterministic normal-ish effect for a faculty/section/subject."""
    u = min(max(stable_unit(f"{kind}:{key}"), 1e-4), 1 - 1e-4)
    return NormalDist(0, sd).inv_cdf(u)


def attendance_probability(entry, kind: str, d) -> float:
    period_adj = PERIOD_EFFECT.get(entry.period_number, 0.0)
    if kind == "lab":
        period_adj *= 0.5                  # labs are hands-on; slot matters less
    day_adj = DAY_EFFECT.get(entry.day_of_week, 0.0)
    if kind == "activity" and entry.day_of_week == 5:
        day_adj -= 0.10                    # Saturday activities are skipped most
    p = (BASE_RATE[kind] + period_adj + day_adj + calendar_effect(d)
         + _hidden("faculty", entry.faculty_id or entry.faculty_name, 0.04)
         + _hidden("section", entry.section, 0.03)
         + _hidden("subject", entry.subject_name, 0.03))
    return float(np.clip(p, 0.15, 0.98))


def simulate_history(db: Session, seed: int = 2026) -> int:
    """Fill class_session_logs with simulated history. Returns rows inserted.
    Does nothing if any history already exists."""
    if db.query(ClassSessionLogModel.id).first() is not None:
        return 0

    rng = np.random.default_rng(seed)
    py_rng = random.Random(seed)
    rooms = {r.id: r for r in db.query(ClassroomModel).all()}
    entries = db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True).all()

    rows = []
    for week in range(1, HISTORY_WEEKS + 1):
        for e in entries:
            d = session_date(week, e.day_of_week)
            if not is_teaching_day(d) or py_rng.random() < CANCELLATION_RATE:
                continue
            room = rooms.get(e.classroom_id)
            capacity = room.capacity if room else 60
            kind = session_kind(e.subject_name, room.location_type if room else "CLASSROOM")
            enrolled = enrolled_for(e.section, e.batch)
            p = attendance_probability(e, kind, d)
            p_session = float(np.clip(p + rng.normal(0, 0.035), 0.05, 0.99))   # day-to-day noise
            present = int(rng.binomial(enrolled, p_session))
            rows.append(ClassSessionLogModel(
                date=d, timetable_entry_id=e.id, classroom_id=e.classroom_id,
                enrolled=enrolled, present=present, capacity=capacity, source="simulated",
            ))
    db.add_all(rows)
    db.commit()
    return len(rows)
