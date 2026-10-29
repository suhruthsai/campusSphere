"""Test Mitra Agent without the AI: the Morning Brief, which tools each kind of user gets, the checks behind
prepare_document_request, and the Confirm step (only the right student, only a real unexpired proposal, never
usable as a login). Proposals are minted with the same code Mitra uses. Cleans up what it creates."""
import json
import sqlite3
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from jose import jwt  # noqa: E402

from backend.app.ai import agent  # noqa: E402
from backend.app.api.v1.endpoints import guide  # noqa: E402
from backend.app.core.config import settings  # noqa: E402

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


def proposal(uid, req, minutes=15):
    return jwt.encode({"typ": agent.PROPOSAL_TYPE, "uid": uid, "req": req,
                       "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ── Which tools each kind of user gets ────────────────────────────────────────────
names = lambda cur: {t["function"]["name"] for t in guide._tools(cur)}
check("visitors get no agent tools", not (names(None) & agent.NAMES))
check("faculty get no agent tools", not (names({"role": "faculty", "sub": "x", "name": "F"}) & agent.NAMES))
check("students get the agent tools", agent.NAMES <= names({"role": "student", "sub": "x", "name": "S"}))
check("only students hear the agent instructions",
      "ACT for this student" in guide._prompt({"role": "student", "sub": "x", "name": "S"}, "en-IN", None)
      and "ACT for this student" not in guide._prompt(None, "en-IN", None))

opts = agent.document_options(None)["documents"]
check("document_options lists every document", {o["doc_type"] for o in opts} == set(agent.DOC_TYPES), [o["doc_type"] for o in opts])
noc_opt = agent.document_options("noc")["documents"]
check("document_options for one document", len(noc_opt) == 1 and any(d["key"] == "organization" and d["required"] for d in noc_opt[0]["details"]))
check("agent tools never crash the chat", agent.run(None, {"sub": "x", "role": "student"}, "my_requests", {}, []).startswith("Error"))

tok = {}
for key in ("student", "principal", "mentor"):
    s, d = call("POST", "/auth/login", body={"email": emails[key], "password": demo_pw})
    check(f"login {key}", s == 200, d)
    tok[key] = d.get("access_token")
s, me = call("GET", "/auth/me", tok["student"])
student_id = me["id"]

# ── Morning Brief ──────────────────────────────────────────────────────────────────
check("brief needs sign-in", call("GET", "/ai/brief")[0] == 401)
s, b = call("GET", "/ai/brief", tok["student"])
check("student brief", s == 200 and b["greeting"].startswith("Good ") and isinstance(b["items"], list) and b["speech"], b)
check("brief items are short and typed", all(i["kind"] and i["text"] and i["tone"] in ("info", "good", "warn", "bad", "muted")
                                              for i in b["items"]) and len(b["items"]) <= 8, b["items"])
check("brief speech is the greeting plus every line", b["speech"].startswith(b["greeting"])
      and all(i["text"] in b["speech"] for i in b["items"]))
s, pb = call("GET", "/ai/brief", tok["principal"])
check("principal brief", s == 200, pb)
con = sqlite3.connect(db_path)
principal_id = call("GET", "/auth/me", tok["principal"])[1]["id"]
waiting = 0
for step, steps in con.execute("SELECT current_step, steps FROM document_requests WHERE status = 'in_review'"):
    steps = json.loads(steps)
    waiting += step < len(steps) and steps[step]["approver_id"] == principal_id
has_line = any(i["kind"] == "approvals" for i in pb["items"])
check("principal sees waiting approvals exactly when some are waiting", has_line == bool(waiting), (has_line, waiting))

# ── Confirm ────────────────────────────────────────────────────────────────────────
noc = {"doc_type": "noc", "purpose": "Hackathon / competition",
       "details": {"organization": "Agent Test Hackathon", "from_date": "2026-12-08", "to_date": "2026-12-09"}}
good = proposal(student_id, noc)
check("visitor can't confirm", call("POST", "/ai/guide/confirm", None, {"token": good})[0] == 401)
check("a proposal is not a login token", call("GET", "/auth/me", good)[0] == 401)
check("another user can't confirm it", call("POST", "/ai/guide/confirm", tok["mentor"], {"token": good})[0] == 403)
check("expired proposal refused", call("POST", "/ai/guide/confirm", tok["student"], {"token": proposal(student_id, noc, -1)})[0] == 400)
forged = jwt.encode({"typ": agent.PROPOSAL_TYPE, "uid": student_id, "req": noc,
                     "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, "not-the-secret", algorithm=settings.ALGORITHM)
check("forged proposal refused", call("POST", "/ai/guide/confirm", tok["student"], {"token": forged})[0] == 400)
wrong_type = jwt.encode({"typ": "something_else", "uid": student_id, "req": noc,
                         "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
check("token of another type refused", call("POST", "/ai/guide/confirm", tok["student"], {"token": wrong_type})[0] == 403)
bad_req = proposal(student_id, {"doc_type": "noc", "purpose": "Hackathon / competition", "details": {}})
s, d = call("POST", "/ai/guide/confirm", tok["student"], {"token": bad_req})
check("confirm re-runs the Services checks (missing organisation -> 422)", s == 422, (s, d))

created = None
try:
    s, req = call("POST", "/ai/guide/confirm", tok["student"], {"token": good})
    check("student confirms -> request created", s == 200 and req["status"] == "in_review" and req["ref_no"].startswith("MVSR/NOC/"), (s, req))
    created = req.get("id")
    check("it starts at the first desk", req.get("current_role") == "mentor", req.get("current_role"))
    s, d = call("POST", "/ai/guide/confirm", tok["student"], {"token": good})
    check("confirming twice -> 409, no duplicate", s == 409, (s, d))
    s, mine = call("GET", "/services/requests/mine", tok["student"])
    check("it shows on the Services page", any(r["id"] == created for r in mine))
    s, b2 = call("GET", "/ai/brief", tok["student"])
    check("the brief now mentions it", any("No Objection Certificate" in i["text"] for i in b2["items"]), b2["items"])
finally:
    if created:
        con.execute("DELETE FROM document_requests WHERE id = ?", (created,))
        con.commit()
    con.close()

print(f"\n{len(failures)} failure(s)" if failures else "\nAll Mitra Agent checks passed")
sys.exit(1 if failures else 0)
