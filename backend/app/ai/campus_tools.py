"""
Read-only campus data for the AI guide: what's running now, section / faculty / personal timetables,
rooms, buildings and the certificate services. Each tool returns compact JSON for the model.
Nothing here writes to the database.
"""
import json
import re
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from backend.app.core.campus_time import campus_now
from backend.app.models.campus import BuildingModel, ClassroomModel, FacultyProfileModel, TimetableEntryModel

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
PERIODS = "P1 09:30-10:30, P2 10:30-11:30, (break), P3 11:40-12:40, P4 12:40-13:40, (lunch), P5 14:15-15:15, P6 15:15-16:15"

TOOLS = [
    {"type": "function", "function": {
        "name": "classes_now",
        "description": "Classes running right now (India time) in every timetabled room, or at another day/period. "
                       "Use for 'what's happening now', 'is room X free', 'which classes are on in the Civil & IT block'.",
        "parameters": {"type": "object", "properties": {
            "day": {"type": ["string", "null"], "description": "Optional weekday, e.g. 'Tuesday'. Default: today."},
            "period": {"type": ["integer", "null"], "description": "Optional period 1-6. Default: the current time."},
        }}}},
    {"type": "function", "function": {
        "name": "section_timetable",
        "description": "A section's classes. Sections look like 'IT-2A' (IT, 2nd year, section A) or 'Civil-5' (Civil, semester 5).",
        "parameters": {"type": "object", "properties": {
            "section": {"type": "string"},
            "day": {"type": ["string", "null"], "description": "Weekday, 'today', 'tomorrow' or 'week'. Default: today."},
        }, "required": ["section"]}}},
    {"type": "function", "function": {
        "name": "faculty_timetable",
        "description": "A teacher's classes (search by part of their name).",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"},
            "day": {"type": ["string", "null"], "description": "Weekday, 'today', 'tomorrow' or 'week'. Default: today."},
        }, "required": ["name"]}}},
    {"type": "function", "function": {
        "name": "my_timetable",
        "description": "The signed-in user's own classes (their section if a student, their teaching if faculty).",
        "parameters": {"type": "object", "properties": {
            "day": {"type": ["string", "null"], "description": "Weekday, 'today', 'tomorrow' or 'week'. Default: today."},
        }}}},
    {"type": "function", "function": {
        "name": "find_room",
        "description": "Look up rooms and labs by name or code (e.g. 'IoT lab', 'CE-IT-201'): building, floor, seats, type.",
        "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "building_info",
        "description": "The campus buildings: type, floors, departments and how many rooms are listed. Optional name filter.",
        "parameters": {"type": "object", "properties": {"name": {"type": ["string", "null"]}}}}},
    {"type": "function", "function": {
        "name": "services_info",
        "description": "Certificates students can request in CampusSphere (bonafide, NOC, TC, PC, CMM, transcripts...): "
                       "where to apply, who approves, fees; plus the joining and leaving (no-dues) processes.",
        "parameters": {"type": "object", "properties": {}}}},
]
NAMES = {t["function"]["name"] for t in TOOLS}


def _rooms(db):
    b = {x.id: x.name for x in db.query(BuildingModel).all()}
    return {c.id: {"room": c.name, "building": b.get(c.building, c.building), "floor": c.floor} for c in db.query(ClassroomModel).all()}


def _day(value: Optional[str]):
    """Weekday index for a day word, None for the whole week."""
    v = (value or "today").strip().lower()
    today = campus_now().weekday()
    if v in ("week", "all", "whole week"):
        return None
    if v == "today":
        return today
    if v == "tomorrow":
        return (today + 1) % 7
    for i, d in enumerate(DAYS):
        if d.lower().startswith(v[:3]):
            return i
    return today


def _entries(db, **filters):
    q = db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True)  # noqa: E712
    for k, v in filters.items():
        if v is not None:
            q = q.filter(getattr(TimetableEntryModel, k) == v)
    return q.order_by(TimetableEntryModel.day_of_week, TimetableEntryModel.period_number).all()


def _fmt(db, entries, rooms, with_section=True, with_faculty=True):
    from backend.app.api.v1.endpoints.timetable import _with_changes
    now = campus_now()
    out = []
    for e in entries:
        # Today's and later this week's substitutions are applied for the date the class next happens
        on = now.date() + timedelta(days=(e.day_of_week - now.weekday()) % 7)
        x = _with_changes(db, e, on)
        sub = x.pop("_sub", None)
        r = rooms.get(e.classroom_id, {})
        row = {"day": DAYS[e.day_of_week], "period": e.period_number, "time": f"{e.start_time}-{e.end_time}",
               "subject": x["subject_name"], "room": r.get("room", e.classroom_id), "building": r.get("building"), "floor": r.get("floor")}
        if with_section:
            row["section"] = e.section
        if with_faculty:
            row["faculty"] = x.get("faculty_name")
        if sub:
            row["substitute_for"] = sub.original_faculty_name
        out.append(row)
    return out


def _norm_section(s: str) -> str:
    s = re.sub(r"\s+", "", s or "").upper().replace("CIVIL", "Civil")
    m = re.match(r"^(IT|Civil|CSE|ECE)[-_]?(\d)([A-Z]?)$", s)
    return f"{m.group(1)}-{m.group(2)}{m.group(3)}" if m else s


def classes_now(db, day=None, period=None):
    from backend.app.api.v1.endpoints.timetable import current_class
    now = campus_now()
    d = _day(day) if day else now.weekday()
    rooms = _rooms(db)
    if period:
        rows = _entries(db, day_of_week=d, period_number=int(period))
        busy = {e.classroom_id for e in rows}
        free = sorted(r["room"] for rid, r in rooms.items() if rid not in busy and rid in {e.classroom_id for e in _entries(db)})
        return {"when": f"{DAYS[d]} period {period}", "classes": _fmt(db, rows, rooms), "free_timetabled_rooms": free}
    if d != now.weekday():
        return {"when": DAYS[d], "note": "Give a period (1-6) to see one slot."}
    running, free = [], []
    for rid in sorted({e.classroom_id for e in _entries(db)}):
        c = current_class(db, rid)
        r = rooms.get(rid, {})
        if c.current_entry:
            e = c.current_entry
            running.append({"room": r.get("room", rid), "building": r.get("building"), "floor": r.get("floor"),
                            "section": e.section, "subject": e.subject_name, "faculty": e.faculty_name,
                            "until": e.end_time, **({"substitute_for": c.substitution_original_faculty} if c.is_substitution else {})})
        else:
            free.append(r.get("room", rid))
    return {"now": now.strftime("%A %H:%M") + " IST", "running": running,
            "free_timetabled_rooms": free if running else f"all {len(free)}",
            **({} if running else {"note": "No class is running at this time (outside class hours, a break, or Sunday)."})}


def section_timetable(db, section, day=None):
    sec = _norm_section(section)
    known = sorted({e.section for e in _entries(db)})
    if sec not in known:
        return {"error": f"No timetable for '{section}'.", "sections_with_timetables": known,
                "note": "Only the IT and Civil timetables are loaded so far."}
    d = _day(day)
    return {"section": sec, "day": DAYS[d] if d is not None else "whole week",
            "classes": _fmt(db, _entries(db, section=sec, day_of_week=d), _rooms(db), with_section=False)}


def faculty_timetable(db, name, day=None):
    q = (name or "").strip()
    fac = [f for f in db.query(FacultyProfileModel).all() if q.lower().replace(".", "") in f.name.lower().replace(".", "")]
    if not fac:
        return {"error": f"No teacher matching '{name}' in the loaded timetables (IT and Civil)."}
    if len(fac) > 5:
        return {"matches": [f.name for f in fac[:15]], "note": "Several teachers match; ask which one."}
    d = _day(day)
    rooms = _rooms(db)
    return {"day": DAYS[d] if d is not None else "whole week", "faculty": [
        {"name": f.name, "department": f.department, "designation": f.designation,
         "classes": _fmt(db, _entries(db, faculty_id=f.id, day_of_week=d), rooms, with_faculty=False)} for f in fac]}


def my_timetable(db, current, day=None):
    from backend.app.api.v1.endpoints.timetable import my_timetable as mine
    data = mine(db=db, current=current)
    if data["reason"]:
        return {"note": data["reason"]}
    d = _day(day)
    ids = [e["id"] for e in data["entries"] if d is None or e["day_of_week"] == d]
    rows = db.query(TimetableEntryModel).filter(TimetableEntryModel.id.in_(ids)).order_by(
        TimetableEntryModel.day_of_week, TimetableEntryModel.period_number).all() if ids else []
    return {"who": data["label"], "day": DAYS[d] if d is not None else "whole week",
            "classes": _fmt(db, rows, _rooms(db), with_section=current["role"] != "student")}


def find_room(db, query):
    q = (query or "").strip().lower()
    words = [w for w in re.split(r"\W+", q) if w and w not in ("lab", "room", "the")] or [q]
    rooms = _rooms(db)
    hits = [c for c in db.query(ClassroomModel).all()
            if q in c.id.lower() or q in c.name.lower() or all(w in (c.id + " " + c.name).lower() for w in words)]
    if not hits:
        return {"error": f"No room matching '{query}'.", "note": "Rooms are listed for the Civil & IT Block so far."}
    return {"rooms": [{"code": c.id, "name": c.name, "type": c.type, "seats": c.capacity,
                       "building": rooms[c.id]["building"], "floor": c.floor} for c in hits[:10]]}


def building_info(db, name=None):
    count = {}
    for c in db.query(ClassroomModel).all():
        count[c.building] = count.get(c.building, 0) + 1
    q = (name or "").lower()
    return {"buildings": [{"name": b.name, "type": b.type, "floors": b.floors, "departments": b.departments or [],
                           "rooms_listed": count.get(b.id, 0)}
                          for b in db.query(BuildingModel).all() if not q or q in b.name.lower() or q in b.id]}


def services_info(db):
    from backend.app.api.v1.endpoints.services import _fees
    from backend.app.student_services.catalog import public_catalog
    docs = [{"document": d["name"], "apply_at": d["counter_name"], "approved_by": [s["label"] for s in d["chain"]],
             "fee_rupees": d["fee"], "per_copy": d["per_copy"], "about": d["description"]} for d in public_catalog(_fees(db))]
    return {"how": "Students request documents in CampusSphere: Services page, or click the counter on the 3D campus. "
                   "The request goes through each approver in order; the signed PDF (with a QR code to verify) is downloaded "
                   "from the Services page once approved.",
            "documents": docs,
            "joining": "New TGEAPCET joinees: Joining page — upload documents, the Admin Office verifies, pay college fees, "
                       "hand in originals, then enrolment with a roll number.",
            "leaving": "Final-year / leaving students: Leaving page — no-dues clearance from library, accounts, department, "
                       "transport, Exam Cell, placement and sports, then TC / PC / CMM / transcripts."}


def run(db: Session, current: dict, name: str, args: dict) -> str:
    try:
        if name == "classes_now":
            out = classes_now(db, args.get("day"), args.get("period"))
        elif name == "section_timetable":
            out = section_timetable(db, args.get("section", ""), args.get("day"))
        elif name == "faculty_timetable":
            out = faculty_timetable(db, args.get("name", ""), args.get("day"))
        elif name == "my_timetable":
            out = my_timetable(db, current, args.get("day"))
        elif name == "find_room":
            out = find_room(db, args.get("query", ""))
        elif name == "building_info":
            out = building_info(db, args.get("name"))
        elif name == "services_info":
            out = services_info(db)
        else:
            out = {"error": f"unknown tool {name}"}
    except Exception as e:  # noqa: BLE001 — a tool failure should be reported to the model, not crash the chat
        out = {"error": f"lookup failed: {type(e).__name__}"}
    return _fit(out)


def _fit(out, limit: int = 5000) -> str:
    """JSON for the model, kept under `limit` characters by dropping detail, then rows — never cut mid-JSON."""
    dump = lambda o: json.dumps(o, ensure_ascii=False, default=str, separators=(",", ":"))  # noqa: E731
    text = dump(out)
    if len(text) <= limit:
        return text
    lists = [out[k] for k in ("classes", "running") if isinstance(out.get(k), list)]
    lists += [f["classes"] for f in out.get("faculty", []) if isinstance(f, dict)]
    for rows in lists:                     # one short line per class: "Tue P1 09:30-10:30 IoT Lab @ IoT Lab (CE-IT-18) F0 | IT-4A | Ch.Srujana"
        rows[:] = [f"{r['day'][:3]} P{r['period']} {r['time']} {r['subject']} @ {r['room']} F{r['floor']}"
                   + "".join(f" | {r[k]}" for k in ("section", "faculty") if r.get(k))
                   + (f" (substitute for {r['substitute_for']})" if r.get("substitute_for") else "")
                   if isinstance(r, dict) and "day" in r else r for r in rows]
    while len(text := dump(out)) > limit and any(lists):
        longest = max(lists, key=len)
        del longest[len(longest) // 2:]
        out["note"] = "List shortened; ask about one day or period for the rest."
    return text
