"""End-to-end API test for Student Services V1 (uses the seeded demo accounts)."""
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = __import__("os").environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
creds_file = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
lines = creds_file.read_text(encoding="utf-8").splitlines()
password = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}

failures = []


def call(method, path, token=None, body=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json",
                                          **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
            return r.status, (data if raw else json.loads(data or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info and not cond else ""))
    if not cond:
        failures.append(name)


tok = {}
for key, email in emails.items():
    s, d = call("POST", "/auth/login", body={"email": email, "password": password})
    check(f"login {key}", s == 200, d)
    tok[key] = d["access_token"]

s, prof = call("GET", "/services/me/profile", tok["student"])
check("student profile complete", s == 200 and prof["complete"] and prof["mentor_name"], prof)
s, cat = call("GET", "/services/catalog", tok["student"])
check("catalog has bonafide & noc", s == 200 and {"bonafide", "noc"} <= {c["id"] for c in cat})

# Validation
s, d = call("POST", "/services/requests", tok["student"], {"doc_type": "bonafide", "purpose": "Not a purpose"})
check("invalid purpose -> 422", s == 422, d)
s, d = call("POST", "/services/requests", tok["student"], {"doc_type": "bonafide", "purpose": "Other"})
check("Other without details -> 422", s == 422, d)
s, d = call("POST", "/services/requests", tok["student"], {"doc_type": "noc", "purpose": "Internship", "details": {"organization": "Acme"}})
check("internship NOC without dates -> 422", s == 422, d)
s, d = call("POST", "/services/requests", tok["student"], {"doc_type": "noc", "purpose": "Internship",
            "details": {"organization": "Acme", "from_date": "2026-12-10", "to_date": "2026-11-01"}})
check("to date before from date -> 422", s == 422, d)
s, d = call("POST", "/services/requests", tok["mentor"], {"doc_type": "bonafide", "purpose": "Passport application"})
check("faculty cannot request -> 403", s == 403, d)

# Happy path: bonafide through all five approvers
s, req = call("POST", "/services/requests", tok["student"], {"doc_type": "bonafide", "purpose": "Passport application"})
check("create bonafide", s == 200 and req["status"] == "in_review" and len(req["steps"]) == 5, req)
rid = req["id"]
check("ref no format", req["ref_no"].startswith("MVSR/BON/"), req["ref_no"])
check("starts at mentor in CSE block", req["current_role"] == "mentor" and req["location"] == "cse", req)
check("no verify code before approval", req["verify_code"] is None)
s, d = call("POST", "/services/requests", tok["student"], {"doc_type": "bonafide", "purpose": "Passport application"})
check("duplicate open request -> 409", s == 409, d)
s, d = call("GET", f"/services/requests/{rid}/pdf", tok["student"])
check("pdf before approval -> 400", s == 400, d)
s, d = call("POST", f"/services/requests/{rid}/approve", tok["student"], {})
check("student cannot approve -> 403", s == 403, d)
s, d = call("POST", f"/services/requests/{rid}/approve", tok["hod"], {})
check("HOD cannot skip ahead -> 403", s == 403, d)

s, inbox = call("GET", "/services/approvals/inbox", tok["mentor"])
check("mentor inbox has it", s == 200 and any(r["id"] == rid and r["can_act"] for r in inbox["mine"]), inbox)
s, inbox = call("GET", "/services/approvals/inbox", tok["hod"])
check("HOD inbox doesn't have it yet", s == 200 and not any(r["id"] == rid for r in inbox["mine"]))

for role, expect_next, expect_loc in [("mentor", "class_incharge", "cse"), ("class_incharge", "ahod", "cse"),
                                      ("ahod", "hod", "cse"), ("hod", "principal", "civilit")]:
    s, d = call("POST", f"/services/requests/{rid}/approve", tok[role], {"remarks": f"OK from {role}"})
    check(f"{role} approves -> {expect_next} at {expect_loc}",
          s == 200 and d["current_role"] == expect_next and d["location"] == expect_loc, d)
s, d = call("POST", f"/services/requests/{rid}/approve", tok["principal"], {})
check("principal approves -> approved at Admin Office counter",
      s == 200 and d["status"] == "approved" and d["location"] == "civilit" and d["verify_code"], d)
check("all steps stamped", all(st["status"] == "approved" and st["acted_at"] for st in d["steps"]))
code = d["verify_code"]

s, pdf = call("GET", f"/services/requests/{rid}/pdf", tok["student"], raw=True)
check("pdf downloads", s == 200 and pdf[:4] == b"%PDF", s)
(out_dir / "bonafide_test.pdf").write_bytes(pdf if s == 200 else b"")

s, v = call("GET", f"/services/verify/{code}")
check("public verify (no login) valid", s == 200 and v["valid"] and v["student_name"], v)
check("verify hides parent name", "parent_name" not in json.dumps(v))
s, v = call("GET", "/services/verify/000000000000")
check("unknown code invalid", s == 200 and v["valid"] is False, v)

# Rejection needs a reason
s, noc = call("POST", "/services/requests", tok["student"], {"doc_type": "noc", "purpose": "Internship",
              "details": {"organization": "Acme Robotics", "location": "Hyderabad", "from_date": "2026-11-01", "to_date": "2026-12-15"}})
check("create internship NOC", s == 200 and noc["location"] == "cse", noc)
s, d = call("POST", f"/services/requests/{noc['id']}/reject", tok["mentor"], {"remarks": "no"})
check("reject without real reason -> 422", s == 422, d)
s, d = call("POST", f"/services/requests/{noc['id']}/reject", tok["mentor"], {"remarks": "Please attach the offer letter first"})
check("mentor rejects with reason", s == 200 and d["status"] == "rejected" and d["steps"][0]["remarks"], d)
s, d = call("POST", f"/services/requests/{noc['id']}/approve", tok["class_incharge"], {})
check("no approvals after rejection -> 403", s == 403, d)

# Cancel
s, c = call("POST", "/services/requests", tok["student"], {"doc_type": "noc", "purpose": "Passport", "details": {"organization": "Regional Passport Office"}})
check("create passport NOC", s == 200, c)
s, d = call("POST", f"/services/requests/{c['id']}/cancel", tok["student"])
check("student cancels", s == 200 and d["status"] == "cancelled", d)
s, d = call("POST", f"/services/requests/{c['id']}/cancel", tok["student"])
check("cancel twice -> 400", s == 400, d)

s, mine = call("GET", "/services/requests/mine", tok["student"])
check("my requests lists all 3", s == 200 and {r["id"] for r in mine} >= {rid, noc["id"], c["id"]})
s, hist = call("GET", "/services/approvals/history", tok["mentor"])
check("mentor history", s == 200 and {r["id"] for r in hist} >= {rid, noc["id"]})
s, d = call("GET", "/services/admin/assignments", tok["hod"])
check("admin endpoints need admin -> 403", s == 403, d)
s, d = call("GET", f"/services/requests/{rid}", tok["principal"])
check("approver can view request", s == 200)

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
