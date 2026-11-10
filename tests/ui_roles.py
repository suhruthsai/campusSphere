"""Every role's menu, opened in a real browser: signs in as each kind of person, builds their menu with the app's
own navConfig.js, opens every page in it and reports refused API calls (401/403), server errors, crashes and
pages the route guard bounces. Then it opens the pages NOT in their menu, to show which ones a URL still reaches.

    python tests/ui_roles.py [frontend URL, default http://localhost:5173]

Needs the backend (CAMPUS_API, default http://127.0.0.1:8000), the frontend dev server, the demo accounts and
Playwright's Chromium (npx playwright install chromium). Roles with no demo account (plain faculty, placement
officer, no-dues officer, accreditation team, a final-year student) get temporary accounts that are removed
afterwards. Writes tests/ui_roles_report.json (git-ignored)."""
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import bcrypt

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
FRONT = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173").rstrip("/")
API = os.environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
lines = (ROOT / "backend/app/db/demo_accounts.local.txt").read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
admin_pw = next(l.split("=", 1)[1].strip() for l in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
                if l.startswith("ADMIN_PASSWORD="))


def call(path, token=None, body=None):
    req = urllib.request.Request(API + path, method="POST" if body is not None else "GET",
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or b"null")


tag = uuid.uuid4().hex[:6]
temp_pw = f"Ui-{tag}-pass"
hashed = bcrypt.hashpw(temp_pw.encode(), bcrypt.gensalt()).decode()
# key: (role, department, label); extra rows below give each its desk
TEMP = {
    "principal_role":    ("faculty", "Administration", "Principal (holds the role)"),
    "plain_faculty":     ("faculty", "IT", "Faculty, no desks"),
    "placement_officer": ("faculty", "IT", "Training & Placement Officer"),
    "nodues_officer":    ("faculty", "IT", "No-dues officer (library)"),
    "accreditation_team": ("faculty", "IT", "Accreditation team (criterion 2)"),
    "final_year":        ("student", "IT", "Final-year student"),
}
DEMO = {"admin": "Admin", "office": "Admin Office (staff)", "student": "Student (3rd year)", "joinee": "New joinee",
        "mentor": "Mentor", "hod": "HOD", "coe": "Controller of Examinations"}

con = sqlite3.connect(ROOT / "campussphere.db")
ids = {k: f"u_ui_{k[:6]}_{tag}" for k in TEMP}
try:
    for k, (role, dept, label) in TEMP.items():
        con.execute("INSERT INTO users (id, name, email, hashed_password, role, department, status, must_change_password, "
                    "token_version, joined_at, last_active) VALUES (?, ?, ?, ?, ?, ?, 'active', 0, 0, '2026-11-09', '2026-11-09')",
                    (ids[k], f"UI {label}", f"ui.{k}.{tag}@example.com", hashed, role, dept))
    # The demo Principal doesn't hold the role (the college's real Principal does), so a temporary one is added
    con.execute("INSERT INTO approver_assignments (role, user_id, department) VALUES ('principal', ?, NULL)", (ids["principal_role"],))
    con.execute("INSERT INTO approver_assignments (role, user_id, department) VALUES ('placement_officer', ?, NULL)", (ids["placement_officer"],))
    con.execute("INSERT INTO clearance_officers (unit, department, user_id) VALUES ('library', NULL, ?)", (ids["nodues_officer"],))
    con.execute("INSERT INTO accr_roles (role, user_id, framework, criterion) VALUES ('criterion_incharge', ?, 'NAAC', '2')", (ids["accreditation_team"],))
    con.execute("INSERT INTO student_profiles (user_id, department, program, year, section, parent_name, gender) "
                "VALUES (?, 'IT', 'B.E.', 4, 'A', 'Parent', 'female')", (ids["final_year"],))
    con.commit()

    personas = []
    logins = [("admin", "admin@suhruth.edu", admin_pw)] + [(k, emails[k], demo_pw) for k in DEMO if k != "admin"] \
        + [(k, f"ui.{k}.{tag}@example.com", temp_pw) for k in TEMP]
    for key, email, pw in logins:
        tok = call("/auth/login", body={"email": email, "password": pw})["access_token"]
        me = call("/auth/me", tok)
        personas.append({"key": key, "label": DEMO.get(key) or TEMP[key][2], "token": tok, "user": me,
                         "roles": call("/auth/me/roles", tok)})

    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "personas.json"
        src.write_text(json.dumps(personas), encoding="utf-8")
        out = ROOT / "tests" / "ui_roles_report.json"
        code = subprocess.call(["node", str(ROOT / "tests" / "ui_roles.mjs"), FRONT, str(src), str(out)], cwd=ROOT)
    sys.exit(code)
finally:
    q = ",".join("?" * len(ids))
    v = list(ids.values())
    for table, col in (("approver_assignments", "user_id"), ("clearance_officers", "user_id"), ("accr_roles", "user_id"),
                       ("student_profiles", "user_id"), ("sign_in_events", "user_id"), ("users", "id")):
        con.execute(f"DELETE FROM {table} WHERE {col} IN ({q})", v)
    con.commit()
    left = con.execute(f"SELECT COUNT(*) FROM users WHERE id IN ({q})", v).fetchone()[0]
    print(f"temporary accounts removed: {left == 0}")
    con.close()
