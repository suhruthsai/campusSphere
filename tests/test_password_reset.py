"""Forgot password: a 6-digit code by email, then a new password with it.

    python tests/test_password_reset.py <db> <.env>

Needs the backend in development with EMAIL_PROVIDER=console (the default), so codes are made but nothing is
mailed. The emailed code can't be read back, so the test stores the keyed hash of a code it knows in its place
(the same hash the server makes with SECRET_KEY from .env). Uses a throwaway account and removes it afterwards."""
import hashlib
import hmac
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
db_path, env = sys.argv[1], Path(sys.argv[2])
env_vars = dict(l.split("=", 1) for l in env.read_text(encoding="utf-8").splitlines() if "=" in l and not l.startswith("#"))
admin_pw, secret = env_vars["ADMIN_PASSWORD"].strip(), env_vars.get("SECRET_KEY", "").strip()
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
    print(("PASS " if cond else "FAIL ") + name + (f"  [{str(info)[:300]}]" if info and not cond else ""))
    if not cond:
        failures.append(name)


if not secret:
    sys.exit("SECRET_KEY must be set in .env: the server's reset codes are keyed with it")

con = sqlite3.connect(db_path)
admin = call("POST", "/auth/login", body={"email": "admin@suhruth.edu", "password": admin_pw})[1]["access_token"]
tag = uuid.uuid4().hex[:6]
email, temp_pw, new_pw = f"reset.test.{tag}@example.com", f"Temp-{tag}-pass", f"Mine-{tag}-pass"
s, u = call("POST", "/auth/register", admin, {"name": "Reset Test", "email": email, "password": temp_pw, "role": "student", "department": "IT"})
uid = u["id"]


def plant(code):
    """Swap the newest open code for one we know (the real one went to the server log, not to us)."""
    row = con.execute("SELECT id FROM password_resets WHERE user_id = ? AND used_at IS NULL ORDER BY id DESC", (uid,)).fetchone()
    if row:
        h = hmac.new(secret.encode(), f"{uid}:{code}".encode(), hashlib.sha256).hexdigest()
        con.execute("UPDATE password_resets SET code_hash = ? WHERE id = ?", (h, row[0]))
        con.commit()
    return row


try:
    old = call("POST", "/auth/login", body={"email": email, "password": temp_pw})[1]["access_token"]

    # Asking for a code: the same answer whether or not the account exists
    s1, known = call("POST", "/auth/forgot-password", body={"login": email})
    s2, unknown = call("POST", "/auth/forgot-password", body={"login": f"nobody.{tag}@example.com"})
    check("asking for a code -> 200, by email", s1 == 200 and known.get("delivery") == "email", known)
    check("unknown account gets the very same answer", s2 == 200 and unknown == known, unknown)
    check("a code is stored for the account (hashed, 10 minutes)", con.execute(
        "SELECT COUNT(*) FROM password_resets WHERE user_id = ? AND used_at IS NULL AND code_hash NOT GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]'", (uid,)).fetchone()[0] == 1)
    check("malformed code refused -> 422", call("POST", "/auth/reset-password", body={"login": email, "code": "12ab", "new_password": new_pw})[0] == 422)

    plant("246810")
    s, d = call("POST", "/auth/reset-password", body={"login": email, "code": "135791", "new_password": new_pw})
    check("wrong code -> 400", s == 400, d)
    check("a wrong guess is counted", con.execute(
        "SELECT attempts FROM password_resets WHERE user_id = ? ORDER BY id DESC", (uid,)).fetchone()[0] == 1)
    check("too-short new password -> 422", call("POST", "/auth/reset-password", body={"login": email, "code": "246810", "new_password": "short"})[0] == 422)
    s, d = call("POST", "/auth/reset-password", body={"login": email, "code": "246810", "new_password": new_pw})
    check("right code -> password changed", s == 200, d)
    check("the code works only once -> 400", call("POST", "/auth/reset-password", body={"login": email, "code": "246810", "new_password": new_pw + "x"})[0] == 400)
    check("logins from before the reset are signed out -> 401", call("GET", "/auth/me", old)[0] == 401)
    check("the temporary password no longer works", call("POST", "/auth/login", body={"email": email, "password": temp_pw})[0] == 401)
    s, d = call("POST", "/auth/login", body={"email": email, "password": new_pw})
    fresh = d.get("access_token") if s == 200 else None
    s, me = call("GET", "/auth/me", fresh)
    check("signs in with the new password, no change asked for", s == 200 and me.get("must_change_password") is False, me)

    # Five wrong guesses retire a code; a newer code replaces the older one
    call("POST", "/auth/forgot-password", body={"login": email})
    plant("112233")
    for _ in range(5):
        call("POST", "/auth/reset-password", body={"login": email, "code": "999999", "new_password": new_pw + "x"})
    check("after 5 wrong guesses even the right code is refused", call(
        "POST", "/auth/reset-password", body={"login": email, "code": "112233", "new_password": new_pw + "x"})[0] == 400)
    check("only the newest code is open", con.execute(
        "SELECT COUNT(*) FROM password_resets WHERE user_id = ? AND used_at IS NULL", (uid,)).fetchone()[0] == 0)

    # An inactive account gets no code (but the same answer)
    call("PATCH", f"/auth/users/{uid}/status?new_status=inactive", admin)
    before = con.execute("SELECT COUNT(*) FROM password_resets WHERE user_id = ?", (uid,)).fetchone()[0]
    s, d = call("POST", "/auth/forgot-password", body={"login": email})
    check("inactive account: same answer, no code made", s == 200 and d == known and
          con.execute("SELECT COUNT(*) FROM password_resets WHERE user_id = ?", (uid,)).fetchone()[0] == before, d)
    check("the per-account limit stops a 4th request in an hour -> 429",
          call("POST", "/auth/forgot-password", body={"login": email})[0] == 429)
finally:
    con.execute("DELETE FROM password_resets WHERE user_id = ?", (uid,))
    con.execute("DELETE FROM sign_in_events WHERE user_id = ?", (uid,))
    con.execute("DELETE FROM users WHERE id = ?", (uid,))
    con.commit()
    print(f"throwaway account removed: {con.execute('SELECT COUNT(*) FROM users WHERE id = ?', (uid,)).fetchone()[0] == 0}")
    con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
