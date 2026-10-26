"""Test the Student Services admin endpoints with a throwaway admin account, then delete it."""
import json
import secrets
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import bcrypt

db_path, creds = sys.argv[1], Path(sys.argv[2])
BASE = __import__("os").environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
lines = creds.read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}

admin_id = f"u_tmp{uuid.uuid4().hex[:8]}"
admin_email = f"tmp.admin.{uuid.uuid4().hex[:6]}@example.com"
admin_pw = secrets.token_urlsafe(12)
con = sqlite3.connect(db_path)
con.execute("INSERT INTO users (id, name, email, hashed_password, role, department, status, joined_at, last_active) "
            "VALUES (?, 'Temp Test Admin', ?, ?, 'admin', 'Administration', 'active', '2026-10-22', '2026-10-22')",
            (admin_id, admin_email, bcrypt.hashpw(admin_pw.encode(), bcrypt.gensalt()).decode()))
con.commit()

failures = []


def call(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info and not cond else ""))
    if not cond:
        failures.append(name)


try:
    _, d = call("POST", "/auth/login", body={"email": admin_email, "password": admin_pw})
    tok = d["access_token"]
    s, people = call("GET", "/services/admin/approvers", tok)
    check("list approver users", s == 200 and any(p["email"] == emails["hod"] for p in people))
    s, rows = call("GET", "/services/admin/assignments", tok)
    check("list assignments (4 demo)", s == 200 and {r["role"] for r in rows} >= {"class_incharge", "ahod", "hod", "principal"}, rows)
    s, studs = call("GET", "/services/admin/students", tok)
    demo = next((x for x in studs if x["email"] == emails["student"]), None)
    check("list students incl. demo with mentor", s == 200 and demo and demo["mentor_name"], demo)

    hod = next(p for p in people if p["email"] == emails["hod"])
    s, d = call("POST", "/services/admin/assignments", tok, {"role": "class_incharge", "user_id": hod["id"], "department": "CSE"})
    check("class in-charge needs year+section -> 422", s == 422, d)
    s, d = call("POST", "/services/admin/assignments", tok, {"role": "hod", "user_id": demo["user_id"], "department": "ECE"})
    check("students can't be approvers -> 400", s == 400, d)
    s, d = call("POST", "/services/admin/assignments", tok, {"role": "hod", "user_id": hod["id"], "department": "ece"})
    check("assign HOD for ECE (dept upper-cased)", s == 200, d)
    s, rows = call("GET", "/services/admin/assignments", tok)
    ece = [r for r in rows if r["role"] == "hod" and r["department"] == "ECE"]
    check("ECE HOD stored once", len(ece) == 1, rows)
    s, d = call("POST", "/services/admin/assignments", tok, {"role": "hod", "user_id": hod["id"], "department": "ECE"})
    s, rows = call("GET", "/services/admin/assignments", tok)
    check("re-assign replaces, no duplicates", len([r for r in rows if r["role"] == "hod" and r["department"] == "ECE"]) == 1)
    s, d = call("DELETE", f"/services/admin/assignments/{ece[0]['id']}", tok)
    s2, d2 = call("DELETE", f"/services/admin/assignments/{[r for r in rows if r['role'] == 'hod' and r['department'] == 'ECE'][0]['id']}", tok)
    check("remove ECE HOD", s2 == 200 or s == 200, (d, d2))

    body = {"roll_no": demo["roll_no"], "department": "CSE", "program": "B.E.", "year": 3, "section": "A",
            "parent_name": demo["parent_name"], "gender": demo["gender"], "mentor_id": demo["mentor_id"]}
    s, d = call("PUT", f"/services/admin/students/{demo['user_id']}/profile", tok, body)
    check("admin edits student profile", s == 200 and d["mentor_id"] == demo["mentor_id"] and d["complete"], d)
    s, d = call("PUT", f"/services/admin/students/{demo['user_id']}/profile", tok, {**body, "mentor_id": demo["user_id"]})
    check("student can't be a mentor -> 400", s == 400, d)

    s, allr = call("GET", "/services/admin/requests", tok)
    check("all requests overview", s == 200 and len(allr) >= 4)
    s, inbox = call("GET", "/services/approvals/inbox", tok)
    check("admin inbox has 'others' queue", s == 200 and "others" in inbox)
finally:
    con.execute("DELETE FROM users WHERE id = ?", (admin_id,))
    con.commit()
    left = con.execute("SELECT COUNT(*) FROM users WHERE id = ?", (admin_id,)).fetchone()[0]
    print(f"temporary admin removed: {left == 0}")
    con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
