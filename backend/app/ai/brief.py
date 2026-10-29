"""
Mitra's Morning Brief: a short summary of the day for a signed-in student or faculty member, built
straight from the timetable, today's substitutions and their requests. No AI call: it is instant,
free and cannot make anything up. Mitra can read `speech` aloud.

  students: today's classes (now / next / first), substitutes, their requests (where each is waiting,
            what's ready or needs paying), an incomplete profile, pending no-dues;
  faculty:  today's classes, substitutes, requests waiting for their approval (and how late).
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from backend.app.ai import agent
from backend.app.ai.campus_guide import PLACES
from backend.app.core.campus_time import campus_now
from backend.app.models.leaving import ClearanceItemModel, ExitModel
from backend.app.models.services import DocumentRequestModel, RosterEntryModel, StudentProfileModel
from backend.app.student_services.catalog import STEP_SLA_HOURS

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
RECENT = timedelta(days=3)


def _minutes(hhmm: str) -> int:
    h, m = (hhmm or "0:0").split(":")[:2]
    return int(h) * 60 + int(m)


def _hours(h) -> str:
    if h is None:
        return ""
    return f"{max(1, round(h * 60))} min" if h < 1 else f"{round(h)} h" if h < 48 else f"{round(h / 24)} days"


def _room(e: dict) -> str:
    room = e.get("room") or {}
    name = room.get("name") or e.get("classroom_id")
    building = PLACES.get(room.get("building") or "", {}).get("name")
    return f"{name} ({building})" if building else name


def _item(kind: str, text: str, tone: str = "info", link: str = None) -> dict:
    return {"kind": kind, "text": text, "tone": tone, **({"link": link} if link else {})}


def _classes(db: Session, current: dict, now: datetime) -> list:
    from backend.app.api.v1.endpoints.timetable import my_timetable

    data = my_timetable(db=db, current=current)
    if data["reason"]:
        # Staff without a timetable (the Principal, the Admin Office) just don't get a classes line
        return [_item("classes", data["reason"], "muted", "/services")] if current["role"] == "student" else []
    dow, mins = now.weekday(), now.hour * 60 + now.minute
    # Lab batches share a period: keep one entry per period (and section, for faculty)
    seen, today = set(), []
    for e in sorted((e for e in data["entries"] if e["day_of_week"] == dow), key=lambda e: e["period_number"]):
        if (e["period_number"], e["section"]) not in seen:
            seen.add((e["period_number"], e["section"]))
            today.append(e)
    if not today:
        return [_item("classes", f"No classes on {DAY_NAMES[dow]}.", "muted")]
    items = []
    current_cls = next((e for e in today if _minutes(e["start_time"]) <= mins < _minutes(e["end_time"])), None)
    upcoming = [e for e in today if _minutes(e["start_time"]) > mins]
    who = "section" if current["role"] == "faculty" else None
    label = lambda e: e["subject_name"] + (f" with {e['section']}" if who else "")
    if not current_cls and len(upcoming) == len(today):
        first = today[0]
        items.append(_item("classes", f"{len(today)} class{'es' if len(today) != 1 else ''} today. The first is "
                           f"{label(first)} at {first['start_time']} in {_room(first)}."))
    else:
        if current_cls:
            items.append(_item("classes", f"Now: {label(current_cls)} in {_room(current_cls)}, until {current_cls['end_time']}."))
        if upcoming:
            nxt = upcoming[0]
            items.append(_item("classes", f"Next: {label(nxt)} at {nxt['start_time']} in {_room(nxt)}"
                               + (f", then {len(upcoming) - 1} more." if len(upcoming) > 1 else ".")))
        elif not current_cls:
            items.append(_item("classes", "Your classes are over for today.", "muted"))
    by_period = {(e["period_number"], e["section"]): e for e in today}
    for s in data["substitutions_today"]:
        e = by_period.get((s["period_number"], s["section"]))
        if e:
            items.append(_item("substitution", f"Period {s['period_number']} {s['subject_name']} is taken by "
                               f"{s['replacement_faculty_name']} today, instead of {s['original_faculty_name']}.", "warn"))
    return items


def _names(docs: list) -> str:
    """Bonafide Certificate · 'Bonafide Certificate (2)' when the same document appears twice."""
    counts = {}
    for d in docs:
        counts[d] = counts.get(d, 0) + 1
    return ", ".join(f"{d} ({n})" if n > 1 else d for d, n in counts.items())


def _requests(db: Session, current: dict) -> list:
    """At most four lines however many requests there are: the two longest waits, then one line each for
    the rest in progress, fees to pay, what's ready and what was turned down (the last two: recent only)."""
    summaries = {s["ref_no"]: s for s in agent.my_requests(db, current)["requests"]}   # the 10 latest
    reqs = db.query(DocumentRequestModel).filter(DocumentRequestModel.ref_no.in_(list(summaries))).all() if summaries else []
    utc_now = datetime.utcnow()
    waiting, unpaid, ready, rejected, processing = [], [], [], [], []
    for r in reqs:
        s = summaries[r.ref_no]
        changed = r.issued_at or r.updated_at or r.created_at
        recent = bool(changed) and utc_now - changed < RECENT
        if r.status == "in_review":
            waiting.append(s)
        elif r.status == "awaiting_payment":
            unpaid.append((s, r.amount))
        elif r.status == "processing":
            processing.append(s["document"])
        elif r.status == "approved" and recent:
            ready.append(s["document"])
        elif r.status == "rejected" and recent:
            rejected.append(s)
    items = []
    waiting.sort(key=lambda s: -(s.get("waiting_hours") or 0))
    for s in waiting[:2]:
        late = " That's past the 24-hour target." if s.get("overdue") else ""
        items.append(_item("request", f"Your {s['document']} is with the {s['with_desk'].split(' (')[0]} "
                           f"({_hours(s.get('waiting_hours'))}).{late}", "warn" if late else "info", "/services"))
    others = len(waiting) - 2 + len(processing)
    if others > 0:
        items.append(_item("request", f"{others} more request{'s' if others != 1 else ''} in progress.", "info", "/services"))
    for s, amount in unpaid[:1]:
        items.append(_item("request", f"Pay Rs {amount} on the Services page to start your {s['document']}.", "warn", "/services"))
    if ready:
        items.append(_item("request", f"Ready to download: {_names(ready)}.", "good", "/services"))
    if rejected:
        s = rejected[0]
        items.append(_item("request", f"Not approved: {s['document']} ({s['next'].split(': ', 1)[-1].rstrip('.')})"
                           + (f" and {len(rejected) - 1} more" if len(rejected) > 1 else "") + ".", "bad", "/services"))
    return items


def _student(db: Session, current: dict, now: datetime) -> list:
    items = []
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
    if not profile or not profile.year or not profile.section or not profile.roll_no or not profile.parent_name:
        items.append(_item("profile", "Complete your profile on the Services page, so Mitra can request "
                           "certificates for you.", "warn", "/services"))
    items += _requests(db, current)
    ex = db.query(ExitModel).filter(ExitModel.user_id == current["sub"], ExitModel.status == "in_progress").first()
    if ex:
        pending = db.query(ClearanceItemModel).filter(ClearanceItemModel.exit_id == ex.id,
                                                      ClearanceItemModel.status != "cleared").count()
        if pending:
            items.append(_item("leaving", f"No-dues clearance: {pending} section{'s' if pending != 1 else ''} still to sign off.",
                               "info", "/leaving"))
    return items


def _faculty(db: Session, current: dict) -> list:
    waiting = [r for r in db.query(DocumentRequestModel).filter(DocumentRequestModel.status == "in_review").all()
               if r.current_step < len(r.steps or []) and r.steps[r.current_step].get("approver_id") == current["sub"]]
    if not waiting:
        return []
    now = datetime.utcnow()
    ages = [(now - (r.step_since or r.created_at)).total_seconds() / 3600 for r in waiting]
    late = sum(1 for a in ages if a >= STEP_SLA_HOURS)
    text = (f"{len(waiting)} request{'s are' if len(waiting) != 1 else ' is'} waiting for your approval, "
            f"the oldest for {_hours(max(ages))}." + (f" {late} {'are' if late != 1 else 'is'} past the 24-hour target." if late else ""))
    return [_item("approvals", text, "warn" if late else "info", "/services/approvals")]


def _notices(db: Session, current: dict) -> list:
    """Urgent notices, then how many new ones arrived in the last three days."""
    from backend.app.api.v1.endpoints.announcements import for_viewer

    recent = [a for a in for_viewer(db, current) if a.created_at and datetime.utcnow() - a.created_at < RECENT]
    urgent = [a for a in recent if a.priority == "urgent"]
    items = [_item("notice", f"Urgent notice: {a.title}", "warn", "/notices") for a in urgent[:2]]
    rest = len(recent) - len(items)
    if rest > 0:
        items.append(_item("notice", f"{rest} new notice{'s' if rest != 1 else ''}: "
                           + ", ".join(a.title for a in recent if a not in urgent[:2])[:120], "info", "/notices"))
    return items


def _attendance(db: Session, current: dict) -> list:
    """Students: a warning below 75% (or when one more absence would drop them under it).
    Faculty: periods already held today that aren't marked yet."""
    from backend.app.api.v1.endpoints import attendance as att

    if current["role"] == "student":
        me = att.my_attendance(db, current)
        o = me.get("overall") if me.get("ready") else None
        if not o or not o["held"]:
            return []
        t, f = me["rules"]["target_pct"], me["rules"]["floor_pct"]
        if o["status"] == "detained":
            return [_item("attendance", f"Attendance {o['pct']}%: below {f}%. Attend the next {o['need_for_floor']} classes "
                          f"to get back above {f}%, {o['need_for_target']} for {t}%.", "bad", "/attendance")]
        if o["status"] == "condonation":
            return [_item("attendance", f"Attendance {o['pct']}%: attend the next {o['need_for_target']} classes to get back to {t}%.",
                          "warn", "/attendance")]
        if o["can_miss"] <= 2:
            return [_item("attendance", f"Attendance {o['pct']}%: you can miss only {o['can_miss']} more without dropping below {t}%.",
                          "warn", "/attendance")]
        return []
    if current["role"] == "faculty":
        todo = [c for c in att.classes(None, "mine", db, current)["classes"] if c["started"] and not c["marked"]]
        if todo:
            return [_item("attendance", f"{len(todo)} class{'es' if len(todo) != 1 else ''} today still to mark: "
                          + ", ".join(f"P{c['period']} {c['section']}" for c in todo[:4]) + ".", "warn", "/attendance")]
    return []


TITLES = {"dr", "prof", "mr", "mrs", "ms", "sri", "smt", "shri", "kum"}


def first_name(name: str) -> str:
    """'Dr. B. Udaysree' -> 'Udaysree', 'P.Amba Bhavani' -> 'Amba', 'Dr.DBV Ravi Sankar' -> 'Ravi':
    skip titles and initials, as names are written in Indian college lists. In a name that isn't all capitals,
    a short all-capitals word ('DBV') is initials too; roll-list names in capitals ('SAI REDDY') keep 'SAI'."""
    name = name or ""
    shouting = name.upper() == name
    for word in name.replace(".", ". ").split():
        w = word.strip(" .·,()")
        if len(w) <= 2 or w.lower() in TITLES or (not shouting and w.isupper() and len(w) <= 3):
            continue
        return w
    return "there"


# College roll lists write names surname first ("GOUNI MANISH KUMAR"). These words are never the given name, and
# these lead a given name ("MOHAMMED ...", "ABDUL AMAAN").
FAMILY_WORDS = {"reddy", "kumar", "goud", "gowd", "yadav", "rao", "naik", "nayak", "naidu", "chary", "chari", "begum",
                "khan", "singh", "sharma", "varma", "verma", "patel", "shaik", "sheikh"}
NAME_PREFIXES = {"mohammed", "mohammad", "mohd", "md", "syed", "abdul", "sri", "sree"}


def given_name(roll_list_name: str) -> str:
    """The given name in a surname-first roll-list name: 'GOUNI MANISH KUMAR' -> 'Manish', 'T SAI CHARAN' -> 'Sai'
    (an initial stands for the surname), 'FIRDOUS BEGUM' -> 'Firdous', 'ABDUL AMAAN' -> 'Amaan'. Names written
    given-name first ('AKHIL REDDY CHALLA') can come out wrong: students set 'Call me' in their profile."""
    words = [w.strip(" .·,()") for w in (roll_list_name or "").replace(".", ". ").split()]
    words = [w for w in words if w]
    if not words:
        return "there"
    rest = words if len(words[0]) <= 2 or words[0].lower() in NAME_PREFIXES else words[1:]
    for i, w in enumerate(rest):
        if len(w) > 2 and w.lower() not in FAMILY_WORDS and w.lower() not in NAME_PREFIXES:
            nxt = rest[i + 1] if i + 1 < len(rest) else ""
            if w.lower() == "sai" and len(nxt) > 2 and nxt.lower() not in FAMILY_WORDS:
                return f"Sai {nxt.title()}"            # 'Sai Kiran', not 'Sai'
            return w.title()
    return next((w.title() for w in words if len(w) > 2), "there")


def _student_first_name(db: Session, current: dict) -> str:
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
    if profile and profile.preferred_name:
        return profile.preferred_name
    entry = db.query(RosterEntryModel).filter(RosterEntryModel.roll_no == profile.roll_no).first()         if profile and profile.roll_no else None
    return given_name(entry.name) if entry else first_name(current.get("name"))


def build(db: Session, current: dict) -> dict:
    now = campus_now()
    first = _student_first_name(db, current) if current["role"] == "student" else first_name(current.get("name"))
    part = "morning" if now.hour < 12 else "afternoon" if now.hour < 17 else "evening"
    greeting = f"Good {part}, {first}."
    items = _notices(db, current) + _attendance(db, current) + _classes(db, current, now)
    if current["role"] == "student":
        items += _student(db, current, now)
    elif current["role"] in ("faculty", "admin", "staff"):
        items += _faculty(db, current)
    if len(items) == 1 and items[0]["tone"] == "muted" and current["role"] == "student":
        items.append(_item("tip", "Ask Mitra for a bonafide or NOC, or where your request is.", "muted"))
    return {
        "greeting": greeting,
        "date": now.strftime("%A, %d %B"),
        "items": items,
        "speech": " ".join([greeting] + [i["text"] for i in items]),
    }
