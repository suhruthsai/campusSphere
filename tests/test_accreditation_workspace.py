"""Accreditation workspace: the catalog grid, yearly values, evidence, locking, the team's permissions, and the
'not for submission' guard on exports while demonstration data exists.

    python tests/test_accreditation_workspace.py <db> <.env> <demo_accounts.local.txt>

Writes values and evidence for two metric-years, a temporary criterion in-charge role and a fact, then removes them."""
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
Y1, Y2 = "2024-25", "2023-24"


def call(method, path, token=None, body=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
            return r.status, (data if raw else json.loads(data or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def upload(token, fields, filename, content):
    boundary = uuid.uuid4().hex
    body = b""
    for k, v in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
             f"Content-Type: application/octet-stream\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(BASE + "/accreditation/workspace/evidence", method="POST", data=body,
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


def cell(grid, code, year):
    for c in grid["criteria"]:
        for m in c["metrics"]:
            if m["code"] == code:
                return next(x for x in m["cells"] if x["year"] == year)


con = sqlite3.connect(db_path)
admin = login("admin@suhruth.edu", admin_pw)
teacher = login(emails["mentor"], demo_pw)           # a faculty account not on the accreditation team
teacher_id = call("GET", "/auth/me", teacher)[1]["id"]
role_id = None
try:
    s, g = call("GET", "/accreditation/workspace?framework=naac", admin)
    check("NAAC grid: 7 criteria", s == 200 and [c["code"] for c in g["criteria"]] == list("1234567"), s)
    check("NAAC grid: the year in progress + 5 completed years", len(g["years"]) == 6 and g["assessment_years"] == g["years"][1:], g.get("years"))
    check("NAAC Extended Profile listed", len(g["profile"]) >= 8)
    check("marks add up to 1000", sum(c["marks"] for c in g["criteria"]) == 1000)
    check("NBA needs a programme -> 422", call("GET", "/accreditation/workspace?framework=nba", admin)[0] == 422)
    s, n = call("GET", "/accreditation/workspace?framework=nba&programme=IT", admin)
    check("NBA IT grid: 10 criteria, 1000 marks", s == 200 and len(n["criteria"]) == 10 and sum(c["marks"] for c in n["criteria"]) == 1000, s)
    check("teacher off the team can't open it -> 403", call("GET", "/accreditation/workspace", teacher)[0] == 403)

    s, d = call("GET", "/accreditation/workspace/metric?framework=naac&code=2.6.3", admin)
    check("metric detail lists what the peer team asks for", s == 200 and d["evidence"] and d["can_edit"] and d["can_lock"], d)
    check("unknown metric -> 404", call("GET", "/accreditation/workspace/metric?framework=naac&code=9.9.9", admin)[0] == 404)

    base = {"framework": "naac", "code": "2.6.3", "year": Y1}
    check("percentage over 100 -> 422", call("PUT", "/accreditation/workspace/value", admin, {**base, "value": 120})[0] == 422)
    check("year outside the assessment period -> 422", call("PUT", "/accreditation/workspace/value", admin, {**base, "year": "2015-16", "value": 80})[0] == 422)
    s, d = call("PUT", "/accreditation/workspace/value", admin, {**base, "value": 82.5, "note": "test"})
    check("value saved", s == 200, d)
    g = call("GET", "/accreditation/workspace?framework=naac", admin)[1]
    check("a typed-in quantitative value without evidence -> needs_evidence", cell(g, "2.6.3", Y1)["status"] == "needs_evidence", cell(g, "2.6.3", Y1))

    s, e1 = call("POST", "/accreditation/workspace/evidence/link", admin, {**base, "title": "Result analysis (test)", "url": "https://mvsrec.edu.in/"})
    check("link evidence attached", s == 200 and e1["kind"] == "link", e1)
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    s, e2 = upload(admin, {**base, "title": "Signed result analysis (test)", "signed": "true"}, "results.pdf", pdf)
    check("PDF evidence uploaded, signed", s == 200 and e2["signed"] and e2["mime"] == "application/pdf", e2)
    s, d = upload(admin, {**base, "title": "bad"}, "virus.exe", b"MZ not a document")
    check("an .exe is refused -> 422", s == 422, d)
    s, raw = call("GET", f"/accreditation/workspace/evidence/{e2['id']}/file", admin, raw=True)
    check("evidence file downloads intact", s == 200 and raw == pdf)
    g = call("GET", "/accreditation/workspace?framework=naac", admin)[1]
    c = cell(g, "2.6.3", Y1)
    check("with evidence -> ready", c["status"] == "ready" and c["evidence"] == 2, c)

    lock = {"framework": "naac", "code": "2.6.3", "year": Y1}
    check("IQAC/admin locks the reviewed value", call("POST", "/accreditation/workspace/lock", admin, {**lock, "locked": True})[0] == 200)
    check("locked value can't be changed -> 409", call("PUT", "/accreditation/workspace/value", admin, {**base, "value": 90})[0] == 409)
    check("cell shows locked", cell(call("GET", "/accreditation/workspace?framework=naac", admin)[1], "2.6.3", Y1)["status"] == "locked")
    call("POST", "/accreditation/workspace/lock", admin, {**lock, "locked": False})

    con.execute("INSERT INTO accr_values (framework, code, programme, year, value, origin, locked) VALUES ('naac', '2.6.3', '', ?, 70, 'generated', 0)", (Y2,))
    con.commit()
    check("generated values can't be locked for filing -> 400",
          call("POST", "/accreditation/workspace/lock", admin, {**lock, "year": Y2, "locked": True})[0] == 400)

    # Team: a criterion in-charge edits their criterion only
    s, team = call("POST", "/accreditation/workspace/team", admin, {"role": "criterion_incharge", "user_id": teacher_id, "criterion": "2"})
    role_id = next((r["id"] for r in team if r["user_id"] == teacher_id and r["criterion"] == "2"), None)
    check("criterion in-charge assigned", s == 200 and role_id, team)
    s, a = call("GET", "/accreditation/workspace/access", teacher)
    check("in-charge can view, criterion 2 only", a["view"] and a["criteria"] == ["2"] and not a["edit_all"], a)
    check("menu shows the workspace for the team", call("GET", "/auth/me/roles", teacher)[1].get("accreditation_team") is True)
    check("in-charge edits a criterion-2 metric",
          call("PUT", "/accreditation/workspace/value", teacher, {"framework": "naac", "code": "2.4.2", "year": Y1, "value": 41})[0] == 200)
    check("in-charge can't edit criterion 3 -> 403",
          call("PUT", "/accreditation/workspace/value", teacher, {"framework": "naac", "code": "3.3.2", "year": Y1, "value": 1})[0] == 403)
    check("in-charge can't lock -> 403", call("POST", "/accreditation/workspace/lock", teacher, {**lock, "locked": True})[0] == 403)
    check("in-charge can't change the team -> 403",
          call("POST", "/accreditation/workspace/team", teacher, {"role": "iqac_coordinator", "user_id": teacher_id})[0] == 403)

    s, d = call("PUT", "/accreditation/workspace/facts", admin, {"key": "test_fact", "value": "test", "verified": True})
    check("fact saved", s == 200 and any(f["key"] == "test_fact" for f in call("GET", "/accreditation/workspace/facts", admin)[1]))

    # Exports: "not for submission" on every page while demonstration data exists
    demo = any(con.execute(f"SELECT 1 FROM {t} WHERE pilot_run IS NOT NULL LIMIT 1").fetchone()
               for t in ("attendance_sessions", "document_requests", "placement_drives"))
    s, pack = call("GET", "/accreditation/report.pdf?framework=naac&scope=both", admin, raw=True)
    from pypdf import PdfReader
    text = PdfReader(io.BytesIO(pack)).pages[0].extract_text() if s == 200 else ""
    check("evidence pack marked not for submission exactly when demonstration data exists",
          ("NOT FOR SUBMISSION" in text) == demo, (demo, "NOT FOR SUBMISSION" in text))
finally:
    if role_id:
        call("DELETE", f"/accreditation/workspace/team/{role_id}", admin)
    con.execute("DELETE FROM accr_values WHERE framework = 'naac' AND code IN ('2.6.3', '2.4.2', '3.3.2') AND year IN (?, ?)", (Y1, Y2))
    for (fname,) in con.execute("SELECT filename FROM accr_evidence WHERE code = '2.6.3' AND year = ? AND title LIKE '%(test)'", (Y1,)).fetchall():
        if fname:
            (Path(db_path).resolve().parent / "private_uploads" / "accreditation" / fname).unlink(missing_ok=True)
    con.execute("DELETE FROM accr_evidence WHERE code = '2.6.3' AND year = ? AND title LIKE '%(test)'", (Y1,))
    con.execute("DELETE FROM institution_facts WHERE key = 'test_fact'")
    con.commit()
    con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
