"""End-to-end API test for V3 (leaving): no-dues clearance, leaving documents, Exam Cell uploads."""
import json
import secrets
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
BASE = __import__("os").environ.get("CAMPUS_API", "http://127.0.0.1:8000").rstrip("/") + "/api/v1"
db_path, creds, out_dir, project = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
lines = creds.read_text(encoding="utf-8").splitlines()
demo_pw = next(l.split(":", 1)[1].strip() for l in lines if l.startswith("password:"))
emails = {l.split()[0]: l.split()[1] for l in lines if l and not l.startswith(("#", "password")) and len(l.split()) == 2}
failures = []
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def call(method, path, token=None, body=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
            return r.status, (data if raw else json.loads(data or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def upload(token, path, content, filename="doc.pdf"):
    boundary = uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            f"Content-Type: application/pdf\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(BASE + path, method="POST", data=body,
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


def approve_all(req_id, roles):
    for role in roles:
        s, d = call("POST", f"/services/requests/{req_id}/approve", T[role], {"remarks": "OK"})
        if s != 200:
            check(f"approve as {role}", False, d)
            return d
    return d


def pay(payment_id, outcome="success"):
    return call("POST", f"/leaving/payments/{payment_id}/test-complete", T["student"], {"outcome": outcome})


email = f"tmp.alumni.{uuid.uuid4().hex[:6]}@example.com"
pw = secrets.token_urlsafe(12)
s, d = call("POST", "/auth/register", body={"name": "Temp Leaver", "email": email, "password": pw, "role": "student", "department": "CSE"})
check("register temp student", s == 201, d)
user_id = d["id"]
try:
    T = {"student": login(email, pw)}
    for k in ("office", "hod", "coe", "principal", "mentor"):
        T[k] = login(emails[k], demo_pw)
    s, d = call("PUT", "/services/me/profile", T["student"], {"roll_no": "1602-22-733-077", "year": 4, "section": "A",
                                                               "parent_name": "Temp Parent", "gender": "male"})
    check("profile set (IV year)", s == 200 and d["complete"], d)

    s, cat = call("GET", "/services/catalog", T["student"])
    by = {c["id"]: c for c in cat}
    check("catalog: TC locked until no-dues", "no-dues" in (by["tc"]["unavailable_reason"] or ""), by["tc"])
    check("catalog: MOI open, fee 200", by["moi"]["unavailable_reason"] is None and by["moi"]["fee"] == 200, by["moi"])
    check("catalog: TC chain HOD -> Principal", [c["role"] for c in by["tc"]["chain"]] == ["hod", "principal"], by["tc"]["chain"])

    # Paid document before leaving: MOI
    s, moi = call("POST", "/services/requests", T["student"], {"doc_type": "moi", "purpose": "IELTS / TOEFL"})
    check("MOI -> awaiting payment ₹200", s == 200 and moi["status"] == "awaiting_payment" and moi["amount"] == 200 and moi["payment_id"], moi)
    s, d = call("POST", f"/services/requests/{moi['id']}/approve", T["hod"], {})
    check("can't approve before payment -> 403", s == 403, d)
    s, d = pay(moi["payment_id"], "failure")
    check("payment failure", s == 200 and d["status"] == "failed", d)
    s, d = pay(moi["payment_id"], "success")
    check("retry -> paid", s == 200 and d["status"] == "paid" and d["receipt_no"], d)
    s, moi = call("GET", f"/services/requests/{moi['id']}", T["student"])
    check("MOI now with HOD in CSE block", moi["status"] == "in_review" and moi["current_role"] == "hod" and moi["location"] == "cse", moi)
    s, d = call("POST", f"/services/requests/{moi['id']}/cancel", T["student"])
    check("paid request can't be withdrawn -> 400", s == 400, d)
    d = approve_all(moi["id"], ["hod", "principal"])
    check("MOI approved", d.get("status") == "approved", d)
    s, pdf = call("GET", f"/services/requests/{moi['id']}/pdf", T["student"], raw=True)
    check("MOI PDF", s == 200 and pdf[:4] == b"%PDF")
    (out_dir / "moi_test.pdf").write_bytes(pdf if s == 200 else b"")

    s, d = call("POST", "/services/requests", T["student"], {"doc_type": "tc", "purpose": "Higher studies"})
    check("TC before exit -> 400", s == 400, d)

    # Exit & no-dues
    s, d = call("POST", "/leaving/me/start", T["student"], {"reason": "Graduated", "leaving_date": date.today().isoformat()})
    check("bad reason -> 422", s == 422, d)
    s, ex = call("POST", "/leaving/me/start", T["student"], {"reason": "Course completed", "leaving_date": date.today().isoformat()})
    check("exit started, 7 units pending", s == 200 and len(ex["items"]) == 7 and ex["counts"]["pending"] == 7, ex)
    s, d = call("POST", "/leaving/me/start", T["student"], {"reason": "Course completed", "leaving_date": date.today().isoformat()})
    check("start twice -> 409", s == 409, d)
    items = {i["unit"]: i for i in ex["items"]}
    check("department unit placed at CSE block", items["department"]["place"] == "cse", items["department"])

    s, q = call("GET", "/leaving/clearance/queue", T["office"])
    office_units = {i["unit"] for i in q["items"] if i["student"]["email"] == email}
    check("office queue: library, accounts, transport, placement, sports", office_units == {"library", "accounts", "transport", "placement", "sports"}, office_units)
    s, q = call("GET", "/leaving/clearance/queue", T["hod"])
    check("HOD queue: department only", {i["unit"] for i in q["items"] if i["student"]["email"] == email} == {"department"}, q)
    s, d = call("GET", "/leaving/clearance/queue", T["student"])
    check("students can't see queues -> 403", s == 403, d)

    s, d = call("POST", f"/leaving/clearance/items/{items['library']['id']}/dues", T["office"], {"amount": 250, "remarks": "no"})
    check("dues need a real reason -> 422", s == 422, d)
    s, d = call("POST", f"/leaving/clearance/items/{items['library']['id']}/dues", T["office"], {"amount": 250, "remarks": "Book not returned: Data Structures"})
    check("library records ₹250 dues", s == 200 and d["status"] == "dues", d)
    s, d = call("POST", f"/leaving/clearance/items/{items['library']['id']}/clear", T["hod"], {})
    check("HOD can't clear library -> 403", s == 403, d)
    for unit in ("accounts", "transport", "placement", "sports"):
        call("POST", f"/leaving/clearance/items/{items[unit]['id']}/clear", T["office"], {})
    call("POST", f"/leaving/clearance/items/{items['department']['id']}/clear", T["hod"], {"remarks": "Lab equipment returned"})
    s, d = call("POST", f"/leaving/clearance/items/{items['exam_cell']['id']}/clear", T["coe"], {})
    check("CoE clears exam cell", s == 200 and d["exit_status"] == "in_progress", d)
    s, d = call("GET", "/leaving/me/no-dues-certificate", T["student"], raw=True)
    check("no certificate while dues remain -> 400", s == 400, d)

    s, p = call("POST", f"/leaving/me/items/{items['library']['id']}/pay", T["student"])
    check("pay library dues -> payment ₹250", s == 200 and p["amount"] == 250, p)
    s, d = pay(p["id"])
    check("dues paid", s == 200 and d["status"] == "paid", d)
    s, ex = call("GET", "/leaving/me", T["student"])
    check("exit cleared after paying", ex["status"] == "cleared" and ex["counts"]["cleared"] == 7, ex)
    lib = next(i for i in ex["items"] if i["unit"] == "library")
    s, pdf = call("GET", f"/leaving/payments/{lib['receipt']['id']}/receipt", T["student"], raw=True)
    check("dues receipt PDF (no joining record)", s == 200 and pdf[:4] == b"%PDF", s)
    s, pdf = call("GET", "/leaving/me/no-dues-certificate", T["student"], raw=True)
    check("No-Dues Certificate PDF", s == 200 and pdf[:4] == b"%PDF", s)
    (out_dir / "ndc_test.pdf").write_bytes(pdf if s == 200 else b"")

    # After clearance
    s, d = call("POST", "/services/requests", T["student"], {"doc_type": "bonafide", "purpose": "Passport application"})
    check("bonafide refused for alumni -> 400", s == 400 and "current students" in d["detail"], d)
    s, tc = call("POST", "/services/requests", T["student"], {"doc_type": "tc", "purpose": "Higher studies"})
    check("TC free -> in review with HOD", s == 200 and tc["status"] == "in_review" and tc["amount"] == 0, tc)
    d = approve_all(tc["id"], ["hod", "principal"])
    check("TC approved", d.get("status") == "approved", d)
    s, pdf = call("GET", f"/services/requests/{tc['id']}/pdf", T["student"], raw=True)
    check("TC PDF", s == 200 and pdf[:4] == b"%PDF")
    (out_dir / "tc_test.pdf").write_bytes(pdf if s == 200 else b"")

    s, pc = call("POST", "/services/requests", T["student"], {"doc_type": "provisional", "purpose": "Employment"})
    check("PC -> awaiting payment ₹500", s == 200 and pc["amount"] == 500 and pc["fulfilment"] == "upload", pc)
    pay(pc["payment_id"])
    d = approve_all(pc["id"], ["coe", "principal"])
    check("PC approved -> processing (awaiting Exam Cell upload)", d.get("status") == "processing" and d["location"] == "exam", d)
    s, d = call("GET", f"/services/requests/{pc['id']}/pdf", T["student"], raw=True)
    check("no download while processing -> 400", s == 400, d)
    s, q = call("GET", "/services/exam-cell/queue", T["coe"])
    check("CoE upload queue has PC", s == 200 and any(r["id"] == pc["id"] for r in q["to_upload"]), q)
    s, d = call("GET", "/services/exam-cell/queue", T["hod"])
    check("HOD isn't CoE -> 403", s == 403, d)
    s, d = upload(T["coe"], f"/services/requests/{pc['id']}/final-document", b"GIF89a not a pdf", "x.gif")
    check("non-PDF final document -> 422", s == 422, d)
    s, d = upload(T["coe"], f"/services/requests/{pc['id']}/final-document", PDF)
    check("CoE uploads PC -> approved", s == 200 and d["status"] == "approved" and d["has_file"], d)
    s, pdf = call("GET", f"/services/requests/{pc['id']}/pdf", T["student"], raw=True)
    check("student downloads the uploaded PC", s == 200 and pdf == PDF, s)
    s, v = call("GET", f"/services/verify/{d['verify_code']}")
    check("PC verifies publicly", s == 200 and v["valid"] and v["document"].startswith("Provisional"), v)

    s, d = call("POST", "/services/requests", T["student"], {"doc_type": "transcripts", "purpose": "WES / ECE evaluation",
                                                              "details": {"copies": "3", "delivery": "Post to my address"}})
    check("posted transcripts need an address -> 422", s == 422, d)
    s, d = call("POST", "/services/requests", T["student"], {"doc_type": "transcripts", "purpose": "WES / ECE evaluation",
                                                              "details": {"copies": "11", "delivery": "Digital copy (download)"}})
    check("more than 10 copies -> 422", s == 422, d)
    s, tr = call("POST", "/services/requests", T["student"], {"doc_type": "transcripts", "purpose": "WES / ECE evaluation",
                                                               "details": {"copies": "3", "delivery": "Post to my address", "address": "12 Park Lane, Toronto"}})
    check("transcripts × 3 = ₹900", s == 200 and tr["amount"] == 900, tr)
    pay(tr["payment_id"])
    approve_all(tr["id"], ["coe", "principal"])
    upload(T["coe"], f"/services/requests/{tr['id']}/final-document", PDF)
    s, q = call("GET", "/services/exam-cell/queue", T["coe"])
    check("posted transcripts await dispatch", any(r["id"] == tr["id"] for r in q["to_dispatch"]), q)
    s, d = call("POST", f"/services/requests/{tr['id']}/dispatch", T["coe"], {"tracking": "EM123456789IN"})
    check("dispatch recorded", s == 200 and d["dispatch"]["tracking"] == "EM123456789IN", d)
    s, q = call("GET", "/services/exam-cell/queue", T["coe"])
    check("dispatched leaves the queue", not any(r["id"] == tr["id"] for r in q["to_dispatch"]))

    s, cc = call("POST", "/services/requests", T["student"], {"doc_type": "course_completion", "purpose": "Higher studies"})
    d = approve_all(cc["id"], ["hod", "principal"])
    s, pdf = call("GET", f"/services/requests/{cc['id']}/pdf", T["student"], raw=True)
    check("course completion PDF", s == 200 and pdf[:4] == b"%PDF")
    (out_dir / "ccc_test.pdf").write_bytes(pdf if s == 200 else b"")
    s, d = call("GET", "/leaving/admin/document-fees", T["office"])
    check("document fees need admin -> 403", s == 403, d)
finally:
    con = sqlite3.connect(db_path)
    files = [r[0] for r in con.execute("SELECT issued_file FROM document_requests WHERE student_id = ? AND issued_file IS NOT NULL", (user_id,))]
    for f in files:
        (project / "private_uploads" / "issued" / f).unlink(missing_ok=True)
    exit_ids = [r[0] for r in con.execute("SELECT id FROM exits WHERE user_id = ?", (user_id,))]
    for eid in exit_ids:
        con.execute("DELETE FROM clearance_items WHERE exit_id = ?", (eid,))
    con.execute("DELETE FROM exits WHERE user_id = ?", (user_id,))
    con.execute("DELETE FROM document_requests WHERE student_id = ?", (user_id,))
    con.execute("DELETE FROM payments WHERE user_id = ?", (user_id,))
    con.execute("DELETE FROM student_profiles WHERE user_id = ?", (user_id,))
    con.execute("DELETE FROM users WHERE id = ?", (user_id,))
    con.commit()
    print(f"cleanup: removed temp student, {len(files)} issued files")
    con.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
sys.exit(1 if failures else 0)
