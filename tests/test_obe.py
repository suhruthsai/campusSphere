"""Outcome-based education: course offerings, COs, CO-PO mapping, marks-sheet import (totals only), attainment
arithmetic, course-exit survey, permissions, attainment rules and closing-the-loop actions.

    python tests/test_obe.py <db> <.env> <demo_accounts.local.txt>

Works on a temporary course offering (TEST-OBE) of IT and removes it, its records and a test action afterwards."""
import io
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
BASE = os.environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
db_path, env, creds = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
admin_pw = next(l.split("=", 1)[1].strip() for l in env.read_text(encoding="utf-8").splitlines() if l.startswith("ADMIN_PASSWORD="))
lines = creds.read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
failures = []


def call(method, path, token=None, body=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
            return r.status, (data if raw else json.loads(data or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def sheet(token, course_id, fields, filename, content):
    boundary = uuid.uuid4().hex
    body = b"".join(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode() for k, v in fields.items())
    body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
             "Content-Type: text/csv\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{BASE}/obe/courses/{course_id}/assessments", method="POST", data=body,
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
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
teacher_id = call("GET", "/auth/me", teacher)[1]["id"]
course_id, action_id = None, None
had_outcomes = con.execute("SELECT COUNT(*) FROM obe_outcomes WHERE programme = 'IT'").fetchone()[0]
try:
    if not had_outcomes:      # the tests need IT's POs; add two if the programme has none
        for code in ("PO1", "PO2"):
            call("PUT", "/obe/outcomes", admin, {"programme": "IT", "kind": "PO", "code": code, "text": f"Test outcome {code}"})
    s, d = call("POST", "/obe/courses", admin, {"programme": "IT", "code": "TEST-OBE", "name": "OBE Test Course", "semester": 5,
                                                "year": "2025-26", "students": 4})
    course_id = d.get("id")
    check("course offering added", s == 200 and course_id, d)
    check("the same course twice in a year -> 409", call("POST", "/obe/courses", admin, {"programme": "IT", "code": "TEST-OBE", "name": "Duplicate",
                                                                                        "semester": 5, "year": "2025-26"})[0] == 409)
    check("a teacher can't add courses -> 403", call("POST", "/obe/courses", teacher, {"programme": "IT", "code": "TEST-T2", "name": "Teacher course",
                                                                                     "semester": 5, "year": "2025-26"})[0] == 403)
    s, d = call("PUT", f"/obe/courses/{course_id}/cos", admin, [{"code": "CO1", "text": "Explain the basics of testing", "bloom": "K2"},
                                                                {"code": "CO2", "text": "Apply testing to a small program", "bloom": "K3"}])
    check("COs saved", s == 200, d)
    check("duplicate CO codes -> 422", call("PUT", f"/obe/courses/{course_id}/cos", admin, [{"code": "CO1", "text": "aaaaa"}, {"code": "CO1", "text": "bbbbb"}])[0] == 422)
    s, d = call("PUT", f"/obe/courses/{course_id}/mapping", admin, [{"co": "CO1", "outcome": "PO1", "strength": 3},
                                                                    {"co": "CO2", "outcome": "PO1", "strength": 1},
                                                                    {"co": "CO2", "outcome": "PO2", "strength": 2}])
    check("mapping saved", s == 200, d)
    check("mapping to an unknown outcome -> 422", call("PUT", f"/obe/courses/{course_id}/mapping", admin, [{"co": "CO1", "outcome": "PO99", "strength": 1}])[0] == 422)
    s, raw = call("GET", f"/obe/courses/{course_id}/template", admin, raw=True)
    check("marks-sheet template is an Excel file", s == 200 and raw[:2] == b"PK")

    # 4 students; target 60%. Q1 (CO1, max 10): 9, 7, 5, AB -> 2 of 3 reach. Q2 (CO2, max 5): 3, 2, 4, 5 -> 3 of 4 reach (3/5 = 60%).
    csv = b"Roll No,Q1,Q2\nCO,CO1,CO2\nMax,10,5\nR1,9,3\nR2,7,2\nR3,5,4\nR4,AB,5\n"
    s, d = sheet(admin, course_id, {"name": "CIE-1", "kind": "internal"}, "cie1.csv", csv)
    check("CIE imported", s == 200 and "4 students" in d.get("message", ""), d)
    s, d = sheet(admin, course_id, {"name": "SEE", "kind": "external"}, "see.csv", b"Roll,Q1,Q2\nCO,CO1,CO2\nMax,20,20\nR1,15,5\nR2,12,14\nR3,13,13\nR4,4,16\n")
    check("SEE imported", s == 200, d)
    check("a question tagged to an unknown CO -> 422", sheet(admin, course_id, {"name": "bad", "kind": "internal"}, "bad.csv",
                                                            b"Roll,Q1\nCO,CO9\nMax,10\nR1,5\n")[0] == 422)
    check("a mark above the maximum -> 422", sheet(admin, course_id, {"name": "bad", "kind": "internal"}, "bad.csv",
                                                   b"Roll,Q1\nCO,CO1\nMax,10\nR1,11\n")[0] == 422)
    check("only totals stored (no student rows)", con.execute(
        "SELECT COUNT(*) FROM obe_questions q JOIN obe_assessments a ON a.id = q.assessment_id WHERE a.course_id = ?", (course_id,)).fetchone()[0] == 4)

    s, f = call("GET", f"/obe/courses/{course_id}", admin)
    cos = {c["code"]: c for c in f["attainment"]["cos"]}
    # CO1: CIE 2/3 = 66.7% -> level 2; SEE 12+ of 20 (60%): 15, 12, 13 reach, 4 not -> 3/4 = 75% -> level 3; direct 0.4*2 + 0.6*3 = 2.6
    check("CO1 CIE level 2 (66.7%)", cos["CO1"]["internal_level"] == 2 and cos["CO1"]["internal_pct"] == 66.7, cos["CO1"])
    check("CO1 SEE level 3 (75%)", cos["CO1"]["external_level"] == 3, cos["CO1"])
    check("CO1 direct = 0.4 x 2 + 0.6 x 3 = 2.6", cos["CO1"]["direct"] == 2.6, cos["CO1"])
    # CO2: CIE 3/4 = 75% -> 3; SEE: 5,14,13,16 of 20 -> 3/4 -> 3; direct 3
    check("CO2 direct 3.0", cos["CO2"]["direct"] == 3.0, cos["CO2"])
    s, d = call("PUT", f"/obe/courses/{course_id}/survey", admin, [{"co": "CO1", "responses": 4, "mean": 4.0}])
    f = call("GET", f"/obe/courses/{course_id}", admin)[1]
    co1 = next(c for c in f["attainment"]["cos"] if c["code"] == "CO1")
    # indirect 4/5 x 3 = 2.4; final 0.8 x 2.6 + 0.2 x 2.4 = 2.56
    check("CO1 with survey = 0.8 x 2.6 + 0.2 x 2.4 = 2.56", co1["attainment"] == 2.56, co1)
    # PO1 from this course: (2.56 x 3 + 3.0 x 1) / 4 = 2.67
    check("course's PO1 = (2.56x3 + 3x1) / 4 = 2.67", f["attainment"]["po"].get("PO1") == 2.67, f["attainment"]["po"])

    # Permissions: a teacher who isn't the coordinator can't edit; once coordinator, can
    check("non-coordinator can't import -> 403", sheet(teacher, course_id, {"name": "CIE-x", "kind": "internal"}, "x.csv", csv)[0] == 403)
    call("PATCH", f"/obe/courses/{course_id}", admin, {"coordinator": teacher_id})
    check("coordinator edits their course's COs", call("PUT", f"/obe/courses/{course_id}/cos", teacher,
                                                      [{"code": "CO1", "text": "Explain the basics of testing well"}, {"code": "CO2", "text": "Apply testing to a small program"}])[0] == 200)
    check("COs used in an assessment can't be dropped -> 409",
          call("PUT", f"/obe/courses/{course_id}/cos", admin, [{"code": "CO1", "text": "Only one CO now"}])[0] == 409)
    check("coordinator can't change programme rules -> 403", call("PUT", "/obe/settings", teacher, {"programme": "IT", "target_pct": 60, "level1_pct": 50,
          "level2_pct": 60, "level3_pct": 70, "internal_weight": 0.4, "direct_weight": 0.8, "po_target": 2})[0] == 403)
    check("levels must rise -> 422", call("PUT", "/obe/settings", admin, {"programme": "IT", "target_pct": 60, "level1_pct": 70,
          "level2_pct": 60, "level3_pct": 50, "internal_weight": 0.4, "direct_weight": 0.8, "po_target": 2})[0] == 422)

    s, att = call("GET", "/obe/attainment?programme=IT&year=2025-26", admin)
    check("programme attainment includes the course", s == 200 and any(c["id"] == course_id for c in att["courses"]), s)
    s, a = call("POST", "/obe/actions", admin, {"programme": "IT", "year": "2025-26", "outcome": "PO2", "attained": 1.8, "target": 2.0,
                                                 "observation": "Test observation", "action": "Test action taken"})
    action_id = a.get("id")
    check("action recorded", s == 200 and action_id, a)
    s, a = call("PATCH", f"/obe/actions/{action_id}", admin, {"status": "done", "result": "Rose to 2.1"})
    check("action closed with its effect", s == 200 and a["status"] == "done" and a["result"] == "Rose to 2.1", a)
    check("student can't see outcomes -> 403", call("GET", "/obe/attainment?programme=IT",
                                                    login(emails["student"], demo_pw))[0] == 403)
finally:
    if action_id:
        con.execute("DELETE FROM obe_actions WHERE id = ?", (action_id,))
        con.commit()
    if course_id:
        call("DELETE", f"/obe/courses/{course_id}", admin)
    if not had_outcomes:
        con.execute("DELETE FROM obe_outcomes WHERE programme = 'IT' AND text LIKE 'Test outcome%'")
        con.commit()
    left = con.execute("SELECT COUNT(*) FROM obe_courses WHERE code = 'TEST-OBE'").fetchone()[0]
    print(f"temporary course removed: {left == 0}")
    con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
