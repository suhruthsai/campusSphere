"""
Stakeholder feedback: forms from standard question sets, anonymous answers (signed in, or by a public link for
alumni, employers and parents), analysis, and the action-taken report (ATR) the IQAC approves and publishes.
NAAC 1.4.1 / 1.4.2 / 2.7 (dry run); NBA 7, 9.2, 9.3. A course-exit form, when closed, becomes the course's
indirect CO attainment.

  who manages   admins, the Principal, the IQAC Coordinator, the Criterion 1 in-charge; the programme's HOD / NBA
                coordinator for that programme's forms
  approves ATR  admins, the Principal, the IQAC Coordinator
  privacy       answers carry no identity; a teaching form's results reach its teacher only after it closes with at
                least MIN_TEACHER responses; comments are shown to the people who manage feedback
"""
import hashlib
import secrets
from collections import Counter
from datetime import datetime
from typing import Dict, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.accreditation import workspace as W
from backend.app.core.rate_limit import SlidingWindowLimiter, client_ip
from backend.app.core.security import get_current_user
from backend.app.db.session import get_db
from backend.app.models.feedback import FeedbackATRModel, FeedbackFormModel, FeedbackResponseModel
from backend.app.models.obe import ObeCOModel, ObeCourseModel, ObeSurveyModel
from backend.app.models.services import StudentProfileModel

router = APIRouter()
public_router = APIRouter()        # mounted under /feedback without login: public forms and published ATRs
MIN_TEACHER = 5
public_limit = SlidingWindowLimiter(limit=20, window=60 * 60)

R = "rating"
T = "text"
TEMPLATES = {
    "curriculum": ("Students' feedback on the curriculum", "students", [
        "The syllabus is relevant to current industry and societal needs", "The syllabus is covered fully in the semester",
        "Theory and practical work are well balanced", "Electives give real choice", "Courses follow a sensible sequence",
        "Laboratory work supports the theory", "The workload is reasonable", "Overall, I am satisfied with the curriculum"]),
    "teaching": ("Students' feedback on the teacher", "students", [
        "The teacher comes well prepared", "Explanations are clear", "The pace suits the class", "Real-world examples are used",
        "Doubts are cleared patiently", "Classes start and end on time", "ICT tools are used well",
        "Internal evaluation is fair and transparent", "Overall, I rate this teacher highly"]),
    "course_exit": ("Course-exit survey", "students", []),           # one question per CO
    "facilities": ("Students' feedback on facilities", "students", [
        "Classrooms are comfortable and well equipped", "Laboratories are adequate and maintained", "The library meets my needs",
        "Internet / Wi-Fi works reliably", "The canteen is hygienic and affordable", "Sports facilities are adequate",
        "Transport is reliable", "The campus is clean and safe"]),
    "faculty": ("Teachers' feedback on the curriculum", "faculty", [
        "The curriculum meets the programme outcomes", "Teachers can add content beyond the syllabus",
        "Laboratory resources support the curriculum", "The syllabus is revised often enough", "Assessment methods suit the courses"]),
    "alumni": ("Alumni feedback", "public", [
        "The curriculum prepared me for my career", "I gained the technical skills I needed", "Placement support was effective",
        "Teachers were competent and approachable", "I would recommend the college"]),
    "employer": ("Employer feedback", "public", [
        "Technical knowledge of our recruits", "Problem-solving ability", "Communication skills", "Teamwork",
        "Professional attitude and ethics", "Ability to learn new technologies"]),
    "parent": ("Parents' feedback", "public", [
        "We are informed of our ward's progress and attendance", "The campus is safe for our ward",
        "Facilities are good for the fees paid", "The college responds to our concerns", "Our ward is developing well here"]),
    "sss": ("Student Satisfaction Survey (dry run)", "students", [
        "How much of the syllabus was covered in class", "How well teachers prepare for classes",
        "How well teachers communicate", "Teachers' approach to teaching", "Fairness of the internal evaluation",
        "Teachers discuss your performance in assignments with you", "Mentoring by your mentor",
        "Opportunities to learn beyond the curriculum", "Use of ICT tools in teaching", "Overall quality of the teaching-learning process"]),
}
LABELS = {k: v[0] for k, v in TEMPLATES.items()}


def _questions(kind: str, cos: list) -> list:
    if kind == "course_exit":
        qs = [{"id": f"q{i}", "type": R, "co": c.code, "text": f"I am able to: {c.text}"} for i, c in enumerate(cos, 1)]
    else:
        qs = [{"id": f"q{i}", "type": R, "text": t} for i, t in enumerate(TEMPLATES[kind][2], 1)]
    return qs + [{"id": "comment", "type": T, "text": "Any comments or suggestions"}]


def _access(db: Session, current: dict, programme: Optional[str] = None) -> dict:
    a = W.access(db, current)
    manage = a["edit_all"] or "1" in a["criteria"] or (programme is not None and programme in a["programmes"])
    return {"manage": manage, "approve": a["lock"], "view": a["view"], "programmes": a["programmes"], "all": a["edit_all"] or "1" in a["criteria"]}


def _need(db, current, programme, what="manage"):
    a = _access(db, current, programme)
    if not a[what]:
        raise HTTPException(status_code=403, detail="Only the IQAC, the Criterion 1 in-charge and the programme's HOD / NBA coordinator")
    return a


def _respondent(form: FeedbackFormModel, user_id: str) -> str:
    return hashlib.sha256(f"{form.salt}:{user_id}".encode()).hexdigest()


def _form_out(f: FeedbackFormModel, n: int, extra: Optional[dict] = None) -> dict:
    return {"id": f.id, "title": f.title, "kind": f.kind, "kind_label": LABELS.get(f.kind, f.kind), "audience": f.audience,
            "programme": f.programme, "year": f.year, "study_year": f.study_year, "course_id": f.course_id, "status": f.status,
            "closes_at": f.closes_at.isoformat() if f.closes_at else None, "public_code": f.public_code, "responses": n,
            "questions": f.questions, **(extra or {})}


@router.get("/access", summary="What I can do with feedback")
def access(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    return _access(db, current)


@router.get("/templates", summary="The standard question sets")
def templates(current: dict = Depends(get_current_user)):
    return [{"kind": k, "label": v[0], "audience": v[1], "questions": len(v[2])} for k, v in TEMPLATES.items()]


# ── Forms ────────────────────────────────────────────────────────────────────────
@router.get("/forms", summary="Feedback forms with response counts")
def forms(year: Optional[str] = None, programme: Optional[str] = None, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = _access(db, current)
    if not (a["manage"] or a["view"]):
        raise HTTPException(status_code=403, detail="Only the IQAC, HODs, NBA coordinators and management")
    q = db.query(FeedbackFormModel)
    if year:
        q = q.filter(FeedbackFormModel.year == year)
    if programme:
        q = q.filter(FeedbackFormModel.programme == programme.upper())
    rows = q.order_by(FeedbackFormModel.year.desc(), FeedbackFormModel.kind).all()
    counts = Counter(fid for (fid,) in db.query(FeedbackResponseModel.form_id).filter(FeedbackResponseModel.form_id.in_([f.id for f in rows])))
    atrs = {x.form_id: x for x in db.query(FeedbackATRModel).filter(FeedbackATRModel.form_id.in_([f.id for f in rows]))}
    courses = {c.id: c for c in db.query(ObeCourseModel).filter(ObeCourseModel.id.in_([f.course_id for f in rows if f.course_id]))}
    out = []
    for f in rows:
        atr = atrs.get(f.id)
        c = courses.get(f.course_id)
        out.append(_form_out(f, counts.get(f.id, 0), {
            "course": f"{c.code} · {c.name}" if c else None,
            "atr": atr.status if atr else None, "published": bool(atr and atr.published),
            "can_manage": _access(db, current, f.programme)["manage"]}))
    return out


class FormIn(BaseModel):
    kind: Literal["curriculum", "teaching", "course_exit", "facilities", "faculty", "alumni", "employer", "parent", "sss"]
    programme: Optional[str] = Field(None, max_length=20)
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    study_year: Optional[int] = Field(None, ge=1, le=4)
    course_id: Optional[int] = None
    title: Optional[str] = Field(None, max_length=160)
    closes_at: Optional[datetime] = None


@router.post("/forms", summary="Create a feedback form from a standard question set")
def create_form(body: FormIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = (body.programme or "").upper() or None
    a = _need(db, current, prog)
    if not prog and not a["all"]:
        raise HTTPException(status_code=403, detail="College-wide forms are for the IQAC and the Criterion 1 in-charge")
    course, cos = None, []
    if body.kind in ("teaching", "course_exit"):
        course = db.get(ObeCourseModel, body.course_id) if body.course_id else None
        if not course:
            raise HTTPException(status_code=422, detail="Choose the course this form is about")
        prog = course.programme
        cos = db.query(ObeCOModel).filter(ObeCOModel.course_id == course.id).order_by(ObeCOModel.code).all()
        if body.kind == "course_exit" and not cos:
            raise HTTPException(status_code=422, detail="The course has no COs yet")
    label, audience, _ = TEMPLATES[body.kind]
    title = body.title or f"{label}{f' · {course.code} {course.name}' if course else ''}{f' · {prog}' if prog else ''} · {body.year}"
    f = FeedbackFormModel(title=title, kind=body.kind, audience=audience, programme=prog, year=body.year,
                          study_year=body.study_year or ((course.semester + 1) // 2 if course and course.semester else None),
                          course_id=course.id if course else None, questions=_questions(body.kind, cos), closes_at=body.closes_at,
                          salt=secrets.token_hex(16), created_by=current["sub"])
    db.add(f)
    db.commit()
    return _form_out(f, 0)


class StatusIn(BaseModel):
    status: Literal["open", "closed"]
    closes_at: Optional[datetime] = None


@router.patch("/forms/{form_id}", summary="Open or close a form")
def set_status(form_id: int, body: StatusIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    f = _form(db, form_id)
    _need(db, current, f.programme)
    f.status = body.status
    if body.closes_at:
        f.closes_at = body.closes_at
    if body.status == "open":
        f.opens_at = f.opens_at or datetime.utcnow()
        if f.audience == "public" and not f.public_code:
            f.public_code = secrets.token_urlsafe(8)
    if body.status == "closed" and f.kind == "course_exit" and f.course_id:
        _to_course_survey(db, f)
    db.commit()
    return {"message": f"Form {body.status}", "public_code": f.public_code}


def _to_course_survey(db: Session, f: FeedbackFormModel):
    """A closed course-exit form becomes the course's indirect CO attainment (OBE)."""
    stats = _stats(db, f)
    for q in f.questions:
        if q.get("co") and stats[q["id"]]["n"]:
            row = db.query(ObeSurveyModel).filter(ObeSurveyModel.course_id == f.course_id, ObeSurveyModel.co_code == q["co"]).first() or \
                ObeSurveyModel(course_id=f.course_id, co_code=q["co"])
            row.responses, row.mean = stats[q["id"]]["n"], stats[q["id"]]["mean"]
            db.add(row)


@router.delete("/forms/{form_id}", summary="Delete a form that has no responses")
def delete_form(form_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    f = _form(db, form_id)
    _need(db, current, f.programme)
    if db.query(FeedbackResponseModel.id).filter(FeedbackResponseModel.form_id == f.id).first():
        raise HTTPException(status_code=409, detail="This form has responses: close it instead")
    db.query(FeedbackATRModel).filter(FeedbackATRModel.form_id == f.id).delete(synchronize_session=False)
    db.delete(f)
    db.commit()
    return {"message": "Deleted"}


def _form(db: Session, form_id: int) -> FeedbackFormModel:
    f = db.get(FeedbackFormModel, form_id)
    if not f:
        raise HTTPException(status_code=404, detail="Form not found")
    return f


# ── Answering ────────────────────────────────────────────────────────────────────
def _eligible(db: Session, current: dict, f: FeedbackFormModel) -> bool:
    if f.status != "open" or (f.closes_at and datetime.utcnow() > f.closes_at):
        return False
    if f.audience == "students" and current.get("role") == "student":
        p = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == current["sub"]).first()
        return bool(p) and (not f.programme or (p.department or "").upper() == f.programme) and \
            (not f.study_year or p.year == f.study_year)
    if f.audience == "faculty" and current.get("role") == "faculty":
        return not f.programme or (current.get("department") or "").upper() == f.programme
    return False


@router.get("/mine", summary="Feedback forms waiting for me")
def mine(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    out = []
    for f in db.query(FeedbackFormModel).filter(FeedbackFormModel.status == "open", FeedbackFormModel.audience.in_(["students", "faculty"])):
        if _eligible(db, current, f):
            done = db.query(FeedbackResponseModel.id).filter(FeedbackResponseModel.form_id == f.id,
                                                             FeedbackResponseModel.respondent == _respondent(f, current["sub"])).first()
            out.append({**_form_out(f, 0), "answered": bool(done)})
    return out


Answer = Union[int, str]


class AnswersIn(BaseModel):
    answers: Dict[str, Answer]


def _clean(f: FeedbackFormModel, answers: dict) -> dict:
    out = {}
    for q in f.questions:
        v = answers.get(q["id"])
        if q["type"] == R:
            if not isinstance(v, int) or not 1 <= v <= 5:
                raise HTTPException(status_code=422, detail=f"Rate every statement 1-5 ('{q['text'][:40]}...')")
            out[q["id"]] = v
        elif isinstance(v, str) and v.strip():
            out[q["id"]] = v.strip()[:1000]
    return out


@router.post("/forms/{form_id}/respond", summary="Answer a form (anonymous: only a one-way key stops a second answer)")
def respond(form_id: int, body: AnswersIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    f = _form(db, form_id)
    if not _eligible(db, current, f):
        raise HTTPException(status_code=403, detail="This form isn't open to you")
    key = _respondent(f, current["sub"])
    if db.query(FeedbackResponseModel.id).filter(FeedbackResponseModel.form_id == f.id, FeedbackResponseModel.respondent == key).first():
        raise HTTPException(status_code=409, detail="You have already given this feedback")
    db.add(FeedbackResponseModel(form_id=f.id, respondent=key, role=current.get("role"), answers=_clean(f, body.answers)))
    db.commit()
    return {"message": "Thank you: your feedback is recorded anonymously"}


@public_router.get("/public/{code}", summary="A public feedback form (alumni, employers, parents)")
def public_form(code: str, db: Session = Depends(get_db)):
    f = db.query(FeedbackFormModel).filter(FeedbackFormModel.public_code == code).first()
    if not f or f.status != "open":
        raise HTTPException(status_code=404, detail="This feedback form is closed or doesn't exist")
    return {"title": f.title, "kind": f.kind, "questions": f.questions, "programme": f.programme}


class PublicAnswersIn(AnswersIn):
    role: Literal["alumni", "employer", "parent"]


@public_router.post("/public/{code}", summary="Answer a public feedback form")
def public_respond(code: str, body: PublicAnswersIn, request: Request, db: Session = Depends(get_db)):
    public_limit.check_and_hit(client_ip(request), "Too many responses from this network. Please try later.")
    f = db.query(FeedbackFormModel).filter(FeedbackFormModel.public_code == code).first()
    if not f or f.status != "open" or (f.closes_at and datetime.utcnow() > f.closes_at):
        raise HTTPException(status_code=404, detail="This feedback form is closed or doesn't exist")
    db.add(FeedbackResponseModel(form_id=f.id, respondent=None, role=body.role, answers=_clean(f, body.answers)))
    db.commit()
    return {"message": "Thank you for your feedback"}


# ── Analysis and ATR ─────────────────────────────────────────────────────────────
def _stats(db: Session, f: FeedbackFormModel) -> dict:
    rows = [r.answers for r in db.query(FeedbackResponseModel).filter(FeedbackResponseModel.form_id == f.id)]
    out = {}
    for q in f.questions:
        vals = [a.get(q["id"]) for a in rows if a.get(q["id"]) is not None]
        if q["type"] == R:
            nums = [v for v in vals if isinstance(v, int)]
            out[q["id"]] = {"n": len(nums), "mean": round(sum(nums) / len(nums), 2) if nums else None,
                            "dist": [sum(1 for v in nums if v == k) for k in range(1, 6)]}
        else:
            out[q["id"]] = {"n": len(vals), "comments": [v for v in vals if isinstance(v, str)][-50:]}
    out["_n"] = len(rows)
    return out


@router.get("/forms/{form_id}/results", summary="A form's analysis (and its ATR)")
def results(form_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    f = _form(db, form_id)
    a = _access(db, current, f.programme)
    teacher = False
    if f.kind == "teaching" and f.course_id:
        c = db.get(ObeCourseModel, f.course_id)
        teacher = bool(c and c.coordinator == current["sub"])
    if not (a["manage"] or a["view"] or teacher):
        raise HTTPException(status_code=403, detail="Not yours to see")
    stats = _stats(db, f)
    if teacher and not a["manage"] and (f.status != "closed" or stats["_n"] < MIN_TEACHER):
        raise HTTPException(status_code=403, detail=f"Your feedback appears once the form closes with at least {MIN_TEACHER} responses")
    ratings = [stats[q["id"]]["mean"] for q in f.questions if q["type"] == R and stats[q["id"]]["mean"] is not None]
    rows = []
    for q in f.questions:
        s = stats[q["id"]]
        if q["type"] == T and not a["manage"]:
            continue                                       # comments: for those who manage feedback
        rows.append({**q, **s})
    atr = db.query(FeedbackATRModel).filter(FeedbackATRModel.form_id == f.id).first()
    return {**_form_out(f, stats["_n"]), "overall": round(sum(ratings) / len(ratings), 2) if ratings else None, "rows": rows,
            "atr": {"observations": atr.observations, "actions": atr.actions, "status": atr.status, "published": atr.published,
                    "approved_at": atr.approved_at.isoformat() if atr.approved_at else None} if atr else None,
            "can_manage": a["manage"], "can_approve": a["approve"]}


class ATRIn(BaseModel):
    observations: str = Field(..., min_length=10, max_length=6000)
    actions: str = Field(..., min_length=10, max_length=6000)


@router.put("/forms/{form_id}/atr", summary="Write the action-taken report")
def save_atr(form_id: int, body: ATRIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    f = _form(db, form_id)
    _need(db, current, f.programme)
    atr = db.query(FeedbackATRModel).filter(FeedbackATRModel.form_id == f.id).first() or FeedbackATRModel(form_id=f.id)
    if atr.status == "approved":
        raise HTTPException(status_code=409, detail="The IQAC has approved this ATR")
    atr.observations, atr.actions, atr.updated_by = body.observations.strip(), body.actions.strip(), current["sub"]
    db.add(atr)
    db.commit()
    return {"message": "ATR saved"}


class ApproveIn(BaseModel):
    approved: bool = True


@router.post("/forms/{form_id}/atr/approve", summary="Approve (or reopen) the ATR (IQAC)")
def approve_atr(form_id: int, body: ApproveIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    f = _form(db, form_id)
    _need(db, current, f.programme, "approve")
    atr = db.query(FeedbackATRModel).filter(FeedbackATRModel.form_id == f.id).first()
    if not atr:
        raise HTTPException(status_code=404, detail="Write the ATR first")
    atr.status = "approved" if body.approved else "draft"
    atr.approved_by, atr.approved_at = (current["sub"], datetime.utcnow()) if body.approved else (None, None)
    if not body.approved:
        atr.published = False
    db.commit()
    return {"message": "Approved" if body.approved else "Reopened"}


class PublishIn(BaseModel):
    published: bool


@router.post("/forms/{form_id}/atr/publish", summary="Publish the approved ATR on the website feed")
def publish_atr(form_id: int, body: PublishIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    f = _form(db, form_id)
    _need(db, current, f.programme, "approve")
    atr = db.query(FeedbackATRModel).filter(FeedbackATRModel.form_id == f.id).first()
    if not atr or atr.status != "approved":
        raise HTTPException(status_code=400, detail="Only an approved ATR can be published")
    if f.kind == "teaching" and body.published:
        raise HTTPException(status_code=400, detail="A teacher's individual feedback stays internal: publish the curriculum and facilities ATRs")
    atr.published, atr.published_at = body.published, datetime.utcnow() if body.published else None
    db.commit()
    return {"message": "Published" if body.published else "Unpublished"}


@public_router.get("/atr", summary="Published feedback analyses and action-taken reports (for the college website)")
def published_atrs(year: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(FeedbackATRModel, FeedbackFormModel).join(FeedbackFormModel, FeedbackFormModel.id == FeedbackATRModel.form_id).filter(
        FeedbackATRModel.published == True, FeedbackFormModel.kind != "teaching")  # noqa: E712  (teachers' own feedback stays internal)
    if year:
        q = q.filter(FeedbackFormModel.year == year)
    out = []
    for atr, f in q.order_by(FeedbackFormModel.year.desc()).all():
        stats = _stats(db, f)
        ratings = [stats[x["id"]]["mean"] for x in f.questions if x["type"] == R and stats[x["id"]]["mean"] is not None]
        out.append({"title": f.title, "kind": LABELS.get(f.kind, f.kind), "year": f.year, "programme": f.programme,
                    "responses": stats["_n"], "overall": round(sum(ratings) / len(ratings), 2) if ratings else None,
                    "observations": atr.observations, "actions": atr.actions})
    return out

