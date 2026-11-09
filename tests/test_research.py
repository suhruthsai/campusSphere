"""Faculty & research: service records, a teacher reporting their own items with evidence, HOD / IQAC verification
(evidence first), who may do what, the yearly NBA / NAAC figures, and department activities.

    python tests/test_research.py <db> <.env>

Creates a temporary IT teacher (faculty list entry, account and service record), items and activities in
2030-31, and removes them all afterwards."""
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
admin_pw = next(l.split("=", 1)[1].strip() for l in env.read_text(encoding="utf-8").splitlines() if l.startswith("ADMIN_PASSWORD="))
failures = []
YEAR = "2030-31"


def call(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def upload(token, item_id, filename, content):
    boundary = uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            "Content-Type: application/octet-stream\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{BASE}/research/items/{item_id}/evidence", method="POST", data=body,
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


def first_login(email, pw):
    """Sign in a freshly made account and choose a password, as its owner must before the API serves them."""
    token = login(email, pw)
    call("POST", "/auth/change-password", token, body={"current_password": pw, "new_password": pw + "-own"})
    return token


con = sqlite3.connect(db_path)
admin = login("admin@suhruth.edu", admin_pw)
tag = uuid.uuid4().hex[:6]
prof_id, email, pw = f"TEST_{tag}", f"research.test.{tag}@example.com", f"Rs-{tag}-pass"
uid, rec_id, other_rec, acts = None, None, None, []
con.execute("INSERT INTO faculty_profiles (id, name, department, email, is_active) VALUES (?, ?, 'IT', ?, 1)", (prof_id, f"Test Teacher {tag}", email))
con.commit()
try:
    s, u = call("POST", "/auth/register", admin, {"name": f"Test Teacher {tag}", "email": email, "password": pw, "role": "faculty", "department": "IT"})
    uid = u["id"]
    teacher = first_login(email, pw)
    check("teacher without a service record is told so", call("GET", "/research/mine", teacher)[1]["record"] is None)

    base = {"profile_id": prof_id, "name": f"Test Teacher {tag}", "department": "IT", "designation": "Assistant Professor",
            "qualification": "M.Tech", "joined_on": "2029-07-01", "prior_experience": 2}
    check("leaving before joining -> 422", call("PUT", "/research/faculty", admin, {**base, "left_on": "2028-01-01"})[0] == 422)
    check("PhD without its year -> 422", call("PUT", "/research/faculty", admin, {**base, "qualification": "PhD"})[0] == 422)
    s, r = call("PUT", "/research/faculty", admin, base)
    rec_id = r.get("id")
    check("service record saved (admin)", s == 200 and rec_id, r)
    check("teacher can't edit service records -> 403", call("PUT", "/research/faculty", teacher, {**base, "id": rec_id})[0] == 403)
    s, m = call("GET", "/research/mine", teacher)
    check("teacher sees their own record", s == 200 and m["record"]["id"] == rec_id, m)

    check("journal without indexing -> 422", call("POST", "/research/items", teacher, {"kind": "journal", "title": "Test paper", "year": YEAR})[0] == 422)
    check("project without amount -> 422", call("POST", "/research/items", teacher, {"kind": "project", "title": "Test project", "year": YEAR})[0] == 422)
    s, j = call("POST", "/research/items", teacher, {"kind": "journal", "title": f"Test paper {tag}", "year": YEAR, "indexing": "scopus", "status": "published"})
    check("teacher reports a journal paper", s == 200 and not j["verified"], j)
    s, p = call("POST", "/research/items", teacher, {"kind": "project", "title": f"Test project {tag}", "year": YEAR, "amount_lakh": 12.5, "venue": "AICTE"})
    other_rec = con.execute("SELECT id FROM faculty_records WHERE department = 'IT' AND id != ? LIMIT 1", (rec_id,)).fetchone()
    if other_rec:
        check("teacher can't add to someone else's record -> 403",
              call("POST", "/research/items", teacher, {"faculty_id": other_rec[0], "kind": "award", "title": "Not mine", "year": YEAR})[0] == 403)
    check("teacher can't list the department's items -> 403", call("GET", "/research/items?programme=IT", teacher)[0] == 403)
    check("teacher can't verify -> 403", call("POST", f"/research/items/{j['id']}/verify", teacher, {"verified": True})[0] == 403)
    check("no verifying without evidence -> 400", call("POST", f"/research/items/{j['id']}/verify", admin, {"verified": True})[0] == 400)
    check("an .exe isn't evidence -> 422", upload(teacher, j["id"], "x.exe", b"MZ nope")[0] == 422)
    s, e = upload(teacher, j["id"], "first-page.pdf", b"%PDF-1.4\n%%EOF\n")
    check("teacher attaches evidence", s == 200 and e["has_evidence"], e)

    before = call("GET", "/research/summary?programme=IT", admin)[1]
    check("summary covers six years", len(before["years"]) == 6)
    s, v = call("POST", f"/research/items/{j['id']}/verify", admin, {"verified": True})
    check("HOD / IQAC verifies with evidence", s == 200 and v["verified"], v)
    check("verified item can't be deleted by the teacher -> 409", call("DELETE", f"/research/items/{j['id']}", teacher)[0] == 409)
    check("verified item frozen for new evidence -> 409", upload(teacher, j["id"], "again.pdf", b"%PDF-1.4\n%%EOF\n")[0] == 409)
    check("teacher deletes an unverified item", call("DELETE", f"/research/items/{p['id']}", teacher)[0] == 200)

    s, i = call("GET", f"/research/items?programme=IT&year={YEAR}&verified=true", admin)
    check("item listed as verified", s == 200 and any(x["id"] == j["id"] for x in i["items"]))

    s, a = call("POST", "/research/activities", admin, {"kind": "mou", "title": "MoU test", "year": YEAR})
    check("MoU without a partner -> 422", s == 422)
    s, a = call("POST", "/research/activities", admin, {"kind": "extension", "department": "IT", "title": f"Test camp {tag}", "year": YEAR, "participants": 50})
    acts.append(a.get("id"))
    check("extension programme recorded", s == 200, a)
    check("teacher can't record activities -> 403", call("POST", "/research/activities", teacher,
                                                         {"kind": "extension", "department": "IT", "title": "Teacher camp", "year": YEAR})[0] == 403)
finally:
    for a in acts:
        if a:
            call("DELETE", f"/research/activities/{a}", admin)
    if rec_id:
        for (fname,) in con.execute("SELECT evidence FROM research_items WHERE faculty_id = ?", (rec_id,)).fetchall():
            if fname:
                (Path(db_path).resolve().parent / "private_uploads" / "accreditation" / fname).unlink(missing_ok=True)
        con.execute("DELETE FROM research_items WHERE faculty_id = ?", (rec_id,))
        con.execute("DELETE FROM faculty_records WHERE id = ?", (rec_id,))
        con.commit()
    if uid:
        call("DELETE", f"/auth/users/{uid}", admin)
    con.execute("DELETE FROM faculty_profiles WHERE id = ?", (prof_id,))
    con.commit()
    print(f"temporary teacher, items and activities removed: {con.execute('SELECT COUNT(*) FROM faculty_profiles WHERE id = ?', (prof_id,)).fetchone()[0] == 0}")
    con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
