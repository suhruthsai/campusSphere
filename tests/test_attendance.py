"""Test class attendance end to end with throwaway accounts (a Civil class's real teacher, the Civil HOD, a Civil
student on the roll list, an admin), then remove everything it created and restore the rules:
  rules (admins only), who may mark (teacher, substitute, HOD, admin; not students or other faculty), dates
  (no future, right weekday), saving (everyone present except those listed), the edit lock, lab batch split,
  the student's own report with the 75% / 65% arithmetic, section and department reports, and the Morning Brief.
Needs the Civil year-2 roll list (the placeholder one is fine)."""
import json
import math
import secrets
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

import bcrypt

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.app.attendance.core import analyse, can_miss, need_in_row  # noqa: E402

db_path, creds = sys.argv[1], Path(sys.argv[2])
BASE = __import__("os").environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
lines = creds.read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
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


# ── Pure arithmetic ────────────────────────────────────────────────────────────────
check("can miss: 36/40 at 75% -> 8", can_miss(36, 40, 0.75) == 8 and 36 / 48 >= 0.75 > 36 / 49)
check("exactly 75%: can miss 0", can_miss(30, 40, 0.75) == 0)
check("need: 28/40 -> 8 in a row for 75%", need_in_row(28, 40, 0.75) == 8 and 36 / 48 >= 0.75 > 35 / 47)
check("need: 24/40 -> 6 in a row for 65%", need_in_row(24, 40, 0.65) == 6 and 30 / 46 >= 0.65 > 29 / 45)
a = analyse(36, 40, 30, 75, 65)
check("semester bunks: 90% with 30 left -> 13", a["semester_bunks_left"] == 13 and a["status"] == "good", a)
check("status bands", [analyse(x, 100, None, 75, 65)["status"] for x in (80, 70, 60)] == ["good", "condonation", "detained"])
check("no classes -> none", analyse(0, 0, None, 75, 65)["status"] == "none")

# ── Setup ──────────────────────────────────────────────────────────────────────────
con = sqlite3.connect(db_path)
con.execute("PRAGMA foreign_keys = ON")
entries = con.execute("SELECT id, day_of_week, faculty_id, section, batch, end_time FROM timetable_entries "
                      "WHERE is_active = 1 AND section = 'Civil-3' ORDER BY id").fetchall()
roster = [r for (r,) in con.execute("SELECT roll_no FROM student_roster WHERE department = 'CIVIL' AND year = 2 ORDER BY roll_no")]
if not entries or not roster:
    print("SKIP: needs the Civil-3 timetable and the Civil year-2 roll list")
    sys.exit(0)
whole = next(e for e in entries if not e[4] and e[2])
fac_email = con.execute("SELECT email FROM faculty_profiles WHERE id = ?", (whole[2],)).fetchone()[0]
# The teacher may already have an account (create_faculty_accounts.py): borrow it with a temporary password
existing_teacher = con.execute("SELECT id, hashed_password FROM users WHERE lower(email) = lower(?)", (fac_email,)).fetchone()
used = {r for (r,) in con.execute("SELECT roll_no FROM student_profiles WHERE roll_no IS NOT NULL")}
roll = next(r for r in roster if r not in used)
other = next(r for r in roster if r != roll)

tag = uuid.uuid4().hex[:6]
pw = secrets.token_urlsafe(10)
hashed = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
users = {"teacher": (f"u_att_t_{tag}", fac_email, "faculty", "CIVIL"),
         "hod": (f"u_att_h_{tag}", f"att.hod.{tag}@example.com", "faculty", "CIVIL"),
         "student": (f"u_att_s_{tag}", f"att.student.{tag}@example.com", "student", "CIVIL"),
         "admin": (f"u_att_a_{tag}", f"att.admin.{tag}@example.com", "admin", "Administration")}
if existing_teacher:
    users["teacher"] = (existing_teacher[0], fac_email, "faculty", "CIVIL")
    con.execute("UPDATE users SET hashed_password = ? WHERE id = ?", (hashed, existing_teacher[0]))
for k, (uid, email, role, dept) in users.items():
    if k == "teacher" and existing_teacher:
        continue
    con.execute("INSERT INTO users (id, name, email, hashed_password, role, department, status, joined_at, last_active) "
                "VALUES (?, ?, ?, ?, ?, ?, 'active', '2026-10-27', '2026-10-27')", (uid, f"Att Test {k}", email, hashed, role, dept))
con.execute("INSERT INTO approver_assignments (role, user_id, department) VALUES ('hod', ?, 'CIVIL')", (users["hod"][0],))
con.execute("INSERT INTO student_profiles (user_id, roll_no, department, program, year, section, parent_name, gender) "
            "VALUES (?, ?, 'CIVIL', 'B.E.', 2, 'A', 'Parent', 'male')", (users["student"][0], roll))
con.commit()
saved_rules = con.execute("SELECT target_pct, floor_pct, semester_start, semester_end, edit_hours FROM attendance_rules WHERE id = 1").fetchone()

tok = {}
for k, (uid, email, *_r) in users.items():
    s, d = call("POST", "/auth/login", body={"email": email, "password": pw})
    check(f"login {k}", s == 200, d)
    tok[k] = d["access_token"]
s, d = call("POST", "/auth/login", body={"email": emails["mentor"], "password": demo_pw})
tok["other_faculty"] = d["access_token"]

today = (datetime.utcnow() + timedelta(hours=5, minutes=30)).date()
def last(dow, weeks_back=0):
    d = today - timedelta(days=(today.weekday() - dow) % 7 or 7) - timedelta(weeks=weeks_back)   # weeks_back=1: always > 7 days ago
    return d
d1, d0 = last(whole[1]), last(whole[1], 1)      # last week's and the week before's class
E = whole[0]

try:
    # Rules
    s, r0 = call("GET", "/attendance/rules", tok["student"])
    check("rules readable by everyone", s == 200 and "target_pct" in r0)
    rules = {"target_pct": 75, "floor_pct": 65, "edit_hours": 24,
             "semester_start": (today - timedelta(days=60)).isoformat(), "semester_end": (today + timedelta(days=30)).isoformat()}
    check("only admins change the rules", call("PUT", "/attendance/rules", tok["hod"], rules)[0] == 403)
    check("floor above target refused", call("PUT", "/attendance/rules", tok["admin"], {**rules, "floor_pct": 80})[0] == 422)
    check("admin sets the rules", call("PUT", "/attendance/rules", tok["admin"], rules)[0] == 200)

    # Who may open and mark
    q = f"/attendance/session?entry_id={E}&date={d1}"
    check("teacher opens their class", call("GET", q, tok["teacher"])[0] == 200)
    check("HOD opens a department class", call("GET", q, tok["hod"])[0] == 200)
    check("students can't open a class list", call("GET", q, tok["student"])[0] == 403)
    check("other faculty can't", call("GET", q, tok["other_faculty"])[0] == 403)
    check("future date refused", call("GET", f"/attendance/session?entry_id={E}&date={today + timedelta(days=7)}", tok["teacher"])[0] == 422)
    check("wrong weekday refused", call("GET", f"/attendance/session?entry_id={E}&date={d1 + timedelta(days=1)}", tok["teacher"])[0] == 422)
    s, cl = call("GET", f"/attendance/classes?date={d1}", tok["teacher"])
    check("the period is in the teacher's list for that day", s == 200 and any(c["entry_id"] == E for c in cl["classes"]), cl)
    s, sess = call("GET", q, tok["teacher"])
    check("everyone starts present", all(x["status"] == "present" for x in sess["students"]) and len(sess["students"]) == len(roster))

    # Saving
    body = {"entry_id": E, "date": str(d1), "absent": [roll], "late": [other]}
    check("unknown roll refused", call("PUT", "/attendance/session", tok["teacher"], {**body, "absent": ["NOPE-1"]})[0] == 422)
    check("absent and late together refused", call("PUT", "/attendance/session", tok["teacher"], {**body, "late": [roll]})[0] == 422)
    check("students can't save", call("PUT", "/attendance/session", tok["student"], body)[0] == 403)
    s, res = call("PUT", "/attendance/session", tok["teacher"], body)
    check("teacher saves", s == 200 and res["absent"] == 1 and res["late"] == 1 and res["present"] == len(roster) - 2, res)
    s, again = call("GET", q, tok["teacher"])
    st = {x["roll_no"]: x["status"] for x in again["students"]}
    check("marks stored", again["saved"] and st[roll] == "absent" and st[other] == "late")

    # Edit lock: the class two weeks back (d0) is long past the 24 hours. Its first save is allowed, a correction isn't
    old = {"entry_id": E, "date": str(d0), "absent": [], "late": []}
    check("first save of an old class is allowed", call("PUT", "/attendance/session", tok["teacher"], old)[0] == 200)
    check("teacher can't correct it after the lock", call("PUT", "/attendance/session", tok["teacher"], {**old, "absent": [roll]})[0] == 403)
    check("HOD can correct any time", call("PUT", "/attendance/session", tok["hod"], old)[0] == 200)

    # Lab batches: G1 / G2 split the class list in two
    lab = next((e for e in entries if e[4] in ("G1", "1")), None)
    if lab:
        s, ls = call("GET", f"/attendance/session?entry_id={lab[0]}&date={last(lab[1])}", tok["hod"])
        members = [x for x in ls["students"] if x["in_group"]]
        check("batch 1 is the first half of the roll list", len(members) == math.ceil(len(roster) / 2)
              and members[0]["roll_no"] == roster[0], len(members))

    # The student's own report
    s, me = call("GET", "/attendance/me", tok["student"])
    subj = next((x for x in me.get("subjects", []) if x["held"]), None)
    check("student sees their attendance", s == 200 and me["ready"] and subj, me)
    if subj:
        check("1 absent of 2 -> 50%, detention band", subj["held"] == 2 and subj["attended"] == 1 and subj["pct"] == 50.0
              and subj["status"] == "detained", subj)
        check("need in a row matches the formula", subj["need_for_target"] == need_in_row(1, 2, 0.75) == 2, subj)
        check("semester estimate shown (dates set)", subj["remaining"] is not None and "semester_bunks_left" in subj, subj)
    check("faculty can't use the student view", call("GET", "/attendance/me", tok["teacher"])[0] == 403)
    brief = call("GET", "/ai/brief", tok["student"])[1]
    check("Morning Brief warns the student", any(i["kind"] == "attendance" and i["tone"] == "bad" for i in brief["items"]), brief["items"])

    # Reports
    s, rep = call("GET", "/attendance/section?section=Civil-3", tok["teacher"])
    check("teacher sees their section report", s == 200 and rep["sessions"] >= 2)
    low = next(x for x in rep["students"] if x["roll_no"] == roll)
    check("lowest first, flagged below 65%", rep["students"][0]["pct"] <= rep["students"][-1]["pct"] and low["status"] == "detained")
    check("HOD sees it", call("GET", "/attendance/section?section=Civil-3", tok["hod"])[0] == 200)
    check("other faculty can't", call("GET", "/attendance/section?section=Civil-3", tok["other_faculty"])[0] == 403)
    s, ov = call("GET", "/attendance/overview", tok["hod"])
    check("HOD overview: Civil sections only", s == 200 and ov["sections"] and all(x["department"] == "CIVIL" for x in ov["sections"]), ov)
    check("plain faculty have no overview", call("GET", "/attendance/overview", tok["other_faculty"])[0] == 403)
    s, ova = call("GET", "/attendance/overview", tok["admin"])
    check("admin overview covers more departments", s == 200 and len({x["department"] for x in ova["sections"]}) >= 1)
finally:
    sids = [i for (i,) in con.execute("SELECT id FROM attendance_sessions WHERE timetable_entry_id IN (%s)" % ",".join(str(e[0]) for e in entries))]
    if sids:
        con.execute("DELETE FROM attendance_marks WHERE session_id IN (%s)" % ",".join(map(str, sids)))
        con.execute("DELETE FROM attendance_sessions WHERE id IN (%s)" % ",".join(map(str, sids)))
    con.execute("DELETE FROM attendance_groups WHERE section = 'Civil-3'")
    if existing_teacher:
        con.execute("UPDATE users SET hashed_password = ? WHERE id = ?", (existing_teacher[1], existing_teacher[0]))
    ids = [u[0] for u in users.values() if not (existing_teacher and u[0] == existing_teacher[0])]
    con.execute("DELETE FROM approver_assignments WHERE user_id IN (%s)" % ",".join("?" * len(ids)), ids)
    con.execute("DELETE FROM student_profiles WHERE user_id IN (%s)" % ",".join("?" * len(ids)), ids)
    con.execute("DELETE FROM users WHERE id IN (%s)" % ",".join("?" * len(ids)), ids)
    if saved_rules:
        con.execute("UPDATE attendance_rules SET target_pct=?, floor_pct=?, semester_start=?, semester_end=?, edit_hours=? WHERE id = 1", saved_rules)
    else:
        con.execute("DELETE FROM attendance_rules WHERE id = 1")   # it didn't exist before: back to the defaults
    con.commit()
    con.close()

print(f"\n{len(failures)} failure(s)" if failures else "\nAll attendance checks passed")
sys.exit(1 if failures else 0)
