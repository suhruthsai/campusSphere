"""The AI guide's data tools vs. the database (no Groq calls, so no API key or rate limit needed).
Usage: python tests/test_ai_tools.py <campussphere.db>"""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.stdout.reconfigure(encoding="utf-8")

from backend.app.ai import campus_tools as t  # noqa: E402
from backend.app.db.session import SessionLocal  # noqa: E402

c = sqlite3.connect(sys.argv[1])
db = SessionLocal()
ADMIN = {"role": "admin", "sub": "test"}
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{info}]" if info and not ok else ""))
    if not ok:
        fails.append(name)


def tool(tool_name, **args):
    return json.loads(t.run(db, ADMIN, tool_name, args))


check("every tool has a runner", all("error" not in tool(n) or "unknown tool" not in tool(n)["error"] for n in t.NAMES))
check("unknown tool reports an error", "error" in tool("nope"))

# Section timetables, every section and day, against the table
sections = [r[0] for r in c.execute("select distinct section from timetable_entries where is_active=1")]
bad = []
for sec in sections:
    for d, day in enumerate(t.DAYS[:6]):
        want = sorted(c.execute("select period_number, subject_name, classroom_id from timetable_entries "
                                "where is_active=1 and section=? and day_of_week=?", (sec, d)).fetchall())
        got = tool("section_timetable", section=sec.lower().replace("-", " "), day=day)
        rooms = dict(c.execute("select name, id from classrooms").fetchall())
        got_rows = sorted((x["period"], x["subject"], rooms.get(x["room"], x["room"])) for x in got.get("classes", []))
        # A substitution or override can change the subject on a date; none should exist unless the admin added one
        if got_rows != want:
            bad.append((sec, day))
check(f"section timetables match ({len(sections)} sections x 6 days)", not bad, bad[:3])
check("unknown section lists the loaded ones", tool("section_timetable", section="CSE-4A").get("sections_with_timetables") == sorted(sections))

# Teacher timetables
fac_id, fac_name = c.execute("select f.id, f.name from faculty_profiles f join timetable_entries t on t.faculty_id=f.id "
                             "where t.is_active=1 group by f.id order by count(*) desc limit 1").fetchone()
want = c.execute("select count(*) from timetable_entries where is_active=1 and faculty_id=?", (fac_id,)).fetchone()[0]
got = tool("faculty_timetable", name=fac_name.split(".")[-1], day="week")
mine = [f for f in got.get("faculty", []) if f["name"] == fac_name]
check("faculty week matches", mine and len(mine[0]["classes"]) == want, (fac_name, want, got)[:2])
check("unknown teacher -> error", "error" in tool("faculty_timetable", name="Nobody Atall"))

# A slot: running classes + free rooms = all timetabled rooms
timetabled = {r[0] for r in c.execute("select distinct classroom_id from timetable_entries where is_active=1")}
room_names = dict(c.execute("select id, name from classrooms").fetchall())
got = tool("classes_now", day="Tuesday", period=3)
busy = {r[0] for r in c.execute("select classroom_id from timetable_entries where is_active=1 and day_of_week=1 and period_number=3")}
check("slot: classes match", len(got["classes"]) == c.execute(
    "select count(*) from timetable_entries where is_active=1 and day_of_week=1 and period_number=3").fetchone()[0])
check("slot: free rooms = timetabled - busy", set(got["free_timetabled_rooms"]) == {room_names[r] for r in timetabled - busy})
now = tool("classes_now")
check("now: answers with the IST time", "IST" in now.get("now", ""))

# Rooms and buildings
code, name, floor = c.execute("select id, name, floor from classrooms where type='Lab' limit 1").fetchone()
got = tool("find_room", query=code)
check("find room by code", got.get("rooms") and got["rooms"][0]["code"] == code and got["rooms"][0]["floor"] == floor)
check("unknown room -> error", "error" in tool("find_room", query="zzz-no-room"))
b = tool("building_info")["buildings"]
check("all buildings listed", len(b) == c.execute("select count(*) from buildings").fetchone()[0])
check("room counts per building", sum(x["rooms_listed"] for x in b) == c.execute(
    "select count(*) from classrooms where building in (select id from buildings)").fetchone()[0])

# Services
s = tool("services_info")
check("services list every document", len(s["documents"]) >= 9 and all(d["approved_by"] for d in s["documents"]))

# Personal timetable needs a student profile; an unknown user gets a note, not an error
check("my_timetable without a profile explains why", "note" in json.loads(t.run(db, {"role": "student", "sub": "nobody"}, "my_timetable", {})))

db.close()
print(f"\n{len(fails)} failure(s)" + (": " + ", ".join(fails) if fails else ""))
sys.exit(1 if fails else 0)
