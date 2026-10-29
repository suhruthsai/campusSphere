"""Test that HODs arrange substitutions for their own department only, with throwaway accounts (a Civil HOD,
an admin): HOD creates / edits / cancels a Civil substitution; can't touch IT; plain faculty can't at all;
admins can do any department; the audit log names who did it. Cleans up everything it creates."""
import json
import secrets
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import bcrypt

db_path, creds = sys.argv[1], Path(sys.argv[2])
BASE = __import__("os").environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
lines = creds.read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
failures, made = [], []


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
today = (datetime.utcnow() + timedelta(hours=5, minutes=30)).date()


def plan(dept_like, avoid=None):
    """A future class of that department, and a faculty member free at that time (not `avoid`)."""
    rows = con.execute("SELECT id, day_of_week, period_number, start_time, end_time, classroom_id, section, subject_id, "
                       "subject_name, faculty_id, faculty_name FROM timetable_entries WHERE is_active = 1 AND upper(department) = ? "
                       "ORDER BY id", (dept_like,)).fetchall()
    for e in rows:
        day = today + timedelta(days=((e[1] - today.weekday()) % 7) or 7)
        busy = {f for (f,) in con.execute("SELECT faculty_id FROM timetable_entries WHERE day_of_week = ? AND period_number = ?",
                                          (e[1], e[2]))} | ({avoid} if avoid else set())
        taken = con.execute("SELECT 1 FROM substitutions WHERE classroom_id = ? AND date = ? AND period_number = ? AND status = 'active'",
                            (e[5], day.isoformat(), e[2])).fetchone()
        free = con.execute("SELECT id, name FROM faculty_profiles WHERE is_active = 1 AND id NOT IN (%s) LIMIT 1"
                           % ",".join("?" * len(busy)), list(busy)).fetchone() if busy else None
        if free and not taken:
            return {"date": day.isoformat(), "period_number": e[2], "start_time": e[3], "end_time": e[4], "classroom_id": e[5],
                    "section": e[6], "subject_id": e[7], "subject_name": e[8], "original_faculty_id": e[9],
                    "original_faculty_name": e[10], "replacement_faculty_id": free[0], "replacement_faculty_name": free[1],
                    "reason": "Faculty On Leave", "created_by": "test"}
    return None


civil = plan("CIVIL")
it = plan("IT", avoid=civil and civil["replacement_faculty_id"])
if not civil or not it:
    print("SKIP: needs Civil and IT timetables with a free faculty member")
    sys.exit(0)

tag = uuid.uuid4().hex[:6]
pw = secrets.token_urlsafe(10)
hashed = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
users = {"hod": (f"u_sub_h_{tag}", f"sub.hod.{tag}@example.com", "faculty"),
         "admin": (f"u_sub_a_{tag}", f"sub.admin.{tag}@example.com", "admin")}
for k, (uid, email, role) in users.items():
    con.execute("INSERT INTO users (id, name, email, hashed_password, role, department, status, joined_at, last_active) "
                "VALUES (?, ?, ?, ?, ?, 'CIVIL', 'active', '2026-10-27', '2026-10-27')", (uid, f"Sub Test {k}", email, hashed, role))
con.execute("INSERT INTO approver_assignments (role, user_id, department) VALUES ('hod', ?, 'CIVIL')", (users["hod"][0],))
con.commit()

tok = {k: call("POST", "/auth/login", body={"email": e, "password": pw})[1]["access_token"] for k, (_, e, _r) in users.items()}
tok["faculty"] = call("POST", "/auth/login", body={"email": emails["mentor"], "password": demo_pw})[1]["access_token"]

try:
    s, sub = call("POST", "/substitutions/", tok["hod"], civil)
    check("HOD arranges a substitution for their department", s == 200, sub)
    if s == 200:
        made.append(sub["id"])
    check("HOD can't for another department", call("POST", "/substitutions/", tok["hod"], it)[0] == 403)
    check("plain faculty can't arrange substitutions", call("POST", "/substitutions/", tok["faculty"], civil)[0] == 403)
    s, isub = call("POST", "/substitutions/", tok["admin"], it)
    check("admin arranges for any department", s == 200, isub)
    if s == 200:
        made.append(isub["id"])
        check("HOD can't cancel another department's", call("POST", f"/substitutions/{isub['id']}/cancel", tok["hod"], {"cancelled_by": "x"})[0] == 403)
        check("HOD can't edit another department's", call("PUT", f"/substitutions/{isub['id']}", tok["hod"], {"notes": "x", "updated_by": "x"})[0] == 403)
    if made and made[0] == sub.get("id"):
        check("HOD edits their own", call("PUT", f"/substitutions/{sub['id']}", tok["hod"], {"notes": "covered", "updated_by": "x"})[0] == 200)
        check("HOD cancels their own", call("POST", f"/substitutions/{sub['id']}/cancel", tok["hod"], {"cancelled_by": "x"})[0] == 200)
        who = {c for (c,) in con.execute("SELECT changed_by FROM substitution_audit_logs WHERE substitution_id = ?", (sub["id"],))}
        check("the audit log names the HOD, not the client's value", who == {"Sub Test hod"}, who)
finally:
    if made:
        q = ",".join("?" * len(made))
        con.execute(f"DELETE FROM substitution_audit_logs WHERE substitution_id IN ({q})", made)
        con.execute(f"DELETE FROM substitutions WHERE id IN ({q})", made)
    ids = [u[0] for u in users.values()]
    con.execute("DELETE FROM approver_assignments WHERE user_id IN (?, ?)", ids)
    con.execute("DELETE FROM users WHERE id IN (?, ?)", ids)
    con.commit()
    con.close()

print(f"\n{len(failures)} failure(s)" if failures else "\nAll HOD substitution checks passed")
sys.exit(1 if failures else 0)
