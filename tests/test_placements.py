"""Placements: posting drives, who may apply, the one-offer rule, results, and the batch report.

    python tests/test_placements.py <db> <.env>

Makes a temporary final-year IT student (roll 2451-23-737-990, a roll number no real student has) and two drives,
then removes them all again."""
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
BASE = os.environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
db_path, env = sys.argv[1], Path(sys.argv[2])
admin_pw = next(l.split("=", 1)[1].strip() for l in env.read_text(encoding="utf-8").splitlines() if l.startswith("ADMIN_PASSWORD="))
failures = []
ROLL = "2451-23-737-990"


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
tag = uuid.uuid4().hex[:6]
email, pw = f"place.test.{tag}@example.com", f"Pl-{tag}-pass"
con.execute("INSERT OR REPLACE INTO student_roster (roll_no, name, department, year, section, source, academic_year) VALUES (?, ?, 'IT', 4, 'A', 'test', '2026-27')",
            (ROLL, "PLACEMENT TEST"))
con.commit()
uid, drives = None, []
try:
    s, u = call("POST", "/auth/register", admin, {"name": "Placement Test", "email": email, "password": pw, "role": "student", "department": "IT"})
    uid = u["id"]
    s, d = call("PUT", f"/services/admin/students/{uid}/profile", admin,
                {"roll_no": ROLL, "year": 4, "section": "A", "parent_name": "Test Parent", "gender": "other"})
    check("temp final-year student linked", s == 200, d)
    stu = login(email, pw)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    def drive(company, ctc, **kw):
        body = {"company": company, "role": "Engineer", "kind": "job", "ctc_lpa": ctc, "departments": ["IT"], "batch": 2027,
                "rounds": ["Test", "Interview"], "opens_at": (now - timedelta(days=1)).isoformat(),
                "register_by": (now + timedelta(days=3)).isoformat(), "drive_date": (date.today() + timedelta(days=5)).isoformat(), **kw}
        s, d = call("POST", "/placements/drives", admin, body)
        if s == 200:
            drives.append(d["id"])
        return s, d

    s, a = drive(f"Test Co {tag}", 4.0)
    check("Placement Cell (admin) posts a drive", s == 200 and a["status"] == "open", a)
    s, b = drive(f"Test Mid {tag}", 5.0)
    s, c = drive(f"Test Dream {tag}", 8.0)
    check("a job needs a CTC -> 422", drive("No CTC", None)[0] == 422)
    check("student can't post a drive -> 403", call("POST", "/placements/drives", stu, {})[0] in (403, 422))

    s, me = call("GET", "/placements/me", stu)
    mine = {d["id"]: d for d in me["drives"]}
    check("student sees the drives for IT 2027", s == 200 and me["batch"] == 2027 and {a["id"], b["id"], c["id"]} <= set(mine), me.get("batch"))
    check("open drive: can apply", mine[a["id"]]["can_register"] is True)
    s, d = call("POST", f"/placements/drives/{a['id']}/register", stu)
    check("apply -> 200", s == 200, d)
    check("apply twice -> 409", call("POST", f"/placements/drives/{a['id']}/register", stu)[0] == 409)
    check("student can't open the report -> 403", call("GET", "/placements/report", stu)[0] == 403)

    s, d = call("PUT", f"/placements/drives/{a['id']}/results", admin, {"results": [{"roll_no": ROLL, "status": "selected", "round_reached": 2}], "declare": True})
    check("results saved and declared", s == 200, d)
    check("someone who didn't apply can't get a result -> 422",
          call("PUT", f"/placements/drives/{b['id']}/results", admin, {"results": [{"roll_no": ROLL, "status": "selected"}]})[0] == 422)

    s, me = call("GET", "/placements/me", stu)
    mine = {d["id"]: d for d in me["drives"]}
    check("offer shows on the student's page", me["best_offer_lpa"] == 4.0 and any(o["company"] == a["company"] for o in me["offers"]), me["offers"])
    check("one-offer rule: 5 LPA (< 1.5 x 4) blocked", mine[b["id"]]["can_register"] is False and mine[b["id"]]["why_not"], mine[b["id"]])
    check("one-offer rule enforced by the API -> 400", call("POST", f"/placements/drives/{b['id']}/register", stu)[0] == 400)
    check("dream drive (8 LPA) still open to them", mine[c["id"]]["can_register"] is True)
    s, d = call("POST", f"/placements/drives/{c['id']}/register", stu)
    check("withdraw while open -> 200", call("POST", f"/placements/drives/{c['id']}/withdraw", stu)[0] == 200)

    s, r = call("GET", "/placements/report?department=IT&batch=2027", admin)
    check("report counts the new offer", s == 200 and any(x["company"] == a["company"] and x["offers"] == 1 for x in r["companies"]), s)
    check("report has earlier batches", isinstance(r.get("history"), list))
finally:
    for d in drives:
        con.execute("DELETE FROM placement_registrations WHERE drive_id = ?", (d,))
        con.execute("DELETE FROM placement_drives WHERE id = ?", (d,))
    con.commit()                     # release the write lock before the server deletes the user
    if uid:
        check("temp student deleted", call("DELETE", f"/auth/users/{uid}", admin)[0] == 200)
    con.execute("DELETE FROM student_roster WHERE roll_no = ?", (ROLL,))
    con.commit()
    left = con.execute("SELECT COUNT(*) FROM placement_drives WHERE company LIKE ?", (f"%{tag}",)).fetchone()[0]
    print(f"temporary drives and student removed: {left == 0}")
    con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
