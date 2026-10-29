"""Institution records: progression / achievements (with their required details), yearly figures (validated by
kind), meetings and their decisions, and who may record them.

    python tests/test_institution.py <db> <.env> <demo_accounts.local.txt>

Writes records for 2031-32 and removes them afterwards."""
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
BASE = os.environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
db_path, env, creds = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
admin_pw = next(l.split("=", 1)[1].strip() for l in env.read_text(encoding="utf-8").splitlines() if l.startswith("ADMIN_PASSWORD="))
lines = creds.read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
failures = []
YEAR = "2031-32"


def call(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{str(info)[:300]}]" if info and not cond else ""))
    if not cond:
        failures.append(name)


def login(email, pw):
    return call("POST", "/auth/login", body={"email": email, "password": pw})[1]["access_token"]


con = sqlite3.connect(db_path)
admin = login("admin@suhruth.edu", admin_pw)
teacher = login(emails["mentor"], demo_pw)
try:
    check("higher studies without a student -> 422", call("POST", "/institution/achievements", admin,
          {"kind": "higher_studies", "programme": "IT", "year": YEAR, "title": "M.Tech, test"})[0] == 422)
    check("award without level / category -> 422", call("POST", "/institution/achievements", admin,
          {"kind": "award", "year": YEAR, "title": "Test award"})[0] == 422)
    s, a = call("POST", "/institution/achievements", admin, {"kind": "higher_studies", "programme": "it", "year": YEAR,
                                                            "student_name": "Test graduate", "title": "M.Tech, test university"})
    check("higher studies recorded (programme upper-cased)", s == 200 and a["programme"] == "IT", a)
    s, a2 = call("POST", "/institution/achievements", admin, {"kind": "award", "year": YEAR, "title": "Test award", "level": "national", "category": "sports"})
    check("award recorded", s == 200, a2)
    check("teacher off the team can't record -> 403", call("POST", "/institution/achievements", teacher,
          {"kind": "event", "year": YEAR, "title": "Teacher event", "category": "cultural"})[0] == 403)
    s, lst = call("GET", f"/institution/achievements?year={YEAR}", admin)
    check("listed by year", s == 200 and len(lst) == 2, lst)

    check("unknown figure -> 422", call("PUT", "/institution/stats", admin, {"key": "nope", "year": YEAR, "value": 1})[0] == 422)
    check("yes/no figure needs yes or no -> 422", call("PUT", "/institution/stats", admin, {"key": "green_audit", "year": YEAR, "text": "maybe"})[0] == 422)
    check("number figure needs a number -> 422", call("PUT", "/institution/stats", admin, {"key": "computers", "year": YEAR})[0] == 422)
    check("figure saved", call("PUT", "/institution/stats", admin, {"key": "computers", "year": YEAR, "value": 1234})[0] == 200)
    check("audit saved", call("PUT", "/institution/stats", admin, {"key": "green_audit", "year": YEAR, "text": "yes"})[0] == 200)
    s, st = call("GET", "/institution/stats", admin)
    check("figures read back", st["values"].get(f"computers|{YEAR}") == 1234 and st["values"].get(f"green_audit|{YEAR}") == "yes", st["values"].get(f"computers|{YEAR}"))

    check("BoS meeting needs its programme -> 422", call("POST", "/institution/meetings", admin, {"body": "bos", "held_on": "2031-08-10"})[0] == 422)
    s, m = call("POST", "/institution/meetings", admin, {"body": "iqac", "held_on": "2031-08-10", "attendees": 12, "agenda": "Test agenda",
                                                        "decisions": [{"text": "Prepare the test AQAR"}, {"text": "Collect test feedback"}]})
    check("IQAC meeting recorded in the right academic year", s == 200 and m["year"] == YEAR and m["done"] == 0, m)
    s, m2 = call("PATCH", f"/institution/meetings/{m['id']}", admin, {"index": 1, "status": "done"})
    check("a decision marked done", s == 200 and m2["done"] == 1 and m2["decisions"][1]["status"] == "done", m2)
    check("no such decision -> 422", call("PATCH", f"/institution/meetings/{m['id']}", admin, {"index": 9, "status": "done"})[0] == 422)
    check("teacher can't see meetings -> 403", call("GET", "/institution/meetings", teacher)[0] == 403)
finally:
    con.execute("DELETE FROM student_achievements WHERE year = ?", (YEAR,))
    con.execute("DELETE FROM institution_stats WHERE year = ?", (YEAR,))
    con.execute("DELETE FROM meetings WHERE year = ?", (YEAR,))
    con.commit()
    con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
