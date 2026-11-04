# Joining after TGEAPCET counselling: what a new student must provide, which documents apply
# to whom, and private storage for the uploaded copies.
import os
import uuid
from datetime import date
from pathlib import Path

from backend.app.core.config import ROOT_DIR
from backend.app.models.admissions import JoiningDocRuleModel

CATEGORIES = ["OC", "BC-A", "BC-B", "BC-C", "BC-D", "BC-E", "SC", "ST", "EWS"]
BRANCHES = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"]
GENDERS = ["male", "female", "other"]

# The default document rules. They are copied into the joining_doc_rules table the first time and from then on the
# Admin Office edits the live copies (Joining documents page): a new rule here is added, an edited one is never overwritten.
#   when:        always | not_oc | ews | reimbursement | other_board  (who has to give it)
#   original:    the college keeps the original (it goes into the originals register)
#   copies:      photocopy sets to hand in with the originals (the college's admission list says 3 sets); photos for "photos"
#   issued_after: the certificate must carry a date on or after this (e.g. an income certificate of the current year)
#   active:      shown to students and required when true
JOINING_DOCS = [
    {"key": "allotment_order",    "label": "Seat allotment order (TGEAPCET)",               "when": "always"},
    {"key": "self_report_ack",    "label": "Online self-reporting acknowledgement",          "when": "always"},
    {"key": "tuition_receipt",    "label": "Tuition fee receipt from the counselling portal", "when": "always",
     "hint": "If your tuition is fully reimbursed, upload the portal page showing ₹0 due."},
    {"key": "rank_card",          "label": "TGEAPCET rank card",                             "when": "always"},
    {"key": "hall_ticket",        "label": "TGEAPCET hall ticket",                           "when": "always"},
    {"key": "ssc_memo",           "label": "SSC / Class 10 marks memo",                      "when": "always", "original": True},
    {"key": "inter_memo",         "label": "Intermediate / Class 12 marks memo",             "when": "always", "original": True},
    {"key": "bonafide_6_10",      "label": "Bonafide certificates, Class 6 to 10",           "when": "always", "original": True},
    {"key": "bonafide_11_12",     "label": "Bonafide certificates, Class 11 and 12 (Intermediate)", "when": "always", "original": True},
    {"key": "tc",                 "label": "Transfer Certificate (TC)",                      "when": "always", "original": True,
     "hint": "The original TC is handed in at the Admin Office."},
    {"key": "study_certificates", "label": "Study certificates (Class 6 to Intermediate)",   "when": "always", "original": True},
    {"key": "aadhaar",            "label": "Aadhaar card",                                   "when": "always"},
    {"key": "photo",              "label": "Passport-size photo",                            "when": "always", "images_only": True,
     "copies": 4, "copy_unit": "photos", "hint": "Upload one here and bring 4 recent passport-size photos."},
    {"key": "caste_cert",         "label": "Caste certificate",                              "when": "not_oc", "original": True},
    {"key": "ews_cert",           "label": "EWS certificate",                                "when": "ews",
     "hint": "It must be valid for the current academic year."},
    {"key": "income_cert",        "label": "Income certificate (for fee reimbursement)",     "when": "reimbursement", "original": True,
     "hint": "It must be issued in the current year; an older certificate is not accepted.",
     "issued_after": date(date.today().year, 1, 1)},
    {"key": "migration",          "label": "Migration certificate (Intermediate outside Telangana)", "when": "other_board", "original": True},
    # Not on the college's admission list; the Admin Office can switch these on if it collects them at admission
    {"key": "antiragging_student", "label": "Anti-ragging undertaking by the student",       "when": "always", "active": False, "copies": 1,
     "hint": "A signed undertaking under the UGC anti-ragging regulations."},
    {"key": "antiragging_parent",  "label": "Anti-ragging undertaking by the parent / guardian", "when": "always", "active": False, "copies": 1,
     "hint": "A signed undertaking under the UGC anti-ragging regulations."},
]
DEFAULT_COPIES = 3


def _row_from_default(i: int, d: dict) -> dict:
    return {"key": d["key"], "label": d["label"], "hint": d.get("hint"), "applies": d["when"], "images_only": d.get("images_only", False),
            "original": d.get("original", False), "copies": d.get("copies", DEFAULT_COPIES), "copy_unit": d.get("copy_unit", "sets"),
            "issued_after": d.get("issued_after"), "active": d.get("active", True), "sort_order": (i + 1) * 10}


_seeded = False


def ensure_rules(db) -> None:
    """Add any default rule that is not in the table yet (never touches a rule the Admin Office has edited)."""
    global _seeded
    if _seeded:
        return
    have = {k for (k,) in db.query(JoiningDocRuleModel.key).all()}
    added = False
    for i, d in enumerate(JOINING_DOCS):
        if d["key"] not in have:
            db.add(JoiningDocRuleModel(**_row_from_default(i, d)))
            added = True
    if added:
        db.commit()
    _seeded = True


def rule_out(r: JoiningDocRuleModel) -> dict:
    return {"id": r.id, "key": r.key, "label": r.label, "hint": r.hint, "when": r.applies, "images_only": bool(r.images_only),
            "original": bool(r.original), "copies": r.copies if r.copies is not None else DEFAULT_COPIES, "copy_unit": r.copy_unit or "sets",
            "issued_after": r.issued_after.isoformat() if r.issued_after else None, "needs_issue_date": bool(r.issued_after),
            "active": bool(r.active), "sort_order": r.sort_order}


def rules(db, include_inactive: bool = False) -> list[dict]:
    ensure_rules(db)
    q = db.query(JoiningDocRuleModel)
    if not include_inactive:
        q = q.filter(JoiningDocRuleModel.active.is_(True))
    return [rule_out(r) for r in q.order_by(JoiningDocRuleModel.sort_order, JoiningDocRuleModel.id).all()]


def labels(db) -> dict:
    return {r["key"]: r["label"] for r in rules(db, include_inactive=True)}


def original_rules(db) -> list[dict]:
    return [r for r in rules(db) if r["original"]]


def applies(doc: dict, admission) -> bool:
    when = doc["when"]
    if when == "always":
        return True
    if when == "not_oc":
        return bool(admission.category) and admission.category not in ("OC", "EWS")
    if when == "ews":
        return admission.category == "EWS"
    if when == "reimbursement":
        return bool(admission.fee_reimbursement)
    if when == "other_board":
        return bool(admission.other_board)
    return False


def required_docs(db, admission) -> list[dict]:
    return [d for d in rules(db) if applies(d, admission)]


# ── Private storage ────────────────────────────────────────────────────────────
PRIVATE_DIR = Path(os.getenv("PRIVATE_UPLOADS_DIR", ROOT_DIR / "private_uploads")) / "admissions"
MAX_DOC_BYTES = 5 * 1024 * 1024
# Detected from the file's first bytes, not trusted from the name or browser
SIGNATURES = [
    (b"%PDF-", "application/pdf", ".pdf"),
    (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
]


class UploadError(ValueError):
    pass


def save_document(admission_id: int, upload, images_only: bool = False) -> dict:
    """Validate and store an uploaded file; returns stored_name, content_type, size_bytes."""
    head = upload.file.read(8)
    match = next(((ctype, ext) for sig, ctype, ext in SIGNATURES if head.startswith(sig)), None)
    if not match:
        raise UploadError("Upload a PDF, JPG or PNG file")
    ctype, ext = match
    if images_only and ctype == "application/pdf":
        raise UploadError("The photo must be a JPG or PNG image")

    folder = PRIVATE_DIR / str(admission_id)
    folder.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    path = folder / stored
    size = len(head)
    with open(path, "wb") as f:
        f.write(head)
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_DOC_BYTES:
                f.close()
                path.unlink(missing_ok=True)
                raise UploadError("Files must be 5 MB or smaller")
            f.write(chunk)
    return {"stored_name": stored, "content_type": ctype, "size_bytes": size}


def document_path(admission_id: int, stored_name: str) -> Path:
    # stored_name is always our own uuid + extension; refuse anything else
    if "/" in stored_name or "\\" in stored_name or ".." in stored_name:
        raise UploadError("Invalid file reference")
    return PRIVATE_DIR / str(admission_id) / stored_name


ISSUED_DIR = PRIVATE_DIR.parent / "issued"   # final documents uploaded by the Exam Cell
MAX_ISSUED_BYTES = 10 * 1024 * 1024


def save_issued_pdf(upload) -> str:
    """Store a prepared document (PDF only); returns its stored name."""
    head = upload.file.read(5)
    if head != b"%PDF-":
        raise UploadError("Upload the prepared document as a PDF")
    ISSUED_DIR.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}.pdf"
    path = ISSUED_DIR / stored
    size = len(head)
    with open(path, "wb") as f:
        f.write(head)
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_ISSUED_BYTES:
                f.close()
                path.unlink(missing_ok=True)
                raise UploadError("The PDF must be 10 MB or smaller")
            f.write(chunk)
    return stored


def issued_path(stored_name: str) -> Path:
    if not stored_name or "/" in stored_name or "\\" in stored_name or ".." in stored_name:
        raise UploadError("Invalid file reference")
    return ISSUED_DIR / stored_name


def delete_document_file(admission_id: int, stored_name: str) -> None:
    try:
        document_path(admission_id, stored_name).unlink(missing_ok=True)
    except UploadError:
        pass
