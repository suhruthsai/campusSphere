"""Call every GET endpoint in the OpenAPI spec as admin / student / faculty / staff; report 5xx and errors.
Path parameters are filled from list endpoints where possible (first id found)."""
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = __import__("os").environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/")
creds_file, env_file = Path(sys.argv[1]), Path(sys.argv[2])
lines = creds_file.read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
admin_pw = next(l.split("=", 1)[1].strip() for l in env_file.read_text(encoding="utf-8").splitlines() if l.startswith("ADMIN_PASSWORD="))


def req(method, path, token=None, body=None):
    r = urllib.request.Request(ROOT + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                               headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    t0 = time.time()
    try:
        with urllib.request.urlopen(r, timeout=60) as x:
            data = x.read()
            ctype = x.headers.get("content-type", "")
            return x.status, (json.loads(data) if "json" in ctype and data else data[:80]), time.time() - t0
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw), time.time() - t0
        except Exception:
            return e.code, raw[:300], time.time() - t0
    except Exception as e:
        return 0, repr(e), time.time() - t0


def login(email, pw):
    s, d, _ = req("POST", "/api/v1/auth/login", body={"email": email, "password": pw})
    assert s == 200, (email, s, d)
    return d["access_token"]


tokens = {"admin": login("admin@suhruth.edu", admin_pw), "student": login(emails["student"], demo_pw),
          "faculty": login(emails["hod"], demo_pw), "staff": login(emails["office"], demo_pw)}
spec = req("GET", "/api/v1/openapi.json")[1]

# Collect sample ids from list endpoints for filling {params}
samples = {}
def harvest(obj, prefix=""):
    if isinstance(obj, list) and obj and isinstance(obj[0], dict):
        for k, v in obj[0].items():
            if isinstance(v, (str, int)) and (k == "id" or k.endswith("_id") or k in ("code", "verify_code", "room_id", "doc_type")):
                samples.setdefault(k, v)
    elif isinstance(obj, dict):
        for v in obj.values():
            if isinstance(v, list):
                harvest(v)

gets = [(p, op) for p, ops in spec["paths"].items() for m, op in ops.items() if m == "get"]
plain = [p for p, _ in gets if "{" not in p]
for p in plain:
    s, d, _ = req("GET", p, tokens["admin"])
    if s == 200:
        harvest(d)

PARAM_GUESS = {
    "building_id": ["cse", "lib", "1"], "room_id": None, "req_id": "id", "request_id": "id", "code": "verify_code",
    "user_id": "user_id", "admission_id": "id", "app_id": "id", "doc_id": "id", "payment_id": "id", "item_id": "id",
}

problems, slow, counts = [], [], {}
for path, op in gets:
    params = re.findall(r"{(\w+)}", path)
    url = path
    skip = False
    for prm in params:
        val = samples.get(prm) or samples.get("id")
        if prm == "building_id":
            val = "cse"
        if prm == "code":
            val = samples.get("verify_code", "XXXX")
        if val is None:
            skip = True
            break
        url = url.replace("{" + prm + "}", str(val))
    if skip:
        counts["skipped"] = counts.get("skipped", 0) + 1
        continue
    for role, tok in tokens.items():
        s, d, dt = req("GET", url, tok)
        counts[s] = counts.get(s, 0) + 1
        if s >= 500 or s == 0:
            problems.append((role, url, s, str(d)[:300]))
        if dt > 5:
            slow.append((role, url, round(dt, 1)))

print("status counts:", counts)
print(f"\n{len(problems)} server errors:")
for p in problems:
    print("  ", p)
print(f"\nslow (>5s): {slow}")
sys.exit(1 if problems else 0)
