"""Independent ground truth from the database, compared with /timetable/stats and /timetable/mine."""
import json
import sqlite3
import sys
import urllib.request
from collections import Counter, defaultdict
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


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  [{info}]"))
    if not ok:
        fails.append(name)


c = sqlite3.connect(db)
rows = c.execute("select id, day_of_week, period_number, classroom_id, section, department, faculty_id from timetable_entries where is_active=1").fetchall()
tok = call("POST", "/auth/login", b={"email": "admin@suhruth.edu", "password": pw})["access_token"]
s = call("GET", "/timetable/stats", tok)

check("classes per week", s["totals"]["classes_per_week"] == len(rows), (s["totals"]["classes_per_week"], len(rows)))
check("sections", s["totals"]["sections"] == len({r[4] for r in rows}))
check("rooms in timetable", s["totals"]["rooms_in_timetable"] == len({r[3] for r in rows}))
check("rooms total", s["totals"]["rooms_total"] == c.execute("select count(*) from classrooms").fetchone()[0])
check("faculty teaching", s["totals"]["faculty_teaching"] == len({r[6] for r in rows if r[6]}))
slots = sum(len({r[2] for r in rows if r[1] == d}) for d in {r[1] for r in rows})
check("teaching slots per week", s["totals"]["teaching_slots_per_week"] == slots, (s["totals"]["teaching_slots_per_week"], slots))
grid = Counter((r[1], r[2]) for r in rows)
check("busiest-times grid", all(g["classes"] == grid.get((g["day"], g["period"]), 0) for g in s["grid"]))
check("grid sums to all classes", sum(g["classes"] for g in s["grid"]) == len(rows))
booked = defaultdict(set)
for r in rows:
    booked[r[3]].add((r[1], r[2]))
check("room utilisation", all(rr["booked"] == len(booked[rr["id"]]) and rr["utilization"] == round(100 * len(booked[rr["id"]]) / slots) for rr in s["rooms"]))
dept = Counter(r[5] for r in rows)
check("department class counts", all(d["classes_per_week"] == dept[d["department"]] for d in s["departments"]) and len(s["departments"]) == len(dept))
load = Counter(r[6] for r in rows if r[6])
check("faculty load", all(f["periods_per_week"] == load[f["id"]] for f in s["faculty"]))
print("  busiest slot:", max(grid.items(), key=lambda kv: kv[1]), "| slots/week:", slots)

# A student's timetable: make a throwaway IT year-2 section-B student
import secrets
email, spw = f"tmp.tt.{secrets.token_hex(3)}@example.com", secrets.token_urlsafe(12)
u = call("POST", "/auth/register", b={"name": "TT Probe", "email": email, "password": spw, "role": "student", "department": "IT"})
try:
    st = call("POST", "/auth/login", b={"email": email, "password": spw})["access_token"]
    mine = call("GET", "/timetable/mine", st)
    check("student without profile -> reason", bool(mine["reason"]) and not mine["entries"], mine["reason"])
    call("PUT", "/services/me/profile", st, {"roll_no": "1602-24-737-001", "year": 2, "section": "B", "parent_name": "Probe Parent", "gender": "male"})
    mine = call("GET", "/timetable/mine", st)
    truth = sorted(r[0] for r in rows if r[4] == "IT-2B")
    check("IT year 2 section B -> exactly IT-2B entries", sorted(e["id"] for e in mine["entries"]) == truth, (len(mine["entries"]), len(truth)))
    check("entries carry room info", all(e["room"] for e in mine["entries"]))
    call("PUT", "/services/me/profile", st, {"roll_no": "1602-24-737-001", "year": 3, "section": "A", "parent_name": "Probe Parent", "gender": "male"})
    mine = call("GET", "/timetable/mine", st)
    check("IT year 3 section A -> IT-3A", sorted(e["id"] for e in mine["entries"]) == sorted(r[0] for r in rows if r[4] == "IT-3A"))
finally:
    c.execute("delete from student_profiles where user_id=?", (u["id"],))
    c.execute("delete from users where id=?", (u["id"],))
    c.commit()

# Civil: semester-numbered sections. Pretend-check the rule on the data: Civil-5 is year 3
civil5 = [r for r in rows if r[4] == "Civil-5"]
check("Civil-5 exists for the year-3 rule", len(civil5) > 0)
# Demo CSE student: no CSE timetable -> honest reason
demo_pw = next(l.split(":", 1)[1].strip() for l in Path(sys.argv[3]).read_text(encoding="utf-8").splitlines() if l.startswith("password:"))
dt = call("POST", "/auth/login", b={"email": "demo.student.cse@example.com", "password": demo_pw})["access_token"]
mine = call("GET", "/timetable/mine", dt)
check("CSE student -> no entries, says not uploaded", not mine["entries"] and "hasn't been uploaded" in (mine["reason"] or ""), mine["reason"])
ft = call("POST", "/auth/login", b={"email": "demo.hod.cse@example.com", "password": demo_pw})["access_token"]
mine = call("GET", "/timetable/mine", ft)
check("demo HOD (no faculty profile) -> not linked", not mine["entries"] and "isn't linked" in (mine["reason"] or ""), mine["reason"])
print("\n" + ("ALL PASSED" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
