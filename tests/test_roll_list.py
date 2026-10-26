"""Roll list: the imported roster in the database, the Admin Office endpoint, and the roll-number
checks on a student's profile. Uses two temporary student accounts, deleted at the end.
No roll numbers or names are written here; the test picks entries from the roster itself.

Usage: python tests/test_roll_list.py <campussphere.db> <demo_accounts.local.txt> <.env>"""
import json
import os
import re
import secrets
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
BASE = os.environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
db_path, creds, env = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
lines = creds.read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
admin_pw = next(l.split("=", 1)[1].strip() for l in env.read_text(encoding="utf-8").splitlines() if l.startswith("ADMIN_PASSWORD="))
ROLL = re.compile(r"^\d{4}-\d{2}(-\d{3})?-\d{3}$")
EMAIL = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
fails = []


def call(m, p, t=None, b=None):
    r = urllib.request.Request(BASE + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                               headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {t}"} if t else {})})
    try:
        with urllib.request.urlopen(r, timeout=60) as x:
            return x.status, json.loads(x.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{info}]" if info and not ok else ""))
    if not ok:
        fails.append(name)


def login(email, pw):
    s, d = call("POST", "/auth/login", b={"email": email, "password": pw})
    check(f"login {email.split('@')[0]}", s == 200, d)
    return d["access_token"]


# ── The roster table itself ──────────────────────────────────────────────────
c = sqlite3.connect(db_path)
rows = c.execute("select roll_no, name, department, year, section, email, academic_year from student_roster").fetchall()
check("roster has students", len(rows) > 0, len(rows))
check("every roll number well-formed", all(ROLL.match(r[0]) for r in rows), [r[0] for r in rows if not ROLL.match(r[0])][:3])
check("every student has a name", all(r[1] and r[1].strip() for r in rows))
check("years are 1-4", all(r[3] in (1, 2, 3, 4) for r in rows))
check("stored emails are valid", all(r[5] is None or EMAIL.match(r[5]) for r in rows))
check("sections are single letters", all(r[4] is None or re.fullmatch(r"[A-Z]", r[4]) for r in rows))
check("one academic year", len({r[6] for r in rows}) == 1, {r[6] for r in rows})
with_sections = {(r[2], r[3]) for r in rows if r[4]}
check("no student missing a section in a sectioned list", not [r[0] for r in rows if (r[2], r[3]) in with_sections and not r[4]])

# ── Admin Office endpoint ────────────────────────────────────────────────────
admin = login("admin@suhruth.edu", admin_pw)
office = login(emails["office"], demo_pw)
student = login(emails["student"], demo_pw)
s, d = call("GET", "/services/admin/roll-list?limit=2000", admin)
check("admin: roll list 200", s == 200, d)
check("total matches the database", d["total"] == len(rows), (d["total"], len(rows)))
check("group counts add up", sum(g["students"] for g in d["groups"]) == len(rows))
check("section counts add up", all(sum(g["sections"].values()) == g["students"] for g in d["groups"]))
db_groups = {(dep, y): n for dep, y, n in c.execute("select department, year, count(*) from student_roster group by 1, 2")}
check("groups match the database", {(g["department"], g["year"]): g["students"] for g in d["groups"]} == db_groups)
check("staff (Admin Office) can read", call("GET", "/services/admin/roll-list?limit=1", office)[0] == 200)
check("student cannot read -> 403", call("GET", "/services/admin/roll-list", student)[0] == 403)
check("no login -> 401", call("GET", "/services/admin/roll-list")[0] == 401)

dep, yr = next(iter(db_groups))
s, d2 = call("GET", f"/services/admin/roll-list?department={dep.lower()}&year={yr}&limit=2000", admin)
check("branch+year filter", s == 200 and d2["total"] == db_groups[(dep, yr)] and all(i["department"] == dep and i["year"] == yr for i in d2["items"]))
sample = next(r for r in rows if r[4])
s, d3 = call("GET", f"/services/admin/roll-list?department={sample[2]}&year={sample[3]}&section={sample[4].lower()}&limit=2000", admin)
n_sec = c.execute("select count(*) from student_roster where department=? and year=? and section=?", sample[2:5]).fetchone()[0]
check("section filter", s == 200 and d3["total"] == n_sec)
s, d4 = call("GET", f"/services/admin/roll-list?q={sample[0]}", admin)
check("search by roll number", s == 200 and d4["total"] == 1 and d4["items"][0]["name"] == sample[1])
s, d5 = call("GET", "/services/admin/roll-list?limit=5", admin)
check("limit respected", s == 200 and len(d5["items"]) == 5 and d5["total"] == len(rows))

# ── Profile checks against the roll list (two temporary students) ────────────
registered = {r[0] for r in c.execute("select roll_no from student_profiles where roll_no is not null")}
target = next(r for r in rows if r[4] and r[0] not in registered)   # roll, name, dept, year, section
other_dept = "CIVIL" if target[2] != "CIVIL" else "MECH"
tag = secrets.token_hex(4)
temp = []
for i in (1, 2):
    s, u = call("POST", "/auth/register", admin, {"name": f"Roll Test {i}", "email": f"rolltest{i}.{tag}@example.com",
                                                  "password": f"Rt-{tag}-pass", "role": "student", "department": other_dept})
    check(f"temp student {i} created", s == 201, u)
    temp.append(u["id"])
t1 = login(f"rolltest1.{tag}@example.com", f"Rt-{tag}-pass")
t2 = login(f"rolltest2.{tag}@example.com", f"Rt-{tag}-pass")
wrong_sec = "Z" if target[4] != "Z" else "Y"
base = {"roll_no": target[0], "parent_name": "Test Parent", "gender": "other"}
try:
    s, d = call("PUT", "/services/me/profile", t1, {**base, "year": target[3], "section": wrong_sec})
    check("wrong section -> 422 naming the right one", s == 422 and f"section {target[4]}" in d["detail"], d)
    s, d = call("PUT", "/services/me/profile", t1, {**base, "year": target[3] % 4 + 1, "section": target[4]})
    check("wrong year -> 422", s == 422, d)
    s, d = call("PUT", "/services/me/profile", t1, {**base, "roll_no": target[0].lower(), "year": target[3], "section": target[4].lower()})
    check("matching details -> 200", s == 200, d)
    check("branch taken from the roll list", d.get("department") == target[2], (d.get("department"), target[2]))
    check("roll number stored upper-case", d.get("roll_no") == target[0], d.get("roll_no"))
    check("profile shows the roll-list entry", (d.get("roll_list") or {}).get("name") == target[1], d.get("roll_list"))
    s, d = call("PUT", "/services/me/profile", t2, {**base, "year": target[3], "section": target[4]})
    check("same roll on a second account -> 409", s == 409, d)
    s, d = call("PUT", f"/services/admin/students/{temp[1]}/profile", admin, {**base, "year": target[3], "section": target[4]})
    check("admin also cannot reuse a taken roll -> 409", s == 409, d)
    s, d = call("PUT", "/services/me/profile", t2, {**base, "roll_no": "9999-99-999-999", "year": 2, "section": "A"})
    check("roll not in the list is still accepted", s == 200 and d.get("roll_list") is None, d)
    s, d = call("PUT", f"/services/admin/students/{temp[0]}/profile", admin,
                {**base, "year": target[3] % 4 + 1, "section": wrong_sec, "department": other_dept})
    check("admin can override year/section/branch", s == 200 and d.get("year") == target[3] % 4 + 1 and d.get("department") == other_dept, d)
    s, d = call("GET", f"/services/admin/roll-list?q={target[0]}", admin)
    check("roll list marks the student as signed up", s == 200 and d["items"][0]["registered"] is True, d)
finally:
    for uid in temp:
        s, d = call("DELETE", f"/auth/users/{uid}", admin)
        check("temp student deleted", s == 200, d)
check("temporary profiles gone", c.execute(f"select count(*) from student_profiles where user_id in ({','.join('?' * len(temp))})", temp).fetchone()[0] == 0)

print(f"\n{len(fails)} failure(s)" + (": " + ", ".join(fails) if fails else ""))
sys.exit(1 if fails else 0)
