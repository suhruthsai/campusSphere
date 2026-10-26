"""Room 'current class / next class' answers vs. the timetable, for many rooms and times; substitution case."""
import json
import random
import sqlite3
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
db, env = sys.argv[1], Path(sys.argv[2])
pw = next(l.split("=", 1)[1].strip() for l in env.read_text(encoding="utf-8").splitlines() if l.startswith("ADMIN_PASSWORD="))
fails = []


def call(m, p, t=None, b=None):
    r = urllib.request.Request(__import__("os").environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1" + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                               headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {t}"} if t else {})})
    with urllib.request.urlopen(r) as x:
        return json.loads(x.read())


tok = call("POST", "/auth/login", b={"email": "admin@suhruth.edu", "password": pw})["access_token"]
c = sqlite3.connect(db)
rows = c.execute("select id, day_of_week, period_number, start_time, end_time, classroom_id, subject_name, faculty_name from timetable_entries where is_active=1").fetchall()
tm = lambda s: int(s[:2]) * 60 + int(s[3:5])
rooms = sorted({r[5] for r in rows})
monday = date(2026, 10, 26)   # a Monday
random.seed(7)
checked = 0
for _ in range(120):
    room = random.choice(rooms)
    dow = random.randint(0, 6)
    mins = random.choice([9 * 60 + 29, 9 * 60 + 30, 10 * 60 + 29, 10 * 60 + 30, 11 * 60 + 35, 12 * 60 + 0, 13 * 60 + 50, 15 * 60 + 15, 16 * 60 + 14, 16 * 60 + 15, 8 * 60])
    when = monday + timedelta(days=dow)
    at = f"{when.isoformat()}T{mins // 60:02d}:{mins % 60:02d}"
    truth = [r for r in rows if r[5] == room and r[1] == dow and tm(r[3]) <= mins < tm(r[4])]
    later = sorted((r for r in rows if r[5] == room and r[1] == dow and tm(r[3]) > mins), key=lambda r: tm(r[3]))
    nxt = later[0] if later else None
    if not nxt:
        for k in range(1, 8):
            d = (dow + k) % 7
            day = sorted((r for r in rows if r[5] == room and r[1] == d), key=lambda r: r[2])
            if day:
                nxt = day[0]
                break
    for path in (f"/classrooms/{room}/current?at_datetime={at}", f"/timetable/classroom/{room}/current?at_datetime={at}"):
        got = call("GET", path, tok)
        cur_id = got["current_entry"]["id"] if got["current_entry"] else None
        nxt_id = got["next_entry"]["id"] if got["next_entry"] else None
        exp_cur = truth[0][0] if truth else None
        exp_nxt = nxt[0] if nxt else None
        if cur_id != exp_cur or nxt_id != exp_nxt:
            fails.append((path, cur_id, exp_cur, nxt_id, exp_nxt))
        checked += 1
print(f"current/next answers checked: {checked}, mismatches: {len(fails)}")
for f in fails[:8]:
    print("  MISMATCH", f)

# Substitution: on a specific Tuesday, P1 in some room -> replacement shown by both endpoints
e = next(r for r in rows if r[1] == 1 and r[2] == 1)
tue = monday + timedelta(days=1)
fac = call("GET", "/faculty-profiles/", tok)
busy = {r[7] for r in rows if r[1] == 1 and r[2] == 1}   # faculty already teaching Tuesday P1
repl = next(f for f in fac if f["name"] not in busy)
entry = next(x for x in call("GET", f"/timetable/?classroom_id={e[5]}&day_of_week=1", tok) if x["id"] == e[0])
sub = call("POST", "/substitutions/", tok, {"date": tue.isoformat(), "period_number": 1, "start_time": e[3], "end_time": e[4],
                                            "classroom_id": e[5], "section": entry["section"], "subject_id": entry["subject_id"],
                                            "subject_name": e[6], "original_faculty_id": entry["faculty_id"], "original_faculty_name": e[7],
                                            "replacement_faculty_id": repl["id"], "replacement_faculty_name": repl["name"],
                                            "reason": "Faculty Absent", "notes": "QA truth check", "created_by": "x"})
try:
    for path in (f"/classrooms/{e[5]}/current?at_datetime={tue.isoformat()}T09:45", f"/timetable/classroom/{e[5]}/current?at_datetime={tue.isoformat()}T09:45"):
        got = call("GET", path, tok)
        ok = got["is_substitution"] and got["current_entry"]["faculty_name"] == repl["name"] and got["substitution_original_faculty"] == e[7]
        print(("PASS" if ok else "FAIL"), "substitution shown by", path.split("?")[0])
        if not ok:
            fails.append(("sub", path, got))
    # the official timetable entry itself is untouched
    still = c.execute("select faculty_name from timetable_entries where id=?", (e[0],)).fetchone()[0]
    print(("PASS" if still == e[7] else "FAIL"), "timetable record unchanged by the lookup")
    if still != e[7]:
        fails.append("mutated")
finally:
    c.execute("delete from substitution_audit_logs where substitution_id=?", (sub["id"],))
    c.execute("delete from substitutions where id=?", (sub["id"],))
    c.commit()
print("\n" + ("ALL PASSED" if not fails else f"{len(fails)} FAILED"))
sys.exit(1 if fails else 0)
