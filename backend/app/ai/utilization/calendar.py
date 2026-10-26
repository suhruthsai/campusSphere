"""Academic calendar and session descriptors shared by the simulator and the model."""
import math
import zlib
from datetime import date, timedelta

# Odd semester 2026-27. Week 1 starts on SEMESTER_START (a Monday).
SEMESTER_START = date(2026, 6, 22)
HISTORY_WEEKS = 16              # weeks of history available for training
MIDSEM_EXAM_WEEK = 8            # no regular classes
ENDSEM_EXAM_WEEK = 19           # end-semester exams begin
# Varalakshmi Vratham, Ganesh Chaturthi, Gandhi Jayanti
HOLIDAYS = {date(2026, 8, 28), date(2026, 9, 14), date(2026, 10, 2)}
PERIODS_PER_DAY = 6
TEACHING_DAYS = 6               # Mon–Sat

ACTIVITY_WORDS = ("library", "sports", "counselling", "crt", "soft skills", "mentoring", "fitness")
PROJECT_WORDS = ("project", "internship", "seminar")
HALF_BATCHES = {"1", "2", "G1", "G2"}
ELECTIVE_SHARE = {"DM": 0.40, "OR": 0.35, "SS": 0.25}   # share of a section in each elective


def week_of(d: date) -> int:
    return (d - SEMESTER_START).days // 7 + 1


def week_start(week: int) -> date:
    return SEMESTER_START + timedelta(weeks=week - 1)


def session_date(week: int, day_of_week: int) -> date:
    return week_start(week) + timedelta(days=day_of_week)


def is_teaching_day(d: date) -> bool:
    return week_of(d) != MIDSEM_EXAM_WEEK and d not in HOLIDAYS and d.weekday() < TEACHING_DAYS


# Calendar facts known in advance (published academic calendar) — usable as model features
def days_to_exam(d: date) -> int:
    """Days until the next exam block starts (capped at 60)."""
    starts = [week_start(MIDSEM_EXAM_WEEK), week_start(ENDSEM_EXAM_WEEK)]
    upcoming = [(s - d).days for s in starts if s >= d]
    return min(min(upcoming), 60) if upcoming else 60


def days_since_exam(d: date) -> int:
    """Days since the last exam block ended (capped at 60)."""
    end_midsem = week_start(MIDSEM_EXAM_WEEK) + timedelta(days=6)
    return min((d - end_midsem).days, 60) if d > end_midsem else 60


def near_holiday(d: date) -> int:
    """1 if the day before or after is a holiday (long weekends, travel)."""
    return int((d - timedelta(days=1)) in HOLIDAYS or (d + timedelta(days=1)) in HOLIDAYS)


def session_kind(subject_name: str, location_type: str) -> str:
    s = subject_name.lower()
    if any(w in s for w in ACTIVITY_WORDS):
        return "activity"
    if any(w in s for w in PROJECT_WORDS):
        return "project"
    if "lab" in s or location_type == "LABORATORY":
        return "lab"
    if "tutorial" in s:
        return "tutorial"
    return "theory"


def batch_group(batch) -> str:
    if not batch:
        return "full"
    return "half" if batch in HALF_BATCHES else "elective"


def stable_unit(key: str) -> float:
    """Deterministic pseudo-random number in [0, 1) for a string key."""
    return (zlib.crc32(key.encode()) % 100_000) / 100_000


def section_strength(section: str) -> int:
    return 56 + int(stable_unit("strength:" + section) * 11)   # 56–66 students


def enrolled_for(section: str, batch) -> int:
    strength = section_strength(section)
    group = batch_group(batch)
    if group == "half":
        return math.ceil(strength / 2)
    if group == "elective":
        return round(strength * ELECTIVE_SHARE.get(batch, 0.33))
    return strength
