"""End-to-end API test for V2 joining, fees and originals (uses a throwaway student, cleaned up after)."""
import json
import secrets
import shutil
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta
from pathlib import Path

BASE = __import__("os").environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
db_path, creds, out_dir, project = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
lines = creds.read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
failures = []

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
FAKE = b"MZ this is not a pdf, just renamed"


def call(method, path, token=None, body=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
            return r.status, (data if raw else json.loads(data or b"null")), r.headers.get("Content-Type")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null"), None


def upload(token, key, filename, content):
    boundary = uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            f"Content-Type: application/octet-stream\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{BASE}/joining/me/documents/{key}", method="POST", data=body,
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


email = f"tmp.joinee.{uuid.uuid4().hex[:6]}@example.com"
pw = secrets.token_urlsafe(12)
s, d, _ = call("POST", "/auth/register", body={"name": "Temp Joinee", "email": email, "password": pw, "role": "student", "department": "CSE"})
check("register temp student", s == 201, d)
user_id = d["id"]
admission_id = None
try:
    stu = login(email, pw)
    office = login(emails["office"], demo_pw)
    other_student = login(emails["student"], demo_pw)

    s, cfg, _ = call("GET", "/joining/config", stu)
    check("config: fee heads & test mode", s == 200 and len(cfg["fee_heads"]) == 4 and cfg["payment_mode"] == "test", cfg)
    bus = next(h for h in cfg["fee_heads"] if h["optional"])

    s, d, _ = call("GET", "/joining/me", stu)
    check("no application yet -> null", s == 200 and d is None, d)
    s, app, _ = call("POST", "/joining/me/start", stu)
    admission_id = app["id"]
    check("start -> draft, details step not done", s == 200 and app["status"] == "draft" and not app["progress"][0]["done"], app)
    s, d, _ = call("POST", "/joining/me/start", office)
    check("staff can't start a joining -> 403", s == 403, d)
    s, d, _ = call("POST", "/joining/me/submit", stu)
    check("submit with missing fields -> 422", s == 422 and "fill in" in d["detail"], d)

    details = {"hall_ticket_no": "2611A12345", "eapcet_rank": 8421, "allotment_no": "TGEAPCET26-P1-004512",
               "counselling_phase": "Phase 1", "branch": "CSE", "category": "BC-B", "tuition_paid_on_portal": 0,
               "fee_reimbursement": True, "other_board": False, "full_name": "TEMP JOINEE", "date_of_birth": "2008-05-14",
               "gender": "female", "father_name": "Temp Father", "mother_name": "Temp Mother", "phone": "+91 98480 12345",
               "address": "Plot 12, Vanasthalipuram, Hyderabad", "ssc_board_year": "BSE Telangana, 2024", "inter_board_year": "TSBIE, 2026"}
    s, d, _ = call("PUT", "/joining/me", stu, {**details, "phone": "12345"})
    check("bad phone -> 422", s == 422, d)
    s, d, _ = call("PUT", "/joining/me", stu, {**details, "branch": "ARCH"})
    check("unknown branch -> 422", s == 422, d)
    s, app, _ = call("PUT", "/joining/me", stu, details)
    check("save details (phone normalised)", s == 200 and app["details"]["phone"] == "9848012345" and not app["missing_fields"], app)
    req_keys = [c["key"] for c in app["checklist"] if c["required"]]
    check("BC-B + reimbursement needs caste & income, not EWS/migration",
          "caste_cert" in req_keys and "income_cert" in req_keys and "ews_cert" not in req_keys and "migration" not in req_keys, req_keys)

    s, d = upload(stu, "ssc_memo", "memo.pdf", FAKE)
    check("renamed non-PDF rejected -> 422", s == 422, d)
    s, d = upload(stu, "photo", "photo.pdf", PDF)
    check("photo must be an image -> 422", s == 422, d)
    s, d = upload(stu, "ssc_memo", "big.pdf", PDF + b"0" * (6 * 1024 * 1024))
    check("over 5 MB -> 422", s == 422, d)
    s, d = upload(stu, "not_a_doc", "x.pdf", PDF)
    check("unknown document -> 404", s == 404, d)
    for key in req_keys:
        s, d = upload(stu, key, f"{key}.{'png' if key == 'photo' else 'pdf'}", PNG if key == "photo" else PDF)
        if s != 200:
            check(f"upload {key}", False, d)
    s, app, _ = call("GET", "/joining/me", stu)
    check("all required uploaded", all(c["upload"] for c in app["checklist"] if c["required"]), app["checklist"])
    s, app, _ = call("POST", "/joining/me/submit", stu)
    check("submit -> submitted", s == 200 and app["status"] == "submitted" and app["progress"][1]["done"], app)
    s, d, _ = call("PUT", "/joining/me", stu, details)
    check("can't edit after submit -> 400", s == 400, d)
    s, d = upload(stu, "aadhaar", "a.pdf", PDF)
    check("can't upload after submit -> 400", s == 400, d)

    s, rows, _ = call("GET", "/joining/office/applications?status=submitted", office)
    check("office list has it", s == 200 and any(r["id"] == admission_id for r in rows), rows)
    s, d, _ = call("GET", "/joining/office/applications", stu)
    check("student can't use office list -> 403", s == 403, d)
    s, full, _ = call("GET", f"/joining/office/applications/{admission_id}", office)
    docs = {c["key"]: c["upload"] for c in full["checklist"] if c["upload"]}
    s, body, ctype = call("GET", f"/joining/documents/{docs['ssc_memo']['id']}/file", office, raw=True)
    check("office opens a document", s == 200 and body.startswith(b"%PDF") and ctype == "application/pdf", (s, ctype))
    s, d, _ = call("GET", f"/joining/documents/{docs['ssc_memo']['id']}/file", other_student, raw=True)
    check("another student can't open it -> 403", s == 403, d)
    on_disk = list((project / "private_uploads" / "admissions" / str(admission_id)).glob("*"))
    check("files stored privately (not in media_uploads)", len(on_disk) == len(docs), len(on_disk))

    s, d, _ = call("POST", f"/joining/office/documents/{docs['caste_cert']['id']}/review", office, {"status": "rejected"})
    check("reject without reason -> 422", s == 422, d)
    s, d, _ = call("POST", f"/joining/office/documents/{docs['caste_cert']['id']}/review", office,
                   {"status": "rejected", "remarks": "Certificate is not legible, upload a clear scan"})
    check("reject caste certificate", s == 200)
    s, d, _ = call("POST", f"/joining/office/applications/{admission_id}/verify", office)
    check("verify with pending/rejected docs -> 422", s == 422, d)
    s, d, _ = call("POST", f"/joining/office/applications/{admission_id}/return", office, {"remarks": "Please re-upload the caste certificate"})
    check("send back -> needs_changes", s == 200 and d["status"] == "needs_changes", d)

    s, app, _ = call("POST", "/joining/me/submit", stu)
    check("resubmit with rejected doc still there -> 422", s == 422, app)
    s, app = upload(stu, "caste_cert", "caste_clear.pdf", PDF)
    caste = next(c["upload"] for c in app["checklist"] if c["key"] == "caste_cert")
    check("re-upload -> pending again", s == 200 and caste["status"] == "pending", caste)
    s, app, _ = call("POST", "/joining/me/submit", stu)
    check("resubmit -> submitted", s == 200 and app["status"] == "submitted", app)

    s, full, _ = call("GET", f"/joining/office/applications/{admission_id}", office)
    for c in full["checklist"]:
        if c["upload"] and c["upload"]["status"] != "accepted":
            call("POST", f"/joining/office/documents/{c['upload']['id']}/review", office, {"status": "accepted"})
    s, d, _ = call("POST", f"/joining/office/applications/{admission_id}/verify", office)
    check("verify -> verified", s == 200 and d["status"] == "verified" and d["progress"][2]["done"], d)

    s, d, _ = call("POST", "/joining/me/payments", stu, {"optional_fee_head_ids": [999]})
    check("unknown optional fee -> 422", s == 422, d)
    s, pay, _ = call("POST", "/joining/me/payments", stu, {"optional_fee_head_ids": [bus["id"]], "bus_boarding_point": "LB Nagar"})
    expected = sum(h["amount"] for h in cfg["fee_heads"])
    check(f"payment total = {expected} incl. bus", s == 200 and pay["amount"] == expected and pay["status"] == "created", pay)
    s, d, _ = call("POST", f"/joining/me/payments/{pay['id']}/test-complete", stu, {"outcome": "failure"})
    check("test payment failure -> failed", s == 200 and d["status"] == "failed", d)
    s, pay2, _ = call("POST", "/joining/me/payments", stu, {"optional_fee_head_ids": []})
    check("retry without bus", s == 200 and pay2["amount"] == expected - bus["amount"], pay2)
    s, d, _ = call("POST", f"/joining/me/payments/{pay2['id']}/test-complete", other_student, {"outcome": "success"})
    check("someone else can't complete it -> 404", s == 404, d)
    s, d, _ = call("POST", f"/joining/me/payments/{pay2['id']}/test-complete", stu, {"outcome": "success"})
    check("test payment success -> paid with receipt", s == 200 and d["status"] == "paid" and d["receipt_no"].startswith("MVSR/RCPT/"), d)
    s, d, _ = call("POST", "/joining/me/payments", stu, {})
    check("pay again -> 409", s == 409, d)
    s, pdf, ctype = call("GET", f"/joining/payments/{pay2['id']}/receipt", stu, raw=True)
    check("receipt PDF", s == 200 and pdf[:4] == b"%PDF", s)
    (out_dir / "receipt_test.pdf").write_bytes(pdf if s == 200 else b"")

    s, d, _ = call("POST", f"/joining/office/applications/{admission_id}/enroll", office, {"roll_no": "1602-26-733-099", "section": "B"})
    check("enrol before TC -> 400", s == 400 and "TC" in d["detail"], d)
    s, d, _ = call("POST", f"/joining/office/applications/{admission_id}/originals", office, {"doc_keys": ["tc", "fake"]})
    check("unknown original -> 422", s == 422, d)
    s, d, _ = call("POST", f"/joining/office/applications/{admission_id}/originals", office, {"doc_keys": ["tc", "ssc_memo"]})
    check("receive TC + SSC -> ack", s == 200 and d["ack_no"].startswith("MVSR/ACK/"), d)
    ack = d["ack_no"]
    s, d, _ = call("POST", f"/joining/office/applications/{admission_id}/originals", office, {"doc_keys": ["tc"]})
    check("TC again -> 409", s == 409, d)
    s, pdf, _ = call("GET", f"/joining/acknowledgement?ack_no={urllib.request.quote(ack)}", stu, raw=True)
    check("acknowledgement PDF", s == 200 and pdf[:4] == b"%PDF", s)
    (out_dir / "ack_test.pdf").write_bytes(pdf if s == 200 else b"")

    _, people, _ = call("GET", "/joining/config", stu)  # (no approver list for staff; take mentor id from DB)
    con = sqlite3.connect(db_path)
    mentor_id = con.execute("SELECT id FROM users WHERE email = ?", (emails["mentor"],)).fetchone()[0]
    con.close()
    s, d, _ = call("POST", f"/joining/office/applications/{admission_id}/enroll", office, {"roll_no": "1602-23-733-001", "section": "B"})
    check("roll no. clash -> 409", s == 409, d)
    s, d, _ = call("POST", f"/joining/office/applications/{admission_id}/enroll", office,
                   {"roll_no": "1602-26-733-099", "section": "b", "mentor_id": mentor_id})
    check("enrol -> enrolled, all steps done", s == 200 and d["status"] == "enrolled" and all(p["done"] for p in d["progress"]), d)
    s, prof, _ = call("GET", "/services/me/profile", stu)
    check("certificate profile ready (year I, sec B, mentor)",
          s == 200 and prof["complete"] and prof["year"] == 1 and prof["section"] == "B" and prof["mentor_name"] and prof["parent_name"] == "Temp Father", prof)

    s, reg, _ = call("GET", f"/joining/office/originals?q={urllib.request.quote('1602-26-733-099')}", office)
    tc = next((r for r in reg if r["doc_key"] == "tc"), None)
    check("register lists the TC by roll no.", s == 200 and tc and tc["status"] == "held", reg)
    s, d, _ = call("POST", f"/joining/office/originals/{tc['id']}/lend", office, {"due_back": (date.today() - timedelta(days=1)).isoformat()})
    check("lend with past date -> 422", s == 422, d)
    s, d, _ = call("POST", f"/joining/office/originals/{tc['id']}/lend", office,
                   {"due_back": (date.today() + timedelta(days=7)).isoformat(), "note": "Passport verification"})
    check("lend -> out", s == 200 and d["status"] == "out" and d["due_back"], d)
    s, d, _ = call("POST", f"/joining/office/originals/{tc['id']}/lend", office, {"due_back": (date.today() + timedelta(days=7)).isoformat()})
    check("lend twice -> 400", s == 400, d)
    s, d, _ = call("POST", f"/joining/office/originals/{tc['id']}/redeposit", office, {"note": "Brought back"})
    check("redeposit -> held", s == 200 and d["status"] == "held" and d["due_back"] is None, d)
    s, d, _ = call("POST", f"/joining/office/originals/{tc['id']}/return", office, {"note": "Course completed"})
    check("final return -> returned, 4 movements", s == 200 and d["status"] == "returned" and len(d["movements"]) == 4, d)
    s, d, _ = call("POST", f"/joining/office/originals/{tc['id']}/return", office, {})
    check("return twice -> 400", s == 400, d)
    s, d, _ = call("GET", "/joining/admin/fee-heads", office)
    check("fee settings need admin -> 403", s == 403, d)
finally:
    con = sqlite3.connect(db_path)
    if admission_id:
        con.execute("DELETE FROM admission_documents WHERE admission_id = ?", (admission_id,))
        con.execute("DELETE FROM original_certificates WHERE admission_id = ?", (admission_id,))
        con.execute("DELETE FROM payments WHERE admission_id = ?", (admission_id,))
        con.execute("DELETE FROM admissions WHERE id = ?", (admission_id,))
        shutil.rmtree(project / "private_uploads" / "admissions" / str(admission_id), ignore_errors=True)
    con.execute("DELETE FROM student_profiles WHERE user_id = ?", (user_id,))
    con.execute("DELETE FROM users WHERE id = ?", (user_id,))
    con.commit()
    print("cleanup: temp student removed =", con.execute("SELECT COUNT(*) FROM users WHERE id = ?", (user_id,)).fetchone()[0] == 0)
    con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
