"""The open campus at "/" (no login): a guest may read the map data, but never see who teaches a class or any
private page. Also checks that signed-in users still get teacher names. Uses the seeded demo accounts; changes nothing.
Usage: python tests/test_public_campus.py <campussphere.db> <demo_accounts.local.txt>"""
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

db_path, creds = sys.argv[1], Path(sys.argv[2])
BASE = os.environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
lines = creds.read_text(encoding="utf-8").splitlines()
pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
failures = []


def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info and not cond else ""))
    if not cond:
        failures.append(name)


def call(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


con = sqlite3.connect(db_path)
room, = con.execute("select classroom_id from timetable_entries where is_active=1 and faculty_name != '' limit 1").fetchone()
staff = {n for (n,) in con.execute("select distinct faculty_name from timetable_entries where is_active=1") if n}

# What the open map needs
for path in ("/buildings/", "/classrooms/", "/timetable/", f"/classrooms/{room}/current", f"/classrooms/{room}/week",
             f"/timetable/classroom/{room}/current", f"/timetable/classroom/{room}/week",
             "/buildings/route?from_id=frontgate&to_id=lib"):
    s, d = call("GET", path)
    check(f"guest can read {path}", s == 200, (s, d))
    check(f"guest {path}: no teacher names", not any(n in json.dumps(d) for n in staff))

s, tt = call("GET", "/timetable/")
check("guest timetable keeps the classes", s == 200 and len(tt) == con.execute("select count(*) from timetable_entries where is_active=1").fetchone()[0])
check("guest timetable: faculty blank", all(e["faculty_name"] == "" and e["faculty_id"] is None for e in tt))
s, b = call("GET", "/buildings/")
check("guest buildings: no upkeep status or head-counts", s == 200 and b and all(
    k not in x for x in b for k in ("health", "occupancy", "capacity")))

# Everything else stays behind the login
for method, path in (("GET", "/timetable/stats"), ("GET", "/timetable/mine"), ("GET", "/timetable/conflicts"),
                     ("GET", "/timetable/overrides"), ("GET", f"/classrooms/{room}"), ("GET", "/notices"),
                     ("GET", "/attendance/"), ("GET", "/services/my-requests"), ("GET", "/auth/me"),
                     ("POST", "/buildings/"), ("POST", "/classrooms/"), ("POST", "/timetable/")):
    s, _ = call(method, path, body={} if method == "POST" else None)
    check(f"guest {method} {path} refused", s in (401, 403, 404, 405), s)

# Signed in: nothing is hidden
s, d = call("POST", "/auth/login", body={"email": emails["student"], "password": pw})
check("login student", s == 200, d)
tok = d["access_token"]
s, tt = call("GET", "/timetable/", tok)
check("student timetable has teacher names", s == 200 and any(e["faculty_name"] for e in tt))
s, cur = call("GET", f"/classrooms/{room}/week", tok)
check("student room week has teacher names", s == 200 and any(e["faculty_name"] for r in cur["schedule"].values() for e in r))
s, b = call("GET", "/buildings/", tok)
check("student buildings keep upkeep status", s == 200 and all("health" in x for x in b))

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
