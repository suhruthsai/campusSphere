"""Test Notices: who may post where (Principal anyone, HOD their department, faculty a class in their department,
Admin Office anyone, students nobody), who sees what (by audience, department, year, section), taking notices
down, and urgent notices in the Morning Brief. Uses the seeded demo accounts; deletes what it posts."""
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
failures, posted = [], []
TAG = "[notice-test]"


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


tok = {}
for k in ("student", "mentor", "hod", "principal", "office"):
    s, d = call("POST", "/auth/login", body={"email": emails[k], "password": pw})
    check(f"login {k}", s == 200, d)
    tok[k] = d["access_token"]
con = sqlite3.connect(db_path)
prof = con.execute("SELECT sp.department, sp.year, sp.section FROM student_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.email = ?",
                   (emails["student"],)).fetchone()
dept, year, sec = prof[0].upper(), prof[1], (prof[2] or "A").upper()


def post(who, **body):
    s, d = call("POST", "/announcements/", tok[who], {"title": f"{TAG} {body.pop('title')}", "body": "Test notice body", **body})
    if s == 200:
        posted.append(d["id"])
    return s, d


try:
    # Who may post
    check("students can't post (can-post)", call("GET", "/announcements/can-post", tok["student"])[1]["allowed"] is False)
    check("students can't post", post("student", title="x")[0] == 403)
    check("students can't list everything", call("GET", "/announcements/", tok["student"])[0] == 403)
    s, mclass = post("mentor", title="mentor class", audience="students", department=dept, year=year, section=sec, priority="urgent")
    check("faculty: post to a class in their department", s == 200, mclass)
    check("faculty: not to staff", post("mentor", title="x", audience="staff")[0] == 403)
    check("faculty: not another department", post("mentor", title="x", audience="students", department="ZZZ", year=1)[0] == 403)
    check("faculty: the year is required", post("mentor", title="x", audience="students", department=dept)[0] == 422)
    s, other_year = post("mentor", title="other year", audience="students", department=dept, year=(year % 4) + 1)
    s, other_sec = post("mentor", title="other section", audience="students", department=dept, year=year, section="Z")
    s, hstaff = post("hod", title="hod staff", audience="staff", department=dept)
    check("HOD: staff notice for their department", s == 200, hstaff)
    check("HOD: not another department", post("hod", title="x", audience="all", department="ZZZ")[0] == 403)
    check("HOD: year only for students", post("hod", title="x", audience="staff", department=dept, year=2)[0] == 422)
    s, pall = post("principal", title="principal all", audience="all", days=7)
    check("Principal: whole college", s == 200 and pall["department"] is None and pall["expires_at"], pall)
    s, office = post("office", title="office staff", audience="staff")
    check("Admin Office: may post", s == 200, office)

    # Who sees what
    seen = {n["title"].replace(TAG + " ", "") for n in call("GET", "/announcements/mine", tok["student"])[1] if n["title"].startswith(TAG)}
    check("student sees: whole college + their class", {"principal all", "mentor class"} <= seen, seen)
    check("student doesn't see: other year / section / staff notices", not seen & {"other year", "other section", "hod staff", "office staff"}, seen)
    first = call("GET", "/announcements/mine", tok["student"])[1][0]
    check("urgent notices come first", first["priority"] == "urgent", first)
    seen_f = {n["title"].replace(TAG + " ", "") for n in call("GET", "/announcements/mine", tok["mentor"])[1] if n["title"].startswith(TAG)}
    check("faculty see: whole college + staff of their department", {"principal all", "hod staff"} <= seen_f, seen_f)
    check("faculty don't see student-only notices", "mentor class" not in seen_f, seen_f)
    brief = call("GET", "/ai/brief", tok["student"])[1]
    check("Morning Brief shows the urgent notice", any("mentor class" in i["text"] and i["kind"] == "notice" for i in brief["items"]), brief["items"])

    # Taking down
    check("a student can't take a notice down", call("PATCH", f"/announcements/{mclass['id']}/deactivate", tok["student"])[0] == 403)
    check("another faculty member can't either", call("PATCH", f"/announcements/{mclass['id']}/deactivate", tok["hod"])[0] == 403)
    check("the author can", call("PATCH", f"/announcements/{mclass['id']}/deactivate", tok["mentor"])[0] == 200)
    check("the Principal can take any down", call("PATCH", f"/announcements/{hstaff['id']}/deactivate", tok["principal"])[0] == 200)
    seen = {n["title"] for n in call("GET", "/announcements/mine", tok["student"])[1]}
    check("taken-down notices disappear", f"{TAG} mentor class" not in seen)
    mine = call("GET", "/announcements/posted", tok["mentor"])[1]
    check("'posted by you' keeps them, marked taken down", any(n["id"] == mclass["id"] and not n["is_active"] for n in mine))
finally:
    if posted:
        con.execute(f"DELETE FROM announcements WHERE id IN ({','.join('?' * len(posted))})", posted)
        con.commit()
    con.close()

print(f"\n{len(failures)} failure(s)" if failures else "\nAll notices checks passed")
sys.exit(1 if failures else 0)
