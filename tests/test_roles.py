"""Test GET /auth/me/roles, which the menus are built from: each demo account gets exactly the desks it holds
(Principal -> management, CoE -> coe, HOD -> hod_departments, clearance officers -> their units), and a
student's Joining / Leaving follow their records. Uses the seeded demo accounts; changes nothing."""
import json
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

db_path, creds = sys.argv[1], Path(sys.argv[2])
BASE = __import__("os").environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
lines = creds.read_text(encoding="utf-8").splitlines()
pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
failures = []


def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info and not cond else ""))
    if not cond:
        failures.append(name)


def call(path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method="POST" if body is not None else "GET",
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def roles(key):
    s, d = call("/auth/login", body={"email": emails[key], "password": pw})
    check(f"login {key}", s == 200, d)
    tok = d["access_token"]
    s, r = call("/auth/me/roles", tok)
    check(f"{key}: roles", s == 200, r)
    return r, call("/auth/me", tok)[1]["id"]


check("roles need sign-in", call("/auth/me/roles")[0] == 401)
con = sqlite3.connect(db_path)

r, _ = roles("principal")
check("principal: management desks", r["principal"] and r["management"] and not r["admin"], r)
r, _ = roles("coe")
check("CoE: coe desk, no management", r["coe"] and not r["management"], r)
r, _ = roles("hod")
check("HOD: hod of CSE", r["hod"] and "CSE" in r["hod_departments"], r)
r, uid = roles("mentor")
check("mentor: approver, nothing else", r["approver"] and not (r["hod"] or r["coe"] or r["management"]), r)
r, uid = roles("office")
units = {u for (u,) in con.execute("SELECT unit FROM clearance_officers WHERE user_id = ?", (uid,))}
check("Admin Office: its clearance units exactly", r["clearance_officer"] == bool(units)
      and {u.split(":")[0] for u in r["clearance_units"]} == units, (r["clearance_units"], units))
check("Admin Office: no management or HOD", not (r["management"] or r["hod"]), r)

r, uid = roles("student")
exit_started = con.execute("SELECT 1 FROM exits WHERE user_id = ?", (uid,)).fetchone() is not None
year = (con.execute("SELECT year FROM student_profiles WHERE user_id = ?", (uid,)).fetchone() or [None])[0]
check("student: Leaving follows exit / final year", r["leaving_open"] == (exit_started or year == 4), (r, exit_started, year))
check("student: holds no desks", not (r["approver"] or r["hod"] or r["coe"] or r["management"] or r["clearance_officer"]), r)
r, uid = roles("joinee")
adm = con.execute("SELECT status FROM admissions WHERE user_id = ?", (uid,)).fetchone()
check("joinee: Joining open only while the application is in progress",
      r["joining_open"] == (adm is not None and adm[0] != "enrolled") or (adm is None and r["joining_open"]), (r, adm))
jyear = (con.execute("SELECT year FROM student_profiles WHERE user_id = ?", (uid,)).fetchone() or [None])[0]
jexit = con.execute("SELECT 1 FROM exits WHERE user_id = ?", (uid,)).fetchone() is not None
check("joinee: an enrolled first-year can reach Leaving (withdrawal)",
      r["leaving_open"] == (jexit or jyear == 4 or bool(adm and adm[0] == "enrolled" and jyear in (None, 1))), (r, adm, jyear, jexit))
con.close()

# College-wide analytics (every teacher's load, room forecasts): HODs, the Principal and admins only
def token(key):
    return call("/auth/login", body={"email": emails[key], "password": pw})[1]["access_token"]


hod_t, mentor_t, student_t = token("hod"), token("mentor"), token("student")
check("analytics flag: HOD yes, teacher no", call("/auth/me/roles", hod_t)[1]["analytics"] is True
      and call("/auth/me/roles", mentor_t)[1]["analytics"] is False)
s, st = call("/timetable/stats", mentor_t)
check("teacher: timetable summary yes, every teacher's load no", s == 200 and st["departments"] and st["faculty"] == [], (s, str(st)[:200]))
s, st = call("/timetable/stats", hod_t)
check("HOD: every teacher's load", s == 200 and len(st["faculty"]) > 0, s)
for path in ("/ai/utilization/model", "/ai/utilization/report"):
    check(f"teacher: {path} -> 403", call(path, mentor_t)[0] == 403)
    check(f"student: {path} -> 403", call(path, student_t)[0] == 403)
check("HOD: room forecast model -> 200", call("/ai/utilization/model", hod_t)[0] == 200)

print(f"\n{len(failures)} failure(s)" if failures else "\nAll roles checks passed")
sys.exit(1 if failures else 0)
