"""Test Accreditation Autopilot: who may see it, the NAAC/NBA reports, the evidence pack and the desk wall
(including a live request's waiting time). Uses a throwaway admin and the seeded demo accounts; cleans up."""
import json
import secrets
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import bcrypt

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.app.accreditation.desks import fmt_hours, percentile, rag, request_timings  # noqa: E402

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


# ── Pure functions (no server needed) ───────────────────────────────────────────
check("percentile median", percentile([1, 2, 3, 4], 0.5) == 2.5)
check("percentile empty", percentile([], 0.9) is None)
check("fmt_hours", (fmt_hours(0.2), fmt_hours(3.25), fmt_hours(72), fmt_hours(None)) == ("12 min", "3.2 h", "3.0 days", "—"))
base = {"handled": 4, "pending": 0, "overdue": 0, "within_sla_pct": 100, "median_hours": 2}
check("rag green", rag(base, 24) == "green")
check("rag red when overdue", rag({**base, "pending": 1, "overdue": 1}, 24) == "red")
check("rag amber when slipping", rag({**base, "within_sla_pct": 80}, 24) == "amber")
check("rag idle", rag({**base, "handled": 0, "within_sla_pct": None, "median_hours": None}, 24) == "idle")

t0 = datetime(2026, 10, 1, 9, 0)
steps = [
    {"role": "mentor", "label": "Mentor", "approver_id": "m", "approver_name": "M", "status": "approved", "acted_at": (t0 + timedelta(hours=5)).isoformat()},
    # same person, same action: no extra time, left out
    {"role": "class_incharge", "label": "Class In-charge", "approver_id": "m", "approver_name": "M", "status": "approved", "acted_at": (t0 + timedelta(hours=5)).isoformat()},
    {"role": "hod", "label": "HOD", "approver_id": "h", "approver_name": "H", "status": "approved", "acted_at": (t0 + timedelta(hours=35)).isoformat()},
    {"role": "principal", "label": "Principal", "approver_id": "p", "approver_name": "P", "status": "pending", "acted_at": None},
]
req = SimpleNamespace(id=1, ref_no="R/1", doc_type="bonafide", student={"department": "CSE"}, steps=steps, current_step=3,
                      status="in_review", step_since=t0 + timedelta(hours=35), fulfilment="generated", issued_at=None)
rows = request_timings(req, t0, t0 + timedelta(hours=45))
check("timings: one row per desk reached", [r["role"] for r in rows] == ["mentor", "hod", "principal"], rows)
check("timings: durations", [round(r.get("hours", r.get("waiting")), 1) for r in rows] == [5.0, 30.0, 10.0], rows)
check("timings: current desk is waiting", "waiting" in rows[-1] and "hours" not in rows[-1])


# ── API ──────────────────────────────────────────────────────────────────────────
def call(method, path, token=None, body=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
            return r.status, (data if raw else json.loads(data or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def login(email, password):
    s, d = call("POST", "/auth/login", body={"email": email, "password": password})
    check(f"login {email.split('@')[0]}", s == 200, d)
    return d.get("access_token")


admin_id = f"u_tmp{uuid.uuid4().hex[:8]}"
admin_email = f"tmp.admin.{uuid.uuid4().hex[:6]}@example.com"
admin_pw = secrets.token_urlsafe(12)
con = sqlite3.connect(db_path)
con.execute("INSERT INTO users (id, name, email, hashed_password, role, department, status, joined_at, last_active) "
            "VALUES (?, 'Temp Test Admin', ?, ?, 'admin', 'Administration', 'active', '2026-10-26', '2026-10-26')",
            (admin_id, admin_email, bcrypt.hashpw(admin_pw.encode(), bcrypt.gensalt()).decode()))
con.commit()
created_request = None
try:
    admin = login(admin_email, admin_pw)
    principal = login(emails["principal"], demo_pw)
    mentor = login(emails["mentor"], demo_pw)
    student = login(emails["student"], demo_pw)

    # Access
    check("no token -> 401", call("GET", "/accreditation/report")[0] == 401)
    for who, tok in (("student", student), ("mentor", mentor)):
        check(f"{who} cannot open the report", call("GET", "/accreditation/report", tok)[0] == 403)
        check(f"{who} cannot open the desk wall", call("GET", "/accreditation/desks", tok)[0] == 403)
    check("access: mentor not allowed", call("GET", "/accreditation/access", mentor)[1] == {"allowed": False})
    check("access: principal allowed", call("GET", "/accreditation/access", principal)[1] == {"allowed": True})
    check("principal opens the desk wall", call("GET", "/accreditation/desks", principal)[0] == 200)
    check("unknown framework -> 422", call("GET", "/accreditation/report?framework=iso", admin)[0] == 422)

    # Reports: NAAC for the whole pilot or one programme; NBA one programme at a time
    statuses = {"live", "test_mode", "simulated", "missing"}
    for fw, sc, n_criteria in (("naac", "both", 7), ("naac", "civil", 7), ("naac", "it", 7), ("nba", "civil", 10), ("nba", "it", 10)):
        name = f"{fw}/{sc}"
        s, r = call("GET", f"/accreditation/report?framework={fw}&scope={sc}", admin)
        check(f"{name} report", s == 200 and r["framework"]["id"] == fw and r["scope"]["id"] == sc, s)
        check(f"{name}: labelled as the Civil & IT Block pilot",
              r["scope"]["pilot"] == "Civil & IT Block pilot" and r["scope"]["label"] in r["note"], r.get("scope"))
        check(f"{name}: all criteria listed", len(r["criteria"]) == n_criteria, len(r["criteria"]))
        metrics = [m for c in r["criteria"] for m in c["metrics"]]
        check(f"{name}: metrics have a known status", metrics and all(m["status"] in statuses for m in metrics))
        check(f"{name}: metrics say where they come from", all(m["source"] or m["status"] == "missing" for m in metrics))
        cov = r["coverage"]
        check(f"{name}: coverage adds up", cov["total"] == len(metrics) == sum(cov[k] for k in statuses), cov)
        check(f"{name}: gaps are the missing and simulated metrics",
              len(r["gaps"]) == cov["missing"] + cov["simulated"], (len(r["gaps"]), cov))
        tables_ok = all(len(row) == len(m["table"]["columns"]) for m in metrics if m.get("table") for row in m["table"]["rows"])
        check(f"{name}: evidence tables are rectangular", tables_ok)
    check("NBA needs one programme -> 422", call("GET", "/accreditation/report?framework=nba&scope=both", admin)[0] == 422)
    check("unknown scope -> 422", call("GET", "/accreditation/report?scope=cse", admin)[0] == 422)
    check("default scope is the whole pilot", call("GET", "/accreditation/report", admin)[1]["scope"]["id"] == "both")

    # Scoping uses each department's own records
    def metric(fw, sc, mid):
        r = call("GET", f"/accreditation/report?framework={fw}&scope={sc}", admin)[1]
        return next(m for c in r["criteria"] for m in c["metrics"] if m["id"] == mid)
    roster = dict(con.execute("SELECT UPPER(department), COUNT(*) FROM student_roster GROUP BY 1").fetchall())
    enrol_it = metric("naac", "it", "enrolment")
    check("IT enrolment = IT roll list", enrol_it["value"] == (f"{roster['IT']:,} students" if roster.get("IT") else "Roll list not imported"),
          enrol_it["value"])
    enrol_both = metric("naac", "both", "enrolment")
    check("pilot enrolment leaves out other branches",
          enrol_both["value"] == f"{roster.get('IT', 0) + roster.get('CIVIL', 0):,} students" or enrol_both["status"] == "missing",
          enrol_both["value"])
    fac = dict(con.execute("SELECT UPPER(department), COUNT(*) FROM faculty_profiles GROUP BY 1").fetchall())
    check("Civil cadre counts Civil faculty only", metric("naac", "civil", "cadre")["detail"].startswith(f"{fac.get('CIVIL', 0)} faculty"),
          metric("naac", "civil", "cadre")["detail"])

    # A generated placeholder roll list never counts as live evidence
    placeholder = {d for (d,) in con.execute(
        "SELECT DISTINCT UPPER(department) FROM student_roster WHERE source LIKE 'GENERATED placeholder%'")}
    for sc, dept in (("civil", "CIVIL"), ("it", "IT")):
        enrol, sfr = metric("nba", sc, "enrolment"), metric("nba", sc, "sfr")
        if dept in placeholder:
            check(f"{sc}: placeholder roll list -> enrolment Simulated", enrol["status"] == "simulated", enrol["status"])
            check(f"{sc}: placeholder roll list -> ratio Simulated", sfr["status"] in ("simulated", "missing"), sfr["status"])
            check(f"{sc}: placeholder is named", "generated placeholder" in enrol["detail"], enrol["detail"])
        elif roster.get(dept):
            check(f"{sc}: official roll list -> enrolment Live", enrol["status"] == "live", enrol["status"])
    if placeholder:
        check("pilot enrolment is Simulated while any branch is a placeholder",
              metric("naac", "both", "enrolment")["status"] == "simulated")
    gen_rolls = [r for (r,) in con.execute("SELECT roll_no FROM student_roster WHERE source LIKE 'GENERATED placeholder%'")]
    check("placeholder roll numbers can't look like real ones", all(r.startswith("GEN-") for r in gen_rolls), gen_rolls[:3])

    att = metric("naac", "both", "attendance")
    n_recorded = con.execute("SELECT COUNT(*) FROM class_session_logs WHERE source = 'recorded'").fetchone()[0]
    n_marked = con.execute("SELECT COUNT(*) FROM attendance_sessions WHERE upper(department) IN ('IT', 'CIVIL')").fetchone()[0]
    check("attendance is Live once classes are marked, else simulated until real headcounts exist",
          att["status"] == ("live" if (n_marked or n_recorded) else "simulated") or att["status"] == "missing", att["status"])

    s, pdf = call("GET", "/accreditation/report.pdf?framework=nba&scope=civil", admin, raw=True)
    check("evidence pack PDF (NBA, Civil)", s == 200 and pdf[:5] == b"%PDF-" and len(pdf) > 5000, s)
    check("NBA PDF needs one programme -> 422", call("GET", "/accreditation/report.pdf?framework=nba&scope=both", admin)[0] == 422)

    # Desk wall: scoped to the pilot's students
    s, before = call("GET", "/accreditation/desks", admin)
    check("desk wall", s == 200 and {"summary", "stages", "desks", "queue", "clearance", "admissions", "scope"} <= set(before), s)
    check("desk wall defaults to the pilot", before["scope"]["id"] == "both")
    check("stage totals match the summary",
          sum(st["handled"] for st in before["stages"]) == before["summary"]["handled"], before["summary"])
    order = {"red": 0, "amber": 1, "green": 2, "idle": 3}
    check("desks ranked slowest first", [order[d["rag"]] for d in before["desks"]] == sorted(order[d["rag"]] for d in before["desks"]))
    check("unknown wall scope -> 422", call("GET", "/accreditation/desks?scope=ece", admin)[0] == 422)
    walls = {sc: call("GET", f"/accreditation/desks?scope={sc}", admin)[1] for sc in ("civil", "it", "both")}

    s, req = call("POST", "/services/requests", student, {"doc_type": "bonafide", "purpose": "Passport application"})
    if s == 409:
        print("SKIP live-request checks (the demo student already has an open bonafide request)")
    else:
        check("create a bonafide request", s == 200, req)
        created_request = req["id"]
        s, d = call("POST", f"/services/requests/{created_request}/approve", mentor, {"remarks": "ok"})
        check("mentor approves", s == 200, d)
        dept = req["student"].get("department", "").upper()
        if dept not in ("IT", "CIVIL"):
            s, after = call("GET", "/accreditation/desks", admin)
            check(f"a {dept} request stays out of the pilot wall",
                  after["summary"]["pending"] == before["summary"]["pending"]
                  and not any(q["request_id"] == created_request for q in after["queue"]))
        # The same request, as an IT student's, shows on the IT and pilot walls and not on Civil
        snap = json.loads(con.execute("SELECT student FROM document_requests WHERE id = ?", (created_request,)).fetchone()[0])
        con.execute("UPDATE document_requests SET student = ? WHERE id = ?", (json.dumps({**snap, "department": "IT"}), created_request))
        con.commit()
        it_after = call("GET", "/accreditation/desks?scope=it", admin)[1]
        civil_after = call("GET", "/accreditation/desks?scope=civil", admin)[1]
        both_after = call("GET", "/accreditation/desks", admin)[1]
        check("IT request: one more waiting on the IT wall", it_after["summary"]["pending"] == walls["it"]["summary"]["pending"] + 1,
              (walls["it"]["summary"]["pending"], it_after["summary"]["pending"]))
        check("IT request: mentor handled one more", it_after["summary"]["handled"] == walls["it"]["summary"]["handled"] + 1)
        check("IT request: not on the Civil wall", civil_after["summary"]["pending"] == walls["civil"]["summary"]["pending"])
        check("IT request: counted on the pilot wall", both_after["summary"]["pending"] == walls["both"]["summary"]["pending"] + 1,
              (walls["both"]["summary"]["pending"], both_after["summary"]["pending"]))
        # The wall lists the 12 longest waits; a request that just arrived may sit below them, so read it directly
        s, req_now = call("GET", f"/services/requests/{created_request}", admin)
        check("request is waiting at the next desk", s == 200 and req_now["current_role"] not in (None, "mentor"), req_now.get("current_role"))
        queued = [q for q in it_after["queue"] if q["request_id"] == created_request]
        check("just-arrived request is not overdue", not queued or not queued[0]["overdue"])
finally:
    if created_request:
        con.execute("DELETE FROM document_requests WHERE id = ?", (created_request,))
    con.execute("DELETE FROM users WHERE id = ?", (admin_id,))
    con.commit()
    con.close()

print(f"\n{len(failures)} failure(s)" if failures else "\nAll accreditation checks passed")
sys.exit(1 if failures else 0)
