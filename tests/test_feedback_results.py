"""Feedback and results: forms, anonymous single answers, who may answer, public links, analysis, the ATR's
approval and publication, teachers' privacy, course-exit -> OBE survey, and the Exam Cell's results with checks.

    python tests/test_feedback_results.py <db> <.env> <demo_accounts.local.txt>

Uses a temporary final-year IT student (roll 2451-23-737-991) and temporary forms, results (2030-31) and a batch
(2040); removes them all afterwards."""
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
ROLL, YEAR = "2451-23-737-991", "2026-27"


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


def answers(form, value=4):
    return {q["id"]: value for q in form["questions"] if q["type"] == "rating"}


con = sqlite3.connect(db_path)
admin = login("admin@suhruth.edu", admin_pw)
other_student = login(emails["student"], demo_pw)       # CSE: not eligible for IT forms
tag = uuid.uuid4().hex[:6]
uid, forms, survey_course = None, [], None
con.execute("INSERT OR REPLACE INTO student_roster (roll_no, name, department, year, section, source, academic_year) "
            "VALUES (?, 'FEEDBACK TEST', 'IT', 4, 'A', 'test', ?)", (ROLL, YEAR))
con.commit()
try:
    s, u = call("POST", "/auth/register", admin, {"name": "Feedback Test", "email": f"fb.test.{tag}@example.com",
                                                 "password": f"Fb-{tag}-pass", "role": "student", "department": "IT"})
    uid = u["id"]
    call("PUT", f"/services/admin/students/{uid}/profile", admin, {"roll_no": ROLL, "year": 4, "section": "A", "parent_name": "Test Parent", "gender": "other"})
    stu = login(f"fb.test.{tag}@example.com", f"Fb-{tag}-pass")

    s, f = call("POST", "/feedback/forms", admin, {"kind": "curriculum", "programme": "IT", "year": YEAR, "study_year": 4, "title": f"Test curriculum {tag}"})
    check("curriculum form created (draft)", s == 200 and f["status"] == "draft" and len(f["questions"]) == 9, f)
    forms.append(f["id"])
    check("draft isn't shown to students", all(x["id"] != f["id"] for x in call("GET", "/feedback/mine", stu)[1]))
    call("PATCH", f"/feedback/forms/{f['id']}", admin, {"status": "open"})
    mine = call("GET", "/feedback/mine", stu)[1]
    check("open form shown to the IT final-year student", any(x["id"] == f["id"] and not x["answered"] for x in mine))
    check("not shown to a CSE student", all(x["id"] != f["id"] for x in call("GET", "/feedback/mine", other_student)[1]))
    check("CSE student can't answer -> 403", call("POST", f"/feedback/forms/{f['id']}/respond", other_student, {"answers": answers(f)})[0] == 403)
    partial = dict(list(answers(f).items())[:3])
    check("every statement must be rated -> 422", call("POST", f"/feedback/forms/{f['id']}/respond", stu, {"answers": partial})[0] == 422)
    a = answers(f, 2)
    a["comment"] = "Test comment"
    check("answer accepted", call("POST", f"/feedback/forms/{f['id']}/respond", stu, {"answers": a})[0] == 200)
    check("a second answer -> 409", call("POST", f"/feedback/forms/{f['id']}/respond", stu, {"answers": a})[0] == 409)
    row = con.execute("SELECT respondent, answers FROM feedback_responses WHERE form_id = ?", (f["id"],)).fetchone()
    check("the response doesn't carry who answered", row and uid not in (row[0] or "") and ROLL not in row[1] and len(row[0]) == 64, row)
    s, r = call("GET", f"/feedback/forms/{f['id']}/results", admin)
    check("analysis: mean 2.0 over 1 response, comment visible to the IQAC",
          s == 200 and r["responses"] == 1 and r["overall"] == 2.0 and any(x.get("comments") == ["Test comment"] for x in r["rows"]), r.get("overall"))

    # ATR: write, approve, publish; appears on the public website feed
    check("ATR too short -> 422", call("PUT", f"/feedback/forms/{f['id']}/atr", admin, {"observations": "x", "actions": "y"})[0] == 422)
    check("ATR saved", call("PUT", f"/feedback/forms/{f['id']}/atr", admin, {"observations": "Students rated electives low (test).",
                                                                            "actions": "BoS added two electives (test)."})[0] == 200)
    check("publishing before approval -> 400", call("POST", f"/feedback/forms/{f['id']}/atr/publish", admin, {"published": True})[0] == 400)
    check("IQAC approves", call("POST", f"/feedback/forms/{f['id']}/atr/approve", admin, {"approved": True})[0] == 200)
    check("approved ATR can't be edited -> 409", call("PUT", f"/feedback/forms/{f['id']}/atr", admin, {"observations": "Changed after approval",
                                                                                                      "actions": "Changed after approval"})[0] == 409)
    check("published", call("POST", f"/feedback/forms/{f['id']}/atr/publish", admin, {"published": True})[0] == 200)
    s, pub = call("GET", f"/feedback/atr?year={YEAR}")
    check("on the public website feed (no login)", s == 200 and any(p["title"] == f"Test curriculum {tag}" for p in pub), s)

    # Public form for alumni
    s, al = call("POST", "/feedback/forms", admin, {"kind": "alumni", "programme": "IT", "year": YEAR, "title": f"Test alumni {tag}"})
    forms.append(al["id"])
    code = call("PATCH", f"/feedback/forms/{al['id']}", admin, {"status": "open"})[1]["public_code"]
    s, pf = call("GET", f"/feedback/public/{code}")
    check("public form opens without login", s == 200 and pf["kind"] == "alumni", pf)
    check("public answer accepted", call("POST", f"/feedback/public/{code}", None, {"role": "alumni", "answers": answers(pf, 5)})[0] == 200)
    call("PATCH", f"/feedback/forms/{al['id']}", admin, {"status": "closed"})
    check("closed public form -> 404", call("GET", f"/feedback/public/{code}")[0] == 404)

    # Teaching feedback: internal only; the teacher waits for the form to close
    course = con.execute("SELECT id, coordinator FROM obe_courses WHERE programme = 'IT' AND year = ? AND semester = 7 AND kind = 'theory' "
                         "AND coordinator IS NOT NULL LIMIT 1", (YEAR,)).fetchone()
    if course:
        s, tf = call("POST", "/feedback/forms", admin, {"kind": "teaching", "year": YEAR, "course_id": course[0], "title": f"Test teaching {tag}"})
        forms.append(tf["id"])
        call("PATCH", f"/feedback/forms/{tf['id']}", admin, {"status": "open"})
        call("POST", f"/feedback/forms/{tf['id']}/respond", stu, {"answers": answers(tf)})
        call("PUT", f"/feedback/forms/{tf['id']}/atr", admin, {"observations": "Teaching observations (test).", "actions": "Teaching actions (test)."})
        call("POST", f"/feedback/forms/{tf['id']}/atr/approve", admin, {"approved": True})
        check("a teacher's own feedback can't be published -> 400", call("POST", f"/feedback/forms/{tf['id']}/atr/publish", admin, {"published": True})[0] == 400)
        # Course-exit form: closing it fills the course's indirect CO attainment
        s, ce = call("POST", "/feedback/forms", admin, {"kind": "course_exit", "year": YEAR, "course_id": course[0], "title": f"Test exit {tag}"})
        forms.append(ce["id"])
        survey_course = course[0]
        call("PATCH", f"/feedback/forms/{ce['id']}", admin, {"status": "open"})
        call("POST", f"/feedback/forms/{ce['id']}/respond", stu, {"answers": answers(ce, 3)})
        call("PATCH", f"/feedback/forms/{ce['id']}", admin, {"status": "closed"})
        rows = con.execute("SELECT co_code, mean, responses FROM obe_surveys WHERE course_id = ?", (course[0],)).fetchall()
        check("closed course-exit form -> each CO's survey mean in OBE", rows and all(r[1] == 3 and r[2] == 1 for r in rows), rows)

    # Results: the Exam Cell's totals
    base = {"programme": "IT", "year": "2030-31", "semester": 3, "appeared": 100, "passed": 90}
    check("passed > appeared -> 422", call("PUT", "/results/summaries", admin, {**base, "passed": 120})[0] == 422)
    check("declared before the last exam -> 422", call("PUT", "/results/summaries", admin, {**base, "last_exam_on": "2031-01-10", "declared_on": "2031-01-01"})[0] == 422)
    s, d = call("PUT", "/results/summaries", admin, {**base, "last_exam_on": "2031-01-10", "declared_on": "2031-02-04", "complaints": 2})
    check("semester result saved: 90% pass, 25 days", s == 200 and d["pass_pct"] == 90.0 and d["days_to_declare"] == 25, d)
    s, b = call("PUT", "/results/batches", admin, {"programme": "IT", "batch": 2040, "intake": 180, "admitted": 170, "lateral": 18,
                                                   "graduated_clean": 141, "graduated_backlog": 19, "cgpa_2nd": 7.5, "passed_2nd": 150, "appeared_2nd": 180})
    # success: 141/188 = 0.75; all: 160/188 = 0.851; API 2nd: 7.5 x 150/180 = 6.25; enrolment 170/180 = 94.4%
    check("batch: enrolment 94.4%, success 0.75 / 0.851, API 6.25",
          s == 200 and b["enrolment_ratio"] == 94.4 and b["success_clean"] == 0.75 and b["success_total"] == 0.851 and b["api_2nd"] == 6.25, b)
    check("more graduates than admitted -> 422", call("PUT", "/results/batches", admin, {"programme": "IT", "batch": 2040, "intake": 180,
                                                                                         "admitted": 10, "graduated_clean": 50})[0] == 422)
    check("a student can't see results -> 403", call("GET", "/results/overview?programme=IT", stu)[0] == 403)
    s, o = call("GET", "/results/overview?programme=IT", admin)
    check("overview lists the new year", s == 200 and any(y["year"] == "2030-31" for y in o["years"]))
finally:
    for fid in forms:
        con.execute("DELETE FROM feedback_responses WHERE form_id = ?", (fid,))
        con.execute("DELETE FROM feedback_atr WHERE form_id = ?", (fid,))
        con.execute("DELETE FROM feedback_forms WHERE id = ?", (fid,))
    if survey_course:
        con.execute("DELETE FROM obe_surveys WHERE course_id = ?", (survey_course,))
    con.execute("DELETE FROM result_summaries WHERE year = '2030-31'")
    con.execute("DELETE FROM batch_outcomes WHERE batch = 2040")
    con.commit()
    if uid:
        call("DELETE", f"/auth/users/{uid}", admin)
    con.execute("DELETE FROM student_roster WHERE roll_no = ?", (ROLL,))
    con.commit()
    print(f"temporary forms, results and student removed: {con.execute('SELECT COUNT(*) FROM feedback_forms WHERE title LIKE ?', (f'%{tag}',)).fetchone()[0] == 0}")
    con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
