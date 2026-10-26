# Joining after TGEAPCET counselling: what a new student must provide, which documents apply
# to whom, and private storage for the uploaded copies.
import os
import uuid
from pathlib import Path

from backend.app.core.config import ROOT_DIR

CATEGORIES = ["OC", "BC-A", "BC-B", "BC-C", "BC-D", "BC-E", "SC", "ST", "EWS"]
BRANCHES = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"]
GENDERS = ["male", "female", "other"]

# Every document a joinee may upload. "when" decides if it's required for this student:
#   always | not_oc | ews | reimbursement | other_board
JOINING_DOCS = [
    {"key": "allotment_order",    "label": "Seat allotment order (TGEAPCET)",               "when": "always"},
    {"key": "self_report_ack",    "label": "Online self-reporting acknowledgement",          "when": "always"},
    {"key": "tuition_receipt",    "label": "Tuition fee receipt from the counselling portal", "when": "always",
     "hint": "If your tuition is fully reimbursed, upload the portal page showing ₹0 due."},
    {"key": "rank_card",          "label": "TGEAPCET rank card",                             "when": "always"},
    {"key": "hall_ticket",        "label": "TGEAPCET hall ticket",                           "when": "always"},
    {"key": "ssc_memo",           "label": "SSC / Class 10 marks memo",                      "when": "always"},
    {"key": "inter_memo",         "label": "Intermediate / Class 12 marks memo",             "when": "always"},
    {"key": "tc",                 "label": "Transfer Certificate (TC)",                      "when": "always",
     "hint": "The original TC is handed in at the Admin Office."},
    {"key": "study_certificates", "label": "Study certificates (Class 6 to Intermediate)",   "when": "always"},
    {"key": "aadhaar",            "label": "Aadhaar card",                                   "when": "always"},
    {"key": "photo",              "label": "Passport-size photo",                            "when": "always", "images_only": True},
    {"key": "caste_cert",         "label": "Caste certificate",                              "when": "not_oc"},
    {"key": "ews_cert",           "label": "EWS certificate",                                "when": "ews"},
    {"key": "income_cert",        "label": "Income certificate (for fee reimbursement)",     "when": "reimbursement"},
    {"key": "migration",          "label": "Migration certificate (Intermediate outside Telangana)", "when": "other_board"},
]
DOC_LABELS = {d["key"]: d["label"] for d in JOINING_DOCS}

# Originals the Admin Office may take in at joining (the TC is always kept)
ORIGINAL_KEYS = ["tc", "ssc_memo", "inter_memo", "study_certificates", "caste_cert", "income_cert", "migration"]
ORIGINAL_LABELS = {
    "tc": "Transfer Certificate (TC)",
    "ssc_memo": "SSC / Class 10 marks memo",
    "inter_memo": "Intermediate / Class 12 marks memo",
    "study_certificates": "Study certificates (Class 6 to Intermediate)",
    "caste_cert": "Caste certificate",
    "income_cert": "Income certificate",
    "migration": "Migration certificate",
}


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


def required_docs(admission) -> list[dict]:
    return [d for d in JOINING_DOCS if applies(d, admission)]


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
