"""Joining document rules (admin-editable, copy sets, certificate issue dates) and the leaving student's "my exit
documents" checklist (originals are returned whether or not dues are pending; there is no fee-refund step).
Uses the seeded demo accounts; every row and file it creates is removed.
Usage: python tests/test_joining_leaving_v4.py <campussphere.db> <demo_accounts.local.txt> <.env>"""
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

db_path, creds, envfile = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
BASE = os.environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
lines = creds.read_text(encoding="utf-8").splitlines()
pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
admin_pw = next(l.split("=", 1)[1].strip() for l in envfile.read_text(encoding="utf-8").splitlines() if l.startswith("ADMIN_PASSWORD="))
admin_email = next((l.split("=", 1)[1].strip() for l in envfile.read_text(encoding="utf-8").splitlines() if l.startswith("ADMIN_EMAIL=")), "admin@suhruth.edu")
failures = []
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nv4-test"
PRIVATE = Path(os.getenv("PRIVATE_UPLOADS_DIR", ROOT / "private_uploads"))


def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if info and not cond else ""))
    if not cond:
        failures.append(name)


def call(method, path, token=None, body=None, form=None, files=None, raw=False):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    data = None
    if files is not None:
        boundary = uuid.uuid4().hex
        parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in (form or {}).items()]
        for k, (fname, content) in files.items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{fname}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + content + b"\r\n")
        data = b"".join(parts) + f"--{boundary}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            payload = r.read()
            return r.status, (payload if raw else json.loads(payload or b"null"))
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            return e.code, json.loads(payload or b"null")
        except ValueError:
            return e.code, payload


def login(email, password):
    s, d = call("POST", "/auth/login", body={"email": email, "password": password})
    check(f"login {email.split('@')[0]}", s == 200, d)
    return d["access_token"]


admin = login(admin_email, admin_pw)
student = login(emails["student"], pw)
joinee = login(emails["joinee"], pw)
office = login(emails["office"], pw)
mentor = login(emails["mentor"], pw)
con = sqlite3.connect(db_path)
sid = con.execute("select id from users where email = ?", (emails["student"],)).fetchone()[0]
jid = con.execute("select id from users where email = ?", (emails["joinee"],)).fetchone()[0]
made_rules, saved_files = [], []

# ── Joining document rules ──────────────────────────────────────────────────
s, cfg = call("GET", "/joining/config", student)
docs = {d["key"]: d for d in cfg["documents"]}
check("the checklist includes the college's bonafide certificates", {"bonafide_6_10", "bonafide_11_12"} <= set(docs), list(docs))
check("photos: 4 to bring", docs["photo"]["copies"] == 4 and docs["photo"]["copy_unit"] == "photos")
check("other documents: 3 photocopy sets", docs["ssc_memo"]["copies"] == 3 and docs["ssc_memo"]["original"] is True)
check("anti-ragging undertakings are off by default", "antiragging_student" not in docs)
check("bonafides can be taken in as originals", {"bonafide_6_10", "bonafide_11_12"} <= {o["key"] for o in cfg["originals"]})
check("a student cannot see the admin rules", call("GET", "/joining/admin/doc-rules", student)[0] == 403)
s, allr = call("GET", "/joining/admin/doc-rules", admin)
by_key = {r["key"]: r for r in allr}
check("admin sees every rule, including switched-off ones", s == 200 and by_key["antiragging_student"]["active"] is False and len(allr) >= 19)


def body_of(r, **over):
    b = {"label": r["label"], "hint": r["hint"], "when": r["when"], "images_only": r["images_only"], "original": r["original"], "copies": r["copies"],
         "copy_unit": r["copy_unit"], "issued_after": r["issued_after"], "active": r["active"], "sort_order": r["sort_order"]}
    b.update(over)
    return b


s, new = call("POST", "/joining/admin/doc-rules", admin, body={"label": "Locker test sports certificate", "when": "always", "copies": 2, "original": True})
made_rules.append(new.get("id"))
check("admin adds a document the college collects", s == 200 and new["key"].startswith("locker_test_sports") and new["copies"] == 2, new)
s, cfg = call("GET", "/joining/config", student)
check("the new document reaches students", any(d["key"] == new["key"] for d in cfg["documents"]))
s, upd = call("PUT", f"/joining/admin/doc-rules/{new['id']}", admin, body=body_of(new, copies=1, hint="bring one"))
check("admin edits copy sets and hint", s == 200 and upd["copies"] == 1 and upd["hint"] == "bring one" and upd["key"] == new["key"], upd)
check("a rule needs a real label", call("PUT", f"/joining/admin/doc-rules/{new['id']}", admin, body=body_of(new, label="x"))[0] == 422)
check("copy sets are capped", call("PUT", f"/joining/admin/doc-rules/{new['id']}", admin, body=body_of(new, copies=50))[0] == 422)
check("a student cannot edit rules", call("PUT", f"/joining/admin/doc-rules/{new['id']}", student, body=body_of(new))[0] == 403)
call("PUT", f"/joining/admin/doc-rules/{new['id']}", admin, body=body_of(new, active=False))
check("switching it off hides it from students", all(d["key"] != new["key"] for d in call("GET", "/joining/config", student)[1]["documents"]))

# Certificate issue dates and copy sets, through a real application (the demo student starts one; removed at the end)
had_adm = con.execute("select count(*) from admissions where user_id = ?", (sid,)).fetchone()[0]
if had_adm == 0:
    call("POST", "/joining/me/start", student)
    inc = by_key["income_cert"]
    oldest = date.today() - timedelta(days=100)
    call("PUT", f"/joining/admin/doc-rules/{inc['id']}", admin, body=body_of(inc, issued_after=oldest.isoformat()))
    up = lambda issued: call("POST", "/joining/me/documents/income_cert", student, form={"issued_on": issued} if issued else {}, files={"file": ("income.pdf", PDF)})  # noqa: E731
    check("a dated certificate needs its date", up(None)[0] == 422)
    s, d = up((oldest - timedelta(days=1)).isoformat())
    check("a certificate older than the rule allows is refused, with the date", s == 422 and oldest.strftime("%d-%m-%Y") in d["detail"], d)
    check("a date in the future is refused", up((date.today() + timedelta(days=3)).isoformat())[0] == 422)
    check("a nonsense date is refused", up("not-a-date")[0] == 422)
    s, adm = up(date.today().isoformat())
    check("a current certificate is accepted", s == 200, adm)
    item = next(i for i in adm["checklist"] if i["key"] == "income_cert") if s == 200 else {}
    check("the checklist shows its issue date and rule", item.get("upload", {}).get("issued_on") == date.today().isoformat() and item.get("needs_issue_date") is True, item)
    doc_id = item["upload"]["id"] if item.get("upload") else None
    if doc_id:
        check("a student cannot record copy sets", call("POST", f"/joining/office/documents/{doc_id}/copies", student, body={"copies_received": 3})[0] == 403)
        s, d = call("POST", f"/joining/office/documents/{doc_id}/copies", office, body={"copies_received": 3})
        got = next((i for i in d["checklist"] if i["key"] == "income_cert"), {}) if s == 200 else {}
        check("the office records 3 photocopy sets", s == 200 and got.get("upload", {}).get("copies_received") == 3, d if s != 200 else got)
        check("more than 10 sets is refused", call("POST", f"/joining/office/documents/{doc_id}/copies", office, body={"copies_received": 11})[0] == 422)
    call("PUT", f"/joining/admin/doc-rules/{inc['id']}", admin, body=body_of(inc))
    check("the rule is back to its original setting", call("GET", "/joining/admin/doc-rules", admin)[1][[r["key"] for r in allr].index("income_cert")]["issued_after"] == inc["issued_after"])
    # remove the throwaway application
    aid = con.execute("select id from admissions where user_id = ?", (sid,)).fetchone()[0]
    for (stored,) in con.execute("select stored_name from admission_documents where admission_id = ?", (aid,)).fetchall():
        (PRIVATE / "admissions" / str(aid) / stored).unlink(missing_ok=True)
    con.execute("delete from admission_documents where admission_id = ?", (aid,))
    con.execute("delete from admissions where id = ?", (aid,))
    con.commit()
else:
    print("SKIP certificate-date and copy-set checks (the demo student already has an application)")

# ── A leaving student: the exit-documents checklist ──────────────────────────
today = date.today()
con.execute("delete from clearance_items where exit_id in (select id from exits where user_id = ?)", (jid,))
con.execute("delete from exits where user_id = ?", (jid,))
con.execute("insert into exits (user_id, reason, leaving_date, status, department, created_at) values (?,?,?,?,?,?)",
            (jid, "Discontinued", today.isoformat(), "in_progress", "CSE", datetime.utcnow().isoformat(sep=" ")))
exit_id = con.execute("select id from exits where user_id = ?", (jid,)).fetchone()[0]
for unit in ("library", "accounts", "department", "transport", "exam_cell", "placement", "sports"):
    con.execute("insert into clearance_items (exit_id, unit, status) values (?,?,?)", (exit_id, unit, "pending"))
held_before = con.execute("select count(*) from original_certificates where user_id = ? and status in ('held','out')", (jid,)).fetchone()[0]
con.commit()

check("there is no refund policy or settlement any more", all(call(m, path, office if m == "GET" else admin, body=None if m == "GET" else {})[0] in (404, 405)
      for m, path in (("GET", "/leaving/policy"), ("GET", "/leaving/me/settlement"), ("GET", "/leaving/office/settlements"), ("PUT", "/leaving/admin/policy"))))
s, ck = call("GET", "/leaving/me/checklist", joinee)
byk = {i["key"]: i for i in ck["items"]}
check("the checklist lists the college's documents for a leaving student", s == 200 and {"no_dues", "no_dues_certificate", "tc", "conduct", "originals"} <= set(byk), list(byk))
check("the checklist has no refund step", "refund" not in byk, list(byk))
check("documents wait for no-dues", byk["tc"]["status"] == "blocked" and byk["no_dues_certificate"]["status"] == "blocked" and byk["no_dues"]["status"] == "in_progress")
check("the checklist has no degree step for someone who left early", "university" not in byk and "provisional" not in byk)

# Original certificates are returned whether or not dues are pending
con.execute("insert into original_certificates (user_id, doc_key, label, status, movements, created_at, updated_at) values (?,?,?,?,?,?,?)",
            (jid, "tc", "Transfer Certificate (TC)", "held", "[]", datetime.utcnow().isoformat(sep=" "), datetime.utcnow().isoformat(sep=" ")))
con.commit()
rid = con.execute("select id from original_certificates where user_id = ? and doc_key = 'tc' and status = 'held' order by id desc", (jid,)).fetchone()[0]
con.execute("update clearance_items set status = 'dues', dues_amount = 5000, remarks = 'Library fine' where exit_id = ? and unit = 'library'", (exit_id,))
con.commit()
s, ck = call("GET", "/leaving/me/checklist", joinee)
orig = next(i for i in ck["items"] if i["key"] == "originals")
check("the checklist says originals are still with the college and are returned regardless of dues", orig["status"] == "todo" and orig["detail"].startswith(f"{held_before + 1} still") and "whether or not dues" in orig["detail"], orig)
s, d = call("POST", f"/joining/office/originals/{rid}/return", office, body={"note": "handed back"})
check("the office returns an original even with dues pending", s == 200 and d["status"] == "returned", d)
after = next(i for i in call("GET", "/leaving/me/checklist", joinee)[1]["items"] if i["key"] == "originals")
check("the checklist counts one fewer original still held", after["detail"].startswith(f"{held_before} still") if held_before else after["status"] == "done", after)

# A student who completed the course
con.execute("update exits set reason = 'Course completed' where id = ?", (exit_id,))
con.commit()
s, ck = call("GET", "/leaving/me/checklist", joinee)
byk = {i["key"]: i for i in ck["items"]}
check("a completed student's checklist adds the provisional certificate, CMM and the university steps", {"provisional", "cmm", "course_completion", "university"} <= set(byk), list(byk))

# ── Clean up ─────────────────────────────────────────────────────────────────
con.execute("delete from clearance_items where exit_id = ?", (exit_id,))
con.execute("delete from exits where id = ?", (exit_id,))
con.execute("delete from original_certificates where id = ?", (rid,))
for rid_ in made_rules:
    if rid_:
        con.execute("delete from joining_doc_rules where id = ?", (rid_,))
con.commit()

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
