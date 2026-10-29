"""Accreditation readiness: DVV checks, the two-reading estimate, exports (workbook, evidence ZIP, DRAFT marking while
demonstration data exists), the mock visit, and who may use them.

    python tests/test_readiness.py <db> <.env> <demo_accounts.local.txt>"""
import io
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
BASE = os.environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
db_path, env, creds = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
admin_pw = next(l.split("=", 1)[1].strip() for l in env.read_text(encoding="utf-8").splitlines() if l.startswith("ADMIN_PASSWORD="))
lines = creds.read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
failures = []


def call(method, path, token=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method, headers={**({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
            return r.status, (data if raw else json.loads(data or b"null")), r.headers.get("Content-Disposition", "")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null"), ""


def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{str(info)[:300]}]" if info and not cond else ""))
    if not cond:
        failures.append(name)


req = urllib.request.Request(BASE + "/auth/login", method="POST", data=json.dumps({"email": "admin@suhruth.edu", "password": admin_pw}).encode(),
                             headers={"Content-Type": "application/json"})
admin = json.loads(urllib.request.urlopen(req).read())["access_token"]
req = urllib.request.Request(BASE + "/auth/login", method="POST", data=json.dumps({"email": emails["mentor"], "password": demo_pw}).encode(),
                             headers={"Content-Type": "application/json"})
teacher = json.loads(urllib.request.urlopen(req).read())["access_token"]
con = sqlite3.connect(db_path)
demo = any(con.execute(f"SELECT 1 FROM {t} WHERE pilot_run IS NOT NULL LIMIT 1").fetchone()
           for t in ("attendance_sessions", "document_requests", "placement_drives", "obe_courses", "feedback_forms", "faculty_records", "meetings"))

s, r, _ = call("GET", "/accreditation/readiness?framework=naac", admin)
e = r["estimate"]
check("NAAC readiness: 7 criteria, max 1000", s == 200 and len(e["criteria"]) == 7 and e["max"] == 1000, s)
check("fileable never exceeds as-recorded", e["fileable"] <= e["total"] and all(c["estimate_fileable"] <= c["estimate"] for c in e["criteria"]))
check("a blocker exactly when demonstration data is loaded", any(c["severity"] == "blocker" for c in r["checks"]) == demo)
check("checks ordered by severity", [c["severity"] for c in r["checks"]] == sorted([c["severity"] for c in r["checks"]],
                                                                                     key=["blocker", "high", "medium", "low"].index))
check("NBA without a programme -> 422", call("GET", "/accreditation/readiness?framework=nba", admin)[0] == 422)
s, n, _ = call("GET", "/accreditation/readiness?framework=nba&programme=IT", admin)
check("NBA IT readiness: 10 criteria", s == 200 and len(n["estimate"]["criteria"]) == 10, s)
check("teacher off the team -> 403", call("GET", "/accreditation/readiness?framework=naac", teacher)[0] == 403)

s, wb, cd = call("GET", "/accreditation/export/workbook?framework=naac", admin, raw=True)
from openpyxl import load_workbook  # noqa: E402
book = load_workbook(io.BytesIO(wb)) if s == 200 else None
check("workbook: cover, extended profile, 7 criteria, DVV sheet", book and {"Cover", "Extended Profile", "Criterion 1", "Criterion 7", "DVV checks"} <= set(book.sheetnames),
      book.sheetnames if book else s)
cover = " ".join(str(c.value) for row in book["Cover"].iter_rows() for c in row if c.value) if book else ""
check("workbook marked DRAFT exactly when demonstration data exists", ("NOT FOR SUBMISSION" in cover) == demo and ("DRAFT" in cd) == demo, cd)
s, z, cd = call("GET", "/accreditation/export/evidence.zip?framework=naac", admin, raw=True)
names = zipfile.ZipFile(io.BytesIO(z)).namelist() if s == 200 else []
check("evidence ZIP has an index", "index.csv" in names, names[:3])
check("evidence ZIP marked DRAFT exactly when demonstration data exists", any("NOT FOR SUBMISSION" in x for x in names) == demo)

s, v, _ = call("GET", "/accreditation/mock-visit?programme=IT&seed=7", admin)
check("mock visit draws checks and 7 questions", s == 200 and v["total"] >= 1 and len(v["questions"]) == 7, v.get("total"))
s, v2, _ = call("GET", "/accreditation/mock-visit?programme=IT&seed=7", admin)
check("same seed, same draw", v2["checks"] == v["checks"] and v2["questions"] == v["questions"])
con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
