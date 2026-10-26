"""The campus clock. MVSR runs on India time (no daylight saving), whatever time zone the
server itself is set to, so "now" and "today" for timetables always come from here."""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

IST = timezone(timedelta(hours=5, minutes=30))


def campus_now() -> datetime:
    """Current India time as a naive datetime (the timetable stores plain HH:MM)."""
    return datetime.now(IST).replace(tzinfo=None)


def campus_today() -> date:
    return campus_now().date()


def parse_campus_time(value: Optional[str]) -> Optional[datetime]:
    """'2026-10-26T10:30', '2026-10-26 10:30' or a full ISO string, read as India time. None if unparseable."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.strip().replace(" ", "T"))
    except ValueError:
        return None
    return dt.astimezone(IST).replace(tzinfo=None) if dt.tzinfo else dt
