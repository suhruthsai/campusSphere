"""
The accreditation workspace: every catalog metric (catalog.py) across the assessment period, with its value per
academic year, where each value came from, the evidence behind it, and whether it could be filed.

  origin     live       computed now from CampusSphere's own records (the year in progress)
             imported   from an official export (Exam Cell results, audited accounts...)
             manual     typed in by the person responsible
             generated  produced for a demonstration (pilot data): never fileable, whatever the screens show
  status     missing        no value for that year
             needs_evidence a quantitative value with no document behind it (DVV rejects these)
             generated      the value rests on generated data
             live           the year in progress: CampusSphere's live reading, shown as a hint
             ready          a value with evidence
             locked         reviewed and frozen by the IQAC Coordinator
  who        admins, the Principal and the IQAC Coordinator: everything (and lock); a criterion in-charge: their
             NAAC criterion; an NBA coordinator: their programme; a metric owner: their metric; management: read
"""
import hashlib
import os
import uuid
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from backend.app.accreditation import catalog as C
from backend.app.core.roles import user_roles
from backend.app.models.accreditation import AccrEvidenceModel, AccrRoleModel, AccrValueModel
from backend.app.student_services.workflow import academic_year

ROOT_DIR = Path(__file__).resolve().parents[3]
EVIDENCE_DIR = Path(os.getenv("PRIVATE_UPLOADS_DIR", ROOT_DIR / "private_uploads")) / "accreditation"
MAX_EVIDENCE_BYTES = 20 * 1024 * 1024
SIGNATURES = [(b"%PDF-", "application/pdf", ".pdf"), (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
              (b"\x89PNG\r\n\x1a\n", "image/png", ".png")]
OFFICE = {".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


class EvidenceError(ValueError):
    pass


# ── Who may do what ──────────────────────────────────────────────────────────────
def access(db: Session, current: dict) -> dict:
    r = user_roles(db, current)
    roles = db.query(AccrRoleModel).filter(AccrRoleModel.user_id == current["sub"]).all()
    iqac = any(x.role == "iqac_coordinator" for x in roles)
    full = r["admin"] or r["principal"] or iqac
    return {
        "view": full or r["management"] or bool(roles) or r["hod"],
        "edit_all": full, "lock": full, "manage_team": full,
        "criteria": sorted({x.criterion for x in roles if x.role == "criterion_incharge" and x.criterion}),
        "programmes": sorted({x.programme for x in roles if x.role == "nba_coordinator" and x.programme} | set(r["hod_departments"])),
        "codes": sorted({f"{x.framework}:{x.code}" for x in roles if x.role == "metric_owner" and x.code}),
        "iqac_coordinator": iqac,
    }


def can_edit(a: dict, framework: str, code: str, programme: str) -> bool:
    if a["edit_all"]:
        return True
    if framework == "naac" and C.criterion_of(code) in a["criteria"]:
        return True
    if framework == "nba" and programme and programme in a["programmes"]:
        return True
    return f"{framework}:{code}" in a["codes"]


# ── Where live values come from, and whether they rest on generated data ─────────
# Live metric id -> the CampusSphere records it is computed from
LIVE_AREAS = {"attendance": "attendance", "documents": "requests", "turnaround": "requests", "egov": "requests",
              "audit": "requests", "placement": "placements", "progression": "requests", "outcomes": "obe",
              "feedback": "feedback", "results": "feedback", "faculty_quality": "research", "research": "research",
              "extension": "research", "activities": "institution", "library": "institution", "green": "institution",
              "governance": "institution"}


def generated_areas(db: Session) -> set:
    """Which kinds of records hold generated (pilot) data right now."""
    from backend.app.models.attendance import AttendanceSessionModel
    from backend.app.models.placements import PlacementDriveModel
    from backend.app.models.services import DocumentRequestModel
    out = set()
    if db.query(AttendanceSessionModel.id).filter(AttendanceSessionModel.pilot_run.isnot(None)).first():
        out.add("attendance")
    if db.query(DocumentRequestModel.id).filter(DocumentRequestModel.pilot_run.isnot(None)).first():
        out.add("requests")
    if db.query(PlacementDriveModel.id).filter(PlacementDriveModel.pilot_run.isnot(None)).first():
        out.add("placements")
    from backend.app.models.obe import ObeCourseModel
    if db.query(ObeCourseModel.id).filter(ObeCourseModel.pilot_run.isnot(None)).first():
        out.add("obe")
    from backend.app.models.feedback import FeedbackFormModel, ResultSummaryModel
    if db.query(FeedbackFormModel.id).filter(FeedbackFormModel.pilot_run.isnot(None)).first() or \
            db.query(ResultSummaryModel.id).filter(ResultSummaryModel.pilot_run.isnot(None)).first():
        out.add("feedback")
    from backend.app.models.research import FacultyRecordModel
    if db.query(FacultyRecordModel.id).filter(FacultyRecordModel.pilot_run.isnot(None)).first():
        out.add("research")
    from backend.app.models.institution import MeetingModel
    if db.query(MeetingModel.id).filter(MeetingModel.pilot_run.isnot(None)).first():
        out.add("institution")
    return out


def live_metrics(db: Session, framework: str, programme: str) -> dict:
    """id -> computed metric (title, value, status, detail) for the scope: NBA one programme, NAAC the pilot."""
    from backend.app.accreditation.metrics import Ctx, METRICS
    from backend.app.accreditation.scope import Scope
    scope_id = {"IT": "it", "CIVIL": "civil"}.get(programme, "both") if framework == "nba" else "both"
    ctx = Ctx(db, Scope(scope_id))
    out = {}
    for mid, _naac, _nba, fn in METRICS:
        try:
            out[mid] = fn(ctx)
        except Exception as e:  # noqa: BLE001 - one failing metric must not hide the rest
            out[mid] = {"title": mid, "value": None, "status": "missing", "detail": str(e)}
    return out


# ── The grid ─────────────────────────────────────────────────────────────────────
def _status(m: dict, v: Optional[AccrValueModel], evidence: int, generated: bool) -> str:
    if v is None or (v.value is None and not (v.text or "").strip()):
        return "missing"
    if v.origin == "generated" or generated:
        return "generated"
    if isinstance(v, _Live):
        return "live"                                   # this year's reading from CampusSphere, a hint

    if v.locked:
        return "locked"
    if m["kind"] == "QnM" and v.origin in ("manual", "imported") and evidence == 0:
        return "needs_evidence"
    return "ready"


class _Live:
    """A live value shown for the year in progress when nothing has been stored for it."""
    def __init__(self, value, text, origin):
        self.value, self.text, self.origin, self.locked, self.note, self.id = value, text, origin, False, None, None
        self.entered_at = None


def grid(db: Session, framework: str, programme: str = "") -> dict:
    fw = C.FRAMEWORKS[framework]
    current = academic_year()
    years = C.academic_years(fw["years"], current)
    stored = {(v.code, v.year): v for v in db.query(AccrValueModel).filter(
        AccrValueModel.framework == framework, AccrValueModel.programme == programme)}
    ev = Counter((e.code, e.year) for e in db.query(AccrEvidenceModel).filter(
        AccrEvidenceModel.framework == framework, AccrEvidenceModel.programme == programme,
        AccrEvidenceModel.removed == False))  # noqa: E712
    live = live_metrics(db, framework, programme)
    gen = generated_areas(db)

    def cells(m):
        out = []
        for y in C.academic_years(C.years_for(framework, m) or fw["years"], current):
            v = stored.get((m["code"], y))
            is_gen = False
            if v is None and y == current and m["live"] and live.get(m["live"], {}).get("status") not in (None, "missing"):
                lm = live[m["live"]]
                is_gen = LIVE_AREAS.get(m["live"]) in gen or lm.get("status") == "simulated"
                # The live reading is shown as text: CampusSphere's live metric may count something else than the
                # catalog metric's unit (courses vs % of courses), so it is a hint, not the metric's value
                v = _Live(None, lm.get("value"), "generated" if is_gen else "live")
            n_ev = ev.get((m["code"], y), 0)
            out.append({"year": y, "value": v.value if v else None, "text": v.text if v else None,
                        "origin": v.origin if v else None, "locked": bool(v and v.locked), "evidence": n_ev,
                        "status": _status(m, v, n_ev, is_gen)})
        return out

    criteria = []
    for code, title, marks in fw["criteria"]:
        ms = [m for m in fw["metrics"] if C.criterion_of(m["code"]) == code]
        rows = [{**{k: m[k] for k in ("code", "title", "kind", "unit", "live", "level")}, "cells": cells(m)} for m in ms]
        criteria.append({"code": code, "title": title, "marks": marks, "metrics": rows, "summary": _summary(rows, current)})
    profile = [{**{k: m[k] for k in ("code", "title", "kind", "unit", "live")}, "cells": cells(m)} for m in fw["profile"]]
    every = [r for c in criteria for r in c["metrics"]]
    return {"framework": framework, "version": fw["version"], "programme": programme, "current_year": current,
            "years": years, "assessment_years": years[1:], "criteria": criteria, "profile": profile,
            "summary": _summary(every + profile, current), "generated_areas": sorted(gen)}


def _summary(rows: list, current: str) -> dict:
    """Readiness over the assessment period (completed years) for quantitative metrics."""
    cells = [c for r in rows if r["kind"] == "QnM" for c in r["cells"] if c["year"] != current]
    n = Counter(c["status"] for c in cells)
    total = len(cells)
    ready = n["ready"] + n["locked"]
    return {"cells": total, "ready": ready, "locked": n["locked"], "needs_evidence": n["needs_evidence"],
            "missing": n["missing"], "generated": n["generated"],
            "ready_pct": round(100 * ready / total) if total else 0,
            "qualitative_written": sum(1 for r in rows if r["kind"] == "QlM" and any((c["text"] or "").strip() and c["year"] != current for c in r["cells"]))}


# ── Values ───────────────────────────────────────────────────────────────────────
def save_value(db: Session, framework: str, code: str, programme: str, year: str, value, text, note, origin, user_id) -> AccrValueModel:
    v = db.query(AccrValueModel).filter(AccrValueModel.framework == framework, AccrValueModel.code == code,
                                        AccrValueModel.programme == programme, AccrValueModel.year == year).first()
    if v and v.locked:
        raise ValueError("This value is locked by the IQAC Coordinator")
    if v is None:
        v = AccrValueModel(framework=framework, code=code, programme=programme, year=year)
        db.add(v)
    v.value, v.text, v.note, v.origin, v.entered_by, v.entered_at = value, text, note, origin, user_id, datetime.utcnow()
    return v


# ── Evidence files ───────────────────────────────────────────────────────────────
def save_evidence_file(upload) -> dict:
    head = upload.file.read(8)
    match = next(((ctype, ext) for sig, ctype, ext in SIGNATURES if head.startswith(sig)), None)
    if not match and head.startswith(b"PK\x03\x04"):
        ext = Path(upload.filename or "").suffix.lower()
        if ext in OFFICE:
            match = (OFFICE[ext], ext)
    if not match:
        raise EvidenceError("Upload a PDF, JPG, PNG, Excel (.xlsx) or Word (.docx) file")
    ctype, ext = match
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    path = EVIDENCE_DIR / stored
    digest = hashlib.sha256(head)
    size = len(head)
    with open(path, "wb") as f:
        f.write(head)
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_EVIDENCE_BYTES:
                f.close()
                path.unlink(missing_ok=True)
                raise EvidenceError("Evidence files must be 20 MB or smaller")
            digest.update(chunk)
            f.write(chunk)
    return {"filename": stored, "mime": ctype, "size": size, "sha256": digest.hexdigest()}


def evidence_path(stored: str) -> Path:
    if not stored or "/" in stored or "\\" in stored or ".." in stored:
        raise EvidenceError("Invalid file reference")
    return EVIDENCE_DIR / stored


def evidence_out(e: AccrEvidenceModel) -> dict:
    return {"id": e.id, "framework": e.framework, "code": e.code, "programme": e.programme, "year": e.year,
            "title": e.title, "kind": e.kind, "original": e.original, "mime": e.mime, "size": e.size, "url": e.url,
            "signed": e.signed, "version": e.version, "source": e.source,
            "uploaded_at": e.uploaded_at.isoformat() if e.uploaded_at else None}


def metric_detail(db: Session, framework: str, code: str, programme: str) -> dict:
    m = C.metric(framework, code)
    if not m:
        raise KeyError(code)
    g = grid(db, framework, programme)
    row = next((r for c in g["criteria"] for r in c["metrics"] if r["code"] == code), None) or \
        next((r for r in g["profile"] if r["code"] == code), None)
    stored = {v.year: v for v in db.query(AccrValueModel).filter(
        AccrValueModel.framework == framework, AccrValueModel.code == code, AccrValueModel.programme == programme)}
    for c in row["cells"]:
        v = stored.get(c["year"])
        c["note"] = v.note if v else None
        c["entered_at"] = v.entered_at.isoformat() if v and v.entered_at else None
    evidence = defaultdict(list)
    for e in db.query(AccrEvidenceModel).filter(AccrEvidenceModel.framework == framework, AccrEvidenceModel.code == code,
                                                AccrEvidenceModel.programme == programme, AccrEvidenceModel.removed == False  # noqa: E712
                                                ).order_by(AccrEvidenceModel.uploaded_at.desc()):
        evidence[e.year].append(evidence_out(e))
    live = None
    if m["live"]:
        lm = live_metrics(db, framework, programme).get(m["live"])
        if lm:
            live = {"value": lm.get("value"), "detail": lm.get("detail"), "status": lm.get("status"),
                    "generated": LIVE_AREAS.get(m["live"]) in generated_areas(db) or lm.get("status") == "simulated"}
    return {"framework": framework, "code": code, "programme": programme, "criterion": C.criterion_of(code),
            **{k: m[k] for k in ("title", "kind", "unit", "evidence", "level")}, "cells": row["cells"],
            "evidence_by_year": evidence, "live": live, "current_year": g["current_year"]}
