# Desk turnaround: how long each approver desk, no-dues unit and the Admissions desk takes,
# measured from the timestamps already in the approval trails (no extra logging needed).
from collections import defaultdict
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from backend.app.accreditation.scope import Scope
from backend.app.models.admissions import AdmissionModel, PaymentModel
from backend.app.models.leaving import ClearanceItemModel, ExitModel
from backend.app.models.services import DocumentRequestModel
from backend.app.student_services.catalog import (
    COE_BUILDING, DOC_TYPES, PRINCIPAL_BUILDING, STEP_SLA_HOURS, UNIT_LABELS, department_building, unit_place,
)

UPLOAD_ROLE = "exam_cell_upload"
STAGE_ORDER = ["mentor", "class_incharge", "ahod", "hod", "coe", "principal", UPLOAD_ROLE]


def _dt(value) -> Optional[datetime]:
    if value is None or isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _hours(a: datetime, b: datetime) -> float:
    return max(0.0, (b - a).total_seconds() / 3600)


def fmt_hours(h: Optional[float]) -> str:
    """12 min · 3.2 h · 2.1 days"""
    if h is None:
        return "—"
    if h < 1:
        return f"{max(1, round(h * 60))} min"
    if h < 48:
        return f"{h:.1f} h"
    return f"{h / 24:.1f} days"


def percentile(values: list, q: float) -> Optional[float]:
    """Linear-interpolated percentile (q in 0..1); None for no values."""
    if not values:
        return None
    s = sorted(values)
    pos = (len(s) - 1) * q
    lo, hi = int(pos), min(int(pos) + 1, len(s) - 1)
    return round(s[lo] + (s[hi] - s[lo]) * (pos - lo), 2)


def _step_building(role: str, student: dict) -> str:
    if role == "principal":
        return PRINCIPAL_BUILDING
    if role in ("coe", UPLOAD_ROLE):
        return COE_BUILDING
    return department_building((student or {}).get("department"))


def request_timings(req: DocumentRequestModel, chain_start: datetime, now: datetime) -> list[dict]:
    """One row per desk the request has reached: {role, label, desk_id, desk_name, building,
    hours (finished) or waiting (still there), outcome}. Steps completed in the same action as the
    step before (one person holding two roles) took no extra time and are left out."""
    rows, start, prev_at = [], chain_start, None
    for i, s in enumerate(req.steps or []):
        base = {"role": s["role"], "label": s["label"], "desk_id": s.get("approver_id"),
                "desk_name": s.get("approver_name") or s["label"],
                "building": _step_building(s["role"], req.student), "ref_no": req.ref_no,
                "doc_name": DOC_TYPES.get(req.doc_type, {}).get("name", req.doc_type), "request_id": req.id}
        at = _dt(s.get("acted_at"))
        if at:
            if at != prev_at:
                rows.append({**base, "hours": _hours(start, at), "outcome": s["status"]})
            start = prev_at = at
        elif i == req.current_step and req.status == "in_review":
            rows.append({**base, "waiting": _hours(req.step_since or start, now)})
            break
        else:
            break
    # Exam Cell documents: after the last approval the Exam Cell prepares and uploads the document
    if (req.fulfilment or DOC_TYPES.get(req.doc_type, {}).get("fulfilment")) == "upload" and req.status in ("processing", "approved"):
        base = {"role": UPLOAD_ROLE, "label": "Exam Cell upload", "desk_id": UPLOAD_ROLE, "desk_name": "Exam Cell",
                "building": COE_BUILDING, "ref_no": req.ref_no,
                "doc_name": DOC_TYPES.get(req.doc_type, {}).get("name", req.doc_type), "request_id": req.id}
        if req.status == "processing":
            rows.append({**base, "waiting": _hours(req.step_since or start, now)})
        elif req.issued_at and prev_at:
            rows.append({**base, "hours": _hours(prev_at, req.issued_at), "outcome": "approved"})
    return rows


def all_request_timings(db: Session, now: Optional[datetime] = None, scope: Optional[Scope] = None) -> list[dict]:
    now = now or datetime.utcnow()
    reqs = [r for r in db.query(DocumentRequestModel).all()
            if scope is None or scope.has((r.student or {}).get("department"))]
    pay_ids = [r.payment_id for r in reqs if r.payment_id]
    paid_at = {p.id: p.paid_at for p in db.query(PaymentModel).filter(PaymentModel.id.in_(pay_ids)).all()} if pay_ids else {}
    rows = []
    for r in reqs:
        if r.status == "awaiting_payment":
            continue   # not at any desk yet: the chain starts when the fee is paid
        start = paid_at.get(r.payment_id) or r.created_at
        rows += request_timings(r, start, now)
    return rows


def _summarise(rows: list[dict], sla: float) -> dict:
    done = [r["hours"] for r in rows if "hours" in r]
    waiting = [r["waiting"] for r in rows if "waiting" in r]
    within = sum(1 for h in done if h <= sla)
    return {
        "handled": len(done),
        "median_hours": percentile(done, 0.5),
        "p90_hours": percentile(done, 0.9),
        "within_sla_pct": round(100 * within / len(done)) if done else None,
        "pending": len(waiting),
        "overdue": sum(1 for w in waiting if w >= sla),
        "oldest_wait_hours": round(max(waiting), 1) if waiting else None,
        "rejected": sum(1 for r in rows if r.get("outcome") == "rejected"),
    }


def rag(summary: dict, sla: float) -> str:
    """red: something is overdue or under 70% on time; amber: slipping; green: on time; idle: no activity."""
    if not summary["handled"] and not summary["pending"]:
        return "idle"
    pct, med = summary["within_sla_pct"], summary["median_hours"]
    if summary["overdue"] or (pct is not None and pct < 70):
        return "red"
    if (pct is not None and pct < 90) or (med is not None and med > sla / 2):
        return "amber"
    return "green"


_RAG_RANK = {"red": 0, "amber": 1, "green": 2, "idle": 3}


def _desk_sort_key(d: dict):
    return (_RAG_RANK[d["rag"]], -d["overdue"], -(d["oldest_wait_hours"] or 0), -(d["median_hours"] or 0))


def clearance_rows(db: Session, now: datetime, scope: Optional[Scope] = None) -> list[dict]:
    exits = {e.id: e for e in db.query(ExitModel).all() if scope is None or scope.has(e.department)}
    rows = []
    for it in db.query(ClearanceItemModel).all():
        ex = exits.get(it.exit_id)
        if not ex:
            continue
        base = {"unit": it.unit, "label": UNIT_LABELS.get(it.unit, it.unit),
                "building": unit_place(it.unit, ex.department)}
        if it.acted_at:     # cleared, or dues raised: either way the unit has responded
            rows.append({**base, "hours": _hours(ex.created_at, it.acted_at), "outcome": it.status})
        elif it.status == "pending" and ex.status == "in_progress":
            rows.append({**base, "waiting": _hours(ex.created_at, now)})
    return rows


def admission_rows(db: Session, now: datetime, scope: Optional[Scope] = None) -> list[dict]:
    rows = []
    for a in db.query(AdmissionModel).filter(AdmissionModel.submitted_at.isnot(None)).all():
        if scope is not None and not scope.has(a.branch):
            continue
        if a.verified_at:
            rows.append({"hours": _hours(a.submitted_at, a.verified_at)})
        elif a.status == "submitted":
            rows.append({"waiting": _hours(a.submitted_at, now)})
    return rows


def desk_wall(db: Session, now: Optional[datetime] = None, scope: Optional[Scope] = None) -> dict:
    """Everything the turnaround wall shows: totals, each stage of the chain, each desk ranked
    slowest first, the oldest waiting requests, the no-dues units and the Admissions desk.
    Only requests from students of the scope's departments count."""
    now = now or datetime.utcnow()
    scope = scope or Scope()
    sla = float(STEP_SLA_HOURS)
    rows = all_request_timings(db, now, scope)

    by_role, by_desk = defaultdict(list), defaultdict(list)
    for r in rows:
        by_role[r["role"]].append(r)
        by_desk[(r["role"], r["desk_id"])].append(r)

    stages = []
    for role in sorted(by_role, key=lambda k: STAGE_ORDER.index(k) if k in STAGE_ORDER else 99):
        s = _summarise(by_role[role], sla)
        stages.append({"role": role, "label": by_role[role][0]["label"], **s, "rag": rag(s, sla)})

    desks = []
    for (role, desk_id), items in by_desk.items():
        s = _summarise(items, sla)
        desks.append({"key": f"{role}:{desk_id}", "role": role, "role_label": items[0]["label"],
                      "desk": items[0]["desk_name"], "building": items[0]["building"], **s, "rag": rag(s, sla)})
    desks.sort(key=_desk_sort_key)

    queue = sorted((r for r in rows if "waiting" in r), key=lambda r: -r["waiting"])[:12]
    queue = [{"request_id": r["request_id"], "ref_no": r["ref_no"], "doc_name": r["doc_name"], "desk": r["desk_name"],
              "role_label": r["label"], "building": r["building"], "waiting_hours": round(r["waiting"], 1),
              "overdue": r["waiting"] >= sla} for r in queue]

    units = defaultdict(list)
    for r in clearance_rows(db, now, scope):
        units[r["unit"]].append(r)
    clearance = []
    for unit, items in units.items():
        s = _summarise(items, sla)
        clearance.append({"unit": unit, "label": items[0]["label"], "building": items[0]["building"], **s, "rag": rag(s, sla)})
    clearance.sort(key=_desk_sort_key)

    adm = _summarise(admission_rows(db, now, scope), sla)

    bottleneck = max((s for s in stages if s["median_hours"] is not None or s["pending"]),
                     key=lambda s: (s["overdue"], s["median_hours"] or 0), default=None)
    return {
        "generated_at": now.isoformat(),
        "scope": scope.describe(),
        "sla_hours": STEP_SLA_HOURS,
        "summary": _summarise(rows, sla),
        "bottleneck": bottleneck and {"role": bottleneck["role"], "label": bottleneck["label"],
                                      "median_hours": bottleneck["median_hours"], "overdue": bottleneck["overdue"]},
        "stages": stages,
        "desks": desks,
        "queue": queue,
        "clearance": clearance,
        "admissions": {**adm, "rag": rag(adm, sla)},
    }
