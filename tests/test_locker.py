"""CampusLocker: a person's own documents, expiring share links, the access log, and the Admin Office adding official
files. Uses the seeded demo accounts; removes every file and row it creates.
Usage: python tests/test_locker.py <campussphere.db> <demo_accounts.local.txt>"""
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta
from pathlib import Path

db_path, creds = sys.argv[1], Path(sys.argv[2])
BASE = os.environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
ROOT = Path(__file__).resolve().parents[1]
LOCKER = Path(os.getenv("PRIVATE_UPLOADS_DIR", ROOT / "private_uploads")) / "locker"
lines = creds.read_text(encoding="utf-8").splitlines()
pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
failures = []
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n" + b"locker-test"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 40


def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info and not cond else ""))
    if not cond:
        failures.append(name)


def call(method, path, token=None, body=None, form=None, files=None, raw=False):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    data = None
    if files is not None:
        boundary = uuid.uuid4().hex
        parts = []
        for k, v in (form or {}).items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        for k, (fname, content) in files.items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{fname}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + content + b"\r\n")
        data = b"".join(parts) + f"--{boundary}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            payload = r.read()
            return r.status, (payload if raw else json.loads(payload or b"null"))
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            return e.code, json.loads(payload or b"null")
        except ValueError:
            return e.code, payload


tok = {}
for k in ("student", "mentor", "office"):
    s, d = call("POST", "/auth/login", body={"email": emails[k], "password": pw})
    check(f"login {k}", s == 200, d)
    tok[k] = d["access_token"]

con = sqlite3.connect(db_path)
uid, roll = con.execute("select u.id, p.roll_no from users u join student_profiles p on p.user_id = u.id where u.email = ?", (emails["student"],)).fetchone()
made_files, made_dirs = [], set()

# ── Sign-in is needed ─────────────────────────────────────────────────────────
check("guest cannot open the locker", call("GET", "/locker/")[0] == 401)
check("guest cannot upload", call("POST", "/locker/files", form={"title": "x"}, files={"file": ("a.pdf", PDF)})[0] == 401)

# ── My locker: list, upload, rules ───────────────────────────────────────────
s, base = call("GET", "/locker/", tok["student"])
check("locker lists items and quota", s == 200 and "items" in base and base["quota"]["limit_bytes"] == 50 * 1024 * 1024, base)
used0 = base["quota"]["used_bytes"]

s, up = call("POST", "/locker/files", tok["student"], form={"title": "Locker test passport", "category": "id_proof"}, files={"file": ("passport.pdf", PDF)})
check("upload a PDF", s == 200 and up["ref"].startswith("file:"), up)
ref = up["ref"]
fid = int(ref.split(":")[1])
s, lk = call("GET", "/locker/", tok["student"])
mine = next((i for i in lk["items"] if i["ref"] == ref), None)
check("uploaded file is listed with its category", mine and mine["category"] == "id_proof" and mine["source"] == "self" and mine["can_delete"] and mine["size_bytes"] == len(PDF), mine)
check("quota counts my own uploads", lk["quota"]["used_bytes"] == used0 + len(PDF))
check("a PNG is accepted", call("POST", "/locker/files", tok["student"], form={"title": "Locker test photo", "category": "other"}, files={"file": ("p.png", PNG)})[0] == 200)
check("a text file is refused", call("POST", "/locker/files", tok["student"], form={"title": "x"}, files={"file": ("a.pdf", b"just text, not a pdf")})[0] == 422)
check("a renamed .exe is refused", call("POST", "/locker/files", tok["student"], form={"title": "x"}, files={"file": ("a.pdf", b"MZ\x90\x00" + b"\x00" * 50)})[0] == 422)
check("a file over 10 MB is refused", call("POST", "/locker/files", tok["student"], form={"title": "big"}, files={"file": ("big.pdf", b"%PDF-1.4" + b"0" * (10 * 1024 * 1024 + 10))})[0] == 422)
check("an unknown category is refused", call("POST", "/locker/files", tok["student"], form={"title": "x", "category": "weapons"}, files={"file": ("a.pdf", PDF)})[0] == 422)

s, got = call("GET", f"/locker/items/{ref}/file", tok["student"], raw=True)
check("owner opens the file, byte for byte", s == 200 and got == PDF)
check("another person cannot open it", call("GET", f"/locker/items/{ref}/file", tok["mentor"])[0] == 404)
check("another person cannot share it", call("POST", f"/locker/items/{ref}/share", tok["mentor"], body={"hours": 24})[0] == 404)
check("another person cannot delete it", call("DELETE", f"/locker/files/{fid}", tok["mentor"])[0] == 404)
check("a made-up ref is refused", call("GET", "/locker/items/file:99999999/file", tok["student"])[0] == 404)
check("a path-like ref is refused", call("GET", "/locker/items/file:..%2F..%2Fx/file", tok["student"])[0] == 404)

# ── Certificates the college issued appear on their own ─────────────────────
issued = [i for i in lk["items"] if i["category"] == "issued"]
approved = con.execute("select count(*) from document_requests where student_id = ? and status = 'approved' and pilot_run is null", (uid,)).fetchone()[0]
check("issued certificates are listed (not pilot data)", len(issued) == approved, (len(issued), approved))
if issued:
    s, pdf = call("GET", f"/locker/items/{issued[0]['ref']}/file", tok["student"], raw=True)
    check("an issued certificate opens as a PDF", s == 200 and pdf.startswith(b"%PDF"))
    check("issued certificates cannot be deleted from the locker", issued[0]["can_delete"] is False)

# ── Share links ─────────────────────────────────────────────────────────────
check("a bad expiry is refused", call("POST", f"/locker/items/{ref}/share", tok["student"], body={"hours": 9999})[0] == 422)
s, sh = call("POST", f"/locker/items/{ref}/share", tok["student"], body={"hours": 24})
check("make a 24-hour link", s == 200 and sh["path"] == f"/shared/{sh['token']}" and len(sh["token"]) >= 30, sh)
token = sh["token"]
s, info = call("GET", f"/locker/shared/{token}")
check("anyone can see what a link holds", s == 200 and info["title"] == "Locker test passport" and info["content_type"] == "application/pdf", info)
check("the link shows who shared it, not private ids", "user_id" not in info and info["shared_by"])
s, got = call("GET", f"/locker/shared/{token}/file", raw=True)
check("anyone with the link opens the file", s == 200 and got == PDF)
s, shares = call("GET", "/locker/shares", tok["student"])
mine_share = next(x for x in shares if x["id"] == sh["id"])
check("the owner sees the link and its views", mine_share["status"] == "active" and mine_share["views"] == 1, mine_share)
s, act = call("GET", "/locker/activity", tok["student"])
check("the access log records upload, share and the link opening", {"uploaded", "shared", "opened_by_link"} <= {a["action"] for a in act if a["title"] == "Locker test passport"}, act[:4])
check("another person cannot see my shares", all(x["id"] != sh["id"] for x in call("GET", "/locker/shares", tok["mentor"])[1]))
check("an unknown link is refused", call("GET", "/locker/shared/" + "a" * 32)[0] == 404)
check("a malformed link is refused", call("GET", "/locker/shared/short")[0] == 404)
check("another person cannot withdraw my link", call("DELETE", f"/locker/shares/{sh['id']}", tok["mentor"])[0] == 404)

for _ in range(4):
    call("POST", f"/locker/items/{ref}/share", tok["student"], body={"hours": 1})
check("at most 5 live links per document", call("POST", f"/locker/items/{ref}/share", tok["student"], body={"hours": 1})[0] == 400)

check("withdrawing a link works", call("DELETE", f"/locker/shares/{sh['id']}", tok["student"])[0] == 200)
check("a withdrawn link stops working", call("GET", f"/locker/shared/{token}")[0] == 410 and call("GET", f"/locker/shared/{token}/file")[0] == 410)

s, sh2 = call("POST", f"/locker/items/{ref}/share", tok["student"], body={"hours": 1})
con.execute("update locker_shares set expires_at = ? where id = ?", ((datetime.utcnow() - timedelta(minutes=1)).isoformat(sep=" "), sh2["id"]))
con.commit()
check("an expired link stops working", call("GET", f"/locker/shared/{sh2['token']}")[0] == 410)

# ── Delete: links die with the file ─────────────────────────────────────────
s, sh3 = call("POST", f"/locker/items/{ref}/share", tok["student"], body={"hours": 24})
path_on_disk = LOCKER / uid / con.execute("select stored_name from locker_files where id = ?", (fid,)).fetchone()[0]
check("the file is on disk", path_on_disk.exists())
check("delete my own file", call("DELETE", f"/locker/files/{fid}", tok["student"])[0] == 200)
check("the file is gone from disk", not path_on_disk.exists())
check("its link stopped working", call("GET", f"/locker/shared/{sh3['token']}")[0] == 410)
check("it left my list", all(i["ref"] != ref for i in call("GET", "/locker/", tok["student"])[1]["items"]))

# ── The Admin Office adds an official document ───────────────────────────────
check("a student cannot use the office route", call("POST", "/locker/office/files", tok["student"], form={"roll_no": roll, "title": "x"}, files={"file": ("a.pdf", PDF)})[0] == 403)
check("a teacher cannot use the office route", call("POST", "/locker/office/files", tok["mentor"], form={"roll_no": roll, "title": "x"}, files={"file": ("a.pdf", PDF)})[0] in (403,))
check("unknown roll number is refused", call("POST", "/locker/office/files", tok["office"], form={"roll_no": "0000-00-000-000", "title": "x"}, files={"file": ("a.pdf", PDF)})[0] == 404)
s, who = call("GET", f"/locker/office/lookup?roll_no={roll}", tok["office"])
check("the office can look a student up by roll number", s == 200 and who["roll_no"] == roll and who["name"], who)
check("a student cannot look anyone up", call("GET", f"/locker/office/lookup?roll_no={roll}", tok["student"])[0] == 403)
s, add = call("POST", "/locker/office/files", tok["office"], form={"roll_no": roll, "title": "Locker test mark memo", "category": "marksheet"}, files={"file": ("memo.pdf", PDF)})
check("the office adds a mark memo", s == 200 and add["student"], add)
cid = int(add["ref"].split(":")[1])
s, lk = call("GET", "/locker/", tok["student"])
college = next((i for i in lk["items"] if i["ref"] == add["ref"]), None)
check("it shows as added by the college and verified", college and college["source"] == "college" and college["verified"] and not college["can_delete"], college)
check("it does not use my own space", lk["quota"]["used_bytes"] == used0 + len(PNG))
check("the student cannot delete a college document", call("DELETE", f"/locker/files/{cid}", tok["student"])[0] == 403)
check("the student can share it", call("POST", f"/locker/items/{add['ref']}/share", tok["student"], body={"hours": 1})[0] == 200)

# ── College documents: what the college website publishes ───────────────────
COLLEGE = ROOT / "private_uploads" / "college"
COLLEGE.mkdir(parents=True, exist_ok=True)
stored = f"locker-test-{uuid.uuid4().hex}.pdf"
(COLLEGE / stored).write_bytes(PDF)
now = datetime.utcnow().isoformat(sep=" ")
rows = [("https://mvsrec.edu.in/images/locker-test/file.pdf", "Locker test syllabus", "syllabus", "file", "site", stored, 1),
        ("https://drive.google.com/file/d/locker-test-drive/view", "Locker test fee structure", "fees", "link", "drive", None, 1),
        ("https://mvsrec.edu.in/images/locker-test/hidden.pdf", "Locker test hidden", "other", "link", "site", None, 0)]
for url, title, cat, kind, host, st, active in rows:
    con.execute("insert into college_documents (url, title, category, kind, host, stored_name, content_type, size_bytes, active, first_seen, last_seen) values (?,?,?,?,?,?,?,?,?,?,?)",
                (url, title, cat, kind, host, st, "application/pdf" if st else None, len(PDF) if st else None, active, now, now))
con.commit()
ids = {r[0]: r[1] for r in con.execute("select title, id from college_documents where title like 'Locker test %'")}

check("guest cannot list college documents", call("GET", "/locker/college")[0] == 401)
s, lib = call("GET", "/locker/college", tok["student"])
by_title = {i["title"]: i for i in lib["items"]} if s == 200 else {}
check("college library lists documents with categories", s == 200 and lib["total"] >= 2 and any(c["key"] == "syllabus" for c in lib["categories"]), lib if s != 200 else "")
check("a stored file opens in the app", by_title.get("Locker test syllabus", {}).get("kind") == "file" and by_title["Locker test syllabus"]["open_url"] is None)
check("a Drive document opens at its source", by_title.get("Locker test fee structure", {}).get("open_url", "").startswith("https://drive.google.com/"))
check("documents the website dropped are hidden", "Locker test hidden" not in by_title)
s, got = call("GET", f"/locker/college/{ids['Locker test syllabus']}/file", tok["student"], raw=True)
check("the stored file is served byte for byte", s == 200 and got == PDF)
check("a link-only document has no file", call("GET", f"/locker/college/{ids['Locker test fee structure']}/file", tok["student"])[0] == 404)
check("an unknown college document is refused", call("GET", "/locker/college/99999999/file", tok["student"])[0] == 404)
check("guest cannot open a college file", call("GET", f"/locker/college/{ids['Locker test syllabus']}/file")[0] == 401)
check("a student cannot start a website refresh", call("POST", "/locker/college/refresh", tok["student"])[0] == 403)
check("a teacher cannot start a website refresh", call("POST", "/locker/college/refresh", tok["mentor"])[0] == 403)
con.execute("delete from college_documents where title like 'Locker test %'")
con.commit()
(COLLEGE / stored).unlink(missing_ok=True)

# ── Clean up everything this test made ──────────────────────────────────────
for fid_, stored in con.execute("select id, stored_name from locker_files where user_id = ? and title like 'Locker test %'", (uid,)).fetchall():
    (LOCKER / uid / stored).unlink(missing_ok=True)
con.execute("delete from locker_shares where user_id = ? and title like 'Locker test %'", (uid,))
con.execute("delete from locker_access where user_id = ? and title like 'Locker test %'", (uid,))
con.execute("delete from locker_files where user_id = ? and title like 'Locker test %'", (uid,))
con.commit()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
