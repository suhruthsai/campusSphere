"""Write-path checks for timetable, substitutions, classrooms, utilization. Every change is undone."""
import json
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
BASE = __import__("os").environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
env = Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()
pw = next(l.split("=", 1)[1].strip() for l in env if l.startswith("ADMIN_PASSWORD="))
fails = []


def call(m, p, t=None, b=None):
    r = urllib.request.Request(BASE + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                               headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {t}"} if t else {})})
    try:
        with urllib.request.urlopen(r, timeout=120) as x:
            return x.status, json.loads(x.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:300]


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  [{str(info)[:300]}]"))
    if not ok:
        fails.append(name)


tok = call("POST", "/auth/login", b={"email": "admin@suhruth.edu", "password": pw})[1]["access_token"]

# ── Timetable: edit one entry's room and put it back ──
s, tt = call("GET", "/timetable/", tok)
e = tt[0]
orig_room = e["classroom_id"]
s, rooms = call("GET", "/classrooms/", tok)
other = next(r["id"] for r in rooms if r["id"] != orig_room and r["location_type"] == "CLASSROOM")
s, d = call("PUT", f"/timetable/{e['id']}", tok, {"classroom_id": other})
check("timetable: move entry to another room", s == 200 and d.get("classroom_id") == other, (s, d))
s, d = call("PUT", f"/timetable/{e['id']}", tok, {"classroom_id": orig_room})
check("timetable: move it back", s == 200 and d.get("classroom_id") == orig_room, (s, d))
s, d = call("GET", "/timetable/conflicts", tok)
check("timetable: conflict report", s == 200, (s, d))
s, d = call("GET", f"/timetable/classroom/{orig_room}/current", tok)
check("timetable: classroom current class", s == 200, (s, d))

# ── Substitutions: create → edit → cancel ──
day = date.today() + timedelta(days=1)
while day.weekday() != e["day_of_week"]:
    day += timedelta(days=1)
s, fac = call("GET", "/faculty-profiles/", tok)
repl = next(f for f in fac if f["id"] != e["faculty_id"])
s, d = call("POST", "/substitutions/check-conflict", tok, {"replacement_faculty_id": repl["id"], "date": day.isoformat(),
                                                            "period_number": e["period_number"], "start_time": e["start_time"], "end_time": e["end_time"]})
check("substitution: conflict check", s == 200, (s, d))
payload = {"date": day.isoformat(), "period_number": e["period_number"], "start_time": e["start_time"], "end_time": e["end_time"],
           "classroom_id": e["classroom_id"], "section": e["section"], "subject_id": e["subject_id"], "subject_name": e["subject_name"],
           "original_faculty_id": e["faculty_id"], "original_faculty_name": e["faculty_name"],
           "replacement_faculty_id": repl["id"], "replacement_faculty_name": repl["name"], "reason": "Faculty Absent",
           "notes": "QA test", "created_by": "x"}
s, sub = call("POST", "/substitutions/", tok, payload)
check("substitution: create", s == 200 and sub.get("id"), (s, sub))
if s == 200:
    s, d = call("POST", "/substitutions/", tok, payload)
    check("substitution: duplicate slot refused", s in (400, 409), (s, d))
    s, d = call("PUT", f"/substitutions/{sub['id']}", tok, {"notes": "QA test edited", "updated_by": "x"})
    check("substitution: edit", s == 200, (s, d))
    s, d = call("GET", "/substitutions/", tok)
    check("substitution: listed", s == 200 and any(x["id"] == sub["id"] for x in (d if isinstance(d, list) else d.get("items", []))), (s, str(d)[:200]))
    s, d = call("POST", f"/substitutions/{sub['id']}/cancel", tok, {"reason": "QA cleanup", "cancelled_by": "x"})
    check("substitution: cancel", s == 200 and d.get("status") in ("cancelled", "CANCELLED"), (s, d))
    s, d = call("GET", f"/substitutions/{sub['id']}/history", tok)
    check("substitution: audit history", s in (200, 404), (s, d))

# ── Classrooms: create → update → delete ──
s, d = call("POST", "/classrooms/", tok, {"id": "QA-ROOM-1", "name": "QA Room", "building": "cse", "floor": 1, "capacity": 40})
check("classroom: create", s == 200, (s, d))
s, d = call("PUT", "/classrooms/QA-ROOM-1", tok, {"capacity": 45})
check("classroom: update", s == 200 and d.get("capacity") == 45, (s, d))
s, d = call("DELETE", "/classrooms/QA-ROOM-1", tok)
check("classroom: delete", s == 200, (s, d))

# ── Utilization: report and model ──
s, d = call("GET", "/ai/utilization/report", tok)
check("utilization: report", s == 200, (s, str(d)[:200]))
s, d = call("GET", "/ai/utilization/model", tok)
check("utilization: model", s == 200, (s, str(d)[:200]))

print("\n" + ("ALL PASSED" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
