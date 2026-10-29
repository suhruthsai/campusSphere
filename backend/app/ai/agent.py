"""
Mitra Agent: Mitra can act for a signed-in student, never on her own.

  - my_requests: where each of the student's requests is (which desk, how long, which building);
  - document_options: what can be requested, the purposes to choose from and the details each needs;
  - prepare_document_request: checks a request exactly as the Services page would (profile complete,
    eligibility, purpose, details, no duplicate open request, approval chain) and returns a PROPOSAL.
    Nothing is submitted. The student sees a Confirm button; only that tap (POST /ai/guide/confirm)
    creates the request, through the same create_request the Services page uses.

A proposal is a short-lived signed token holding the student's id and the request. It carries no
"sub" claim, so it can never be used as a login token, and it is only accepted from the same student.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.campus import UserModel
from backend.app.models.leaving import ExitModel
from backend.app.models.services import DocumentRequestModel, StudentProfileModel
from backend.app.student_services import workflow
from backend.app.student_services.catalog import DOC_TYPES, NOC_DATED_PURPOSES, ROLE_LABELS, STEP_SLA_HOURS

PROPOSAL_TYPE = "mitra_proposal"
PROPOSAL_MINUTES = 15
OPEN_STATUSES = ("awaiting_payment", "in_review", "processing")

TOOLS = [
    {"type": "function", "function": {
        "name": "my_requests",
        "description": "The student's own document requests: status, which desk has it now and for how long, "
                       "the building (place id) where it is, and whether it is ready to download.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "document_options",
        "description": "Documents the student can request: purposes to choose from, extra details each needs, fees "
                       "and who approves. Call it before preparing a request if unsure of the purpose or details.",
        "parameters": {"type": "object", "properties": {
            "doc_type": {"type": ["string", "null"], "enum": list(DOC_TYPES) + [None]},
        }}}},
    {"type": "function", "function": {
        "name": "prepare_document_request",
        "description": "Prepare (NOT submit) a document request for the student. It is checked like the Services page "
                       "would, and the student then sees a Confirm button. Only call it once you know the document "
                       "and the purpose (from document_options) and any required details.",
        "parameters": {"type": "object", "properties": {
            "doc_type": {"type": "string", "enum": list(DOC_TYPES)},
            "purpose": {"type": "string", "description": "Exactly one of the document's purposes."},
            "details": {"type": "object", "description": "Extra details the document needs, e.g. NOC: organization, "
                        "location, from_date, to_date (YYYY-MM-DD); 'Other' purpose: purpose_details; transcripts: "
                        "copies, delivery.", "additionalProperties": {"type": "string"}},
        }, "required": ["doc_type", "purpose"]}}},
]
NAMES = {t["function"]["name"] for t in TOOLS}

PROMPT = """
Questions about the documents students get through this app (bonafide, NOC, TC, conduct, MOI, provisional,
CMM, transcripts, sending to WES / ECE, fees, who approves) are answered from document_options, NOT the website
search: the app's own options are the truth for those.
You can also ACT for this student (only them, only these actions):
- "Where is my bonafide / NOC / request?": call my_requests, tell them which desk has it and for how long, and walk
  there with guide_walk using the request's `place` (say on arrival whose desk it is and what happens next).
  If it is ready, say they can download it on the Services page.
- "I need a bonafide / NOC / ...": call document_options if you are unsure of the purpose or details. Use what the
  student already said: the event or company they name IS the organisation, and dates they give are the from/to
  dates (write them as YYYY-MM-DD). Ask ONE short question only if a REQUIRED detail is really missing; never ask
  for optional ones (like location). Then call prepare_document_request.
  It does NOT submit: the student sees the request with a Confirm button. Never say you submitted, sent or applied;
  say what you prepared and ask them to tap Confirm. If it returns a problem (e.g. profile incomplete, already
  requested), explain it simply and say how to fix it. Prepare at most one request per reply."""


def _profile(db: Session, current: dict):
    user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
    profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
    return user, profile


def my_requests(db: Session, current: dict) -> dict:
    reqs = (db.query(DocumentRequestModel).filter(DocumentRequestModel.student_id == current["sub"],
                                                  DocumentRequestModel.status != "cancelled")
            .order_by(DocumentRequestModel.created_at.desc()).limit(10).all())
    if not reqs:
        return {"requests": [], "note": "The student has no document requests yet."}
    out = []
    for r in reqs:
        s = workflow.serialize(r, current)
        item = {"ref_no": r.ref_no, "document": s["doc_name"], "purpose": r.purpose, "status": r.status,
                "requested_on": r.created_at.strftime("%d %b %Y") if r.created_at else None, "place": s["location"]}
        if r.status == "in_review":
            item.update(with_desk=f"{s['current_label']} ({s['current_approver']})", waiting_hours=s["waiting_hours"],
                        overdue=s["overdue"], desk_target_hours=STEP_SLA_HOURS)
        elif r.status == "awaiting_payment":
            item["next"] = f"Pay the fee of Rs {r.amount} on the Services page to start the approvals."
        elif r.status == "processing":
            item["next"] = "Approved; the Exam Cell is preparing the document."
        elif r.status == "approved":
            item["next"] = "Ready: download it on the Services page."
        elif r.status == "rejected":
            rej = next((st for st in r.steps or [] if st.get("status") == "rejected"), {})
            item["next"] = f"Rejected by the {rej.get('label', 'approver')}: {rej.get('remarks') or 'no reason given'}."
        out.append(item)
    return {"requests": out}


def document_options(doc_type: Optional[str] = None) -> dict:
    keys = [doc_type] if doc_type in DOC_TYPES else list(DOC_TYPES)
    return {"documents": [{
        "doc_type": k, "name": d["name"], "what": d["description"], "purposes": d["purposes"],
        "details": [{"key": f["key"], "label": f["label"], "required": f["required"], **({"options": f["options"]} if f.get("options") else {})}
                    for f in d["fields"]] + ([{"key": "purpose_details", "label": "Describe the purpose", "required": "when purpose is Other"}]),
        "dated_purposes": sorted(NOC_DATED_PURPOSES) if k == "noc" else [],
        "fee_rupees": d["fee"], "approved_by": [ROLE_LABELS[r] for r in d["chain"]],
        "only_after_no_dues": d["needs_exit"] == "cleared",
    } for k, d in ((k, DOC_TYPES[k]) for k in keys)]}


def _check(db: Session, current: dict, doc_type: str, purpose: str, details: dict):
    """Run the Services page's checks without creating anything. Returns (body, info) or raises HTTPException."""
    from backend.app.api.v1.endpoints import services as S

    if current.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can request documents.")
    if doc_type not in DOC_TYPES:
        raise HTTPException(status_code=422, detail=f"Unknown document. Choose one of: {', '.join(DOC_TYPES)}")
    doc = DOC_TYPES[doc_type]
    if purpose not in doc["purposes"]:
        # Small slips ("passport" for "Passport application") are matched; anything else is sent back with the list
        match = [p for p in doc["purposes"] if purpose and purpose.lower() in p.lower()]
        if len(match) != 1:
            raise HTTPException(status_code=422, detail=f"Purpose must be one of: {', '.join(doc['purposes'])}")
        purpose = match[0]
    body = S.RequestIn(doc_type=doc_type, purpose=purpose, details={k: str(v) for k, v in (details or {}).items()})
    user, profile = _profile(db, current)
    if not S._profile_out(db, profile, user)["complete"]:
        raise HTTPException(status_code=400, detail="The student's academic profile isn't complete: they must fill "
                                                    "in year, section, roll number and parent's name on the Services page first.")
    exit_rec = db.query(ExitModel).filter(ExitModel.user_id == user.id).first()
    why_not = S._eligibility(doc_type, exit_rec)
    if why_not:
        raise HTTPException(status_code=400, detail=why_not)
    body.details = S._validate_request(body)
    open_same = db.query(DocumentRequestModel).filter(
        DocumentRequestModel.student_id == user.id, DocumentRequestModel.doc_type == doc_type,
        DocumentRequestModel.purpose == purpose, DocumentRequestModel.status.in_(OPEN_STATUSES)).first()
    if open_same:
        raise HTTPException(status_code=409, detail=f"They already have this request open ({open_same.ref_no}).")
    try:
        steps = workflow.resolve_chain(db, profile, doc["chain"])
    except workflow.ChainError as e:
        raise HTTPException(status_code=400, detail=str(e))
    fee = S._fees(db).get(doc_type, doc["fee"])
    copies = int(body.details.get("copies", 1)) if doc.get("per_copy") else 1
    return body, {"user": user, "profile": profile, "steps": steps, "amount": fee * copies}


def prepare(db: Session, current: dict, args: dict, proposals: list) -> str:
    """The prepare_document_request tool: on success appends a proposal for the Confirm button."""
    try:
        body, info = _check(db, current, str(args.get("doc_type") or ""), str(args.get("purpose") or ""),
                            args.get("details") if isinstance(args.get("details"), dict) else {})
    except HTTPException as e:
        return json.dumps({"prepared": False, "problem": e.detail})
    if proposals:
        return json.dumps({"prepared": False, "problem": "One request at a time: a request is already waiting for the student's confirmation."})
    doc = DOC_TYPES[body.doc_type]
    profile, user = info["profile"], info["user"]
    first = info["steps"][0]
    lines = [f"Purpose: {body.purpose}"]
    lines += [f"{f['label']}: {body.details[f['key']]}" for f in doc["fields"] if body.details.get(f["key"])]
    if body.details.get("purpose_details"):
        lines.append(f"Details: {body.details['purpose_details']}")
    lines.append(f"For: {user.name} · {profile.department} Year {profile.year}" + (f" · Section {profile.section}" if profile.section else ""))
    lines.append("Approvals: " + " → ".join(s["label"] for s in info["steps"]))
    token = jwt.encode({"typ": PROPOSAL_TYPE, "uid": current["sub"],
                        "req": {"doc_type": body.doc_type, "purpose": body.purpose, "details": body.details},
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=PROPOSAL_MINUTES)},
                       settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    proposals.append({"token": token, "kind": "document_request", "title": doc["name"], "lines": lines,
                      "fee": info["amount"], "first_desk": f"{first['label']} ({first['approver_name']})",
                      "counter": doc["counter_name"]})
    return json.dumps({"prepared": True, "submitted": False, "document": doc["name"], "purpose": body.purpose,
                       "fee_rupees": info["amount"], "first_desk": first["label"],
                       "next": "The student sees this request with a Confirm button. Say in one or two sentences what you "
                               "prepared" + (f" (fee Rs {info['amount']}, paid on the Services page after confirming)" if info["amount"] else "")
                               + " and ask them to tap Confirm. Do NOT say it is submitted."})


def run(db: Session, current: dict, name: str, args: dict, proposals: list) -> str:
    try:
        if name == "my_requests":
            return json.dumps(my_requests(db, current), ensure_ascii=False, default=str)
        if name == "document_options":
            return json.dumps(document_options(args.get("doc_type")), ensure_ascii=False)
        if name == "prepare_document_request":
            return prepare(db, current, args, proposals)
    except Exception as e:  # noqa: BLE001 — a tool failure must not take the whole conversation down
        print(f"[mitra-agent] {name} failed: {e!r}")
        if db is not None:
            db.rollback()
        return "Error: that didn't work just now. Tell the student to use the Services page instead."
    return f"Error: unknown tool '{name}'."


def confirm(db: Session, current: dict, token: str) -> dict:
    """Submit a proposal the student confirmed, through the Services page's own create_request."""
    from backend.app.api.v1.endpoints import services as S

    try:
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="This request has expired. Ask Mitra again.")
    if claims.get("typ") != PROPOSAL_TYPE or claims.get("uid") != current["sub"]:
        raise HTTPException(status_code=403, detail="This request was prepared for someone else.")
    return S.create_request(S.RequestIn(**claims["req"]), db, current)
