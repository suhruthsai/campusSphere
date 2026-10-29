"""
Outcome-based education: programme outcomes, course files (COs, CO-PO mapping, assessments, course-exit survey,
attainment) and PO attainment with the actions that close the loop (NBA criteria 2, 3, 7; NAAC 2.6).

  who   the accreditation workspace's people see everything (IQAC, management, NBA coordinators, HODs);
        the programme's NBA coordinator, its HOD, the IQAC and admins edit outcomes, rules and actions;
        a course's coordinator (or anyone who manages the programme) edits that course's COs, mapping, marks, survey
"""
import io
from datetime import date
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.accreditation import workspace as W
from backend.app.core.security import get_current_user
from backend.app.db.session import get_db
from backend.app.models.campus import UserModel
from backend.app.models.obe import (
    ObeActionModel, ObeAssessmentModel, ObeCOModel, ObeCourseModel, ObeMappingModel, ObeOutcomeModel,
    ObeQuestionModel, ObeSurveyModel,
)
from backend.app.models.services import RosterEntryModel
from backend.app.obe import attainment as A
from backend.app.student_services.workflow import academic_year

router = APIRouter()
MAX_SHEET_BYTES = 5 * 1024 * 1024


def _access(db: Session, current: dict, programme: str) -> dict:
    a = W.access(db, current)
    manage = a["edit_all"] or programme in a["programmes"]
    return {"view": a["view"] or _coordinates_any(db, current), "manage": manage}


def _coordinates_any(db: Session, current: dict) -> bool:
    return db.query(ObeCourseModel.id).filter(ObeCourseModel.coordinator == current["sub"]).first() is not None


def _need(db: Session, current: dict, programme: str, what: str = "view") -> dict:
    a = _access(db, current, programme)
    if not a[what]:
        raise HTTPException(status_code=403, detail="Only the IQAC, the programme's NBA coordinator / HOD, course coordinators and management")
    return a


def _course(db: Session, course_id: int) -> ObeCourseModel:
    c = db.get(ObeCourseModel, course_id)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return c


def _course_edit(db: Session, current: dict, c: ObeCourseModel) -> bool:
    return _access(db, current, c.programme)["manage"] or c.coordinator == current["sub"]


def _need_course_edit(db: Session, current: dict, c: ObeCourseModel):
    if not _course_edit(db, current, c):
        raise HTTPException(status_code=403, detail="Only this course's coordinator or the programme's NBA coordinator / HOD")


@router.get("/access", summary="What I can do with a programme's outcomes")
def access(programme: str = Query("IT", max_length=20), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    return {**_access(db, current, programme.upper()), "my_courses": [c.id for c in db.query(ObeCourseModel).filter(
        ObeCourseModel.coordinator == current["sub"])]}


# ── Programme outcomes ───────────────────────────────────────────────────────────
@router.get("/outcomes", summary="The programme's PEOs, POs and PSOs")
def outcomes(programme: str = Query("IT", max_length=20), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _need(db, current, programme.upper())
    rows = db.query(ObeOutcomeModel).filter(ObeOutcomeModel.programme == programme.upper()).order_by(ObeOutcomeModel.kind, ObeOutcomeModel.ord).all()
    return [{"id": o.id, "kind": o.kind, "code": o.code, "title": o.title, "text": o.text} for o in rows]


class OutcomeIn(BaseModel):
    programme: str = Field(..., max_length=20)
    kind: Literal["PEO", "PO", "PSO"]
    code: str = Field(..., pattern=r"^(PEO|PO|PSO)\d{1,2}$")
    title: Optional[str] = Field(None, max_length=120)
    text: str = Field(..., min_length=5, max_length=2000)


@router.put("/outcomes", summary="Add or reword a PEO / PO / PSO")
def save_outcome(body: OutcomeIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = body.programme.upper()
    _need(db, current, prog, "manage")
    if not body.code.startswith(body.kind):
        raise HTTPException(status_code=422, detail="The code must start with its kind (PO1, PSO2, PEO3)")
    o = db.query(ObeOutcomeModel).filter(ObeOutcomeModel.programme == prog, ObeOutcomeModel.code == body.code).first()
    if not o:
        o = ObeOutcomeModel(programme=prog, code=body.code, kind=body.kind, ord=int("".join(ch for ch in body.code if ch.isdigit())))
        db.add(o)
    o.title, o.text = body.title, body.text.strip()
    db.commit()
    return {"message": f"{body.code} saved"}


# ── Courses ──────────────────────────────────────────────────────────────────────
@router.get("/years", summary="Academic years with course offerings")
def years(programme: str = Query("IT", max_length=20), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _need(db, current, programme.upper())
    have = sorted({y for (y,) in db.query(ObeCourseModel.year).filter(ObeCourseModel.programme == programme.upper()).distinct()}, reverse=True)
    return {"years": have, "current": academic_year()}


@router.get("/courses", summary="Course offerings of a year with their CO attainment")
def courses(programme: str = Query("IT", max_length=20), year: Optional[str] = None, db: Session = Depends(get_db),
            current: dict = Depends(get_current_user)):
    prog = programme.upper()
    a = _need(db, current, prog)
    q = db.query(ObeCourseModel).filter(ObeCourseModel.programme == prog)
    if year:
        q = q.filter(ObeCourseModel.year == year)
    rows = q.order_by(ObeCourseModel.semester, ObeCourseModel.code).all()
    names = {u.id: u.name for u in db.query(UserModel).filter(UserModel.id.in_([c.coordinator for c in rows if c.coordinator]))}
    s = A.settings(db, prog)
    out = []
    for c in rows:
        att = A.course_attainment(db, c, s)
        out.append({"id": c.id, "code": c.code, "name": c.name, "semester": c.semester, "year": c.year, "kind": c.kind,
                    "coordinator": names.get(c.coordinator), "cos": len(att["cos"]), "assessments": att["assessments"],
                    "attainment": att["average"], "mapped": bool(att["po"]) or db.query(ObeMappingModel.id).filter(ObeMappingModel.course_id == c.id).first() is not None,
                    "can_edit": a["manage"] or c.coordinator == current["sub"]})
    return out


class CourseIn(BaseModel):
    programme: str = Field(..., max_length=20)
    code: str = Field(..., min_length=3, max_length=20)
    name: str = Field(..., min_length=2, max_length=120)
    semester: int = Field(..., ge=1, le=8)
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    kind: Literal["theory", "lab", "project"] = "theory"
    credits: Optional[float] = Field(None, ge=0, le=20)
    coordinator: Optional[str] = Field(None, max_length=60)
    students: Optional[int] = Field(None, ge=0, le=2000)


@router.post("/courses", summary="Add a course offering (programme's NBA coordinator / HOD / IQAC)")
def add_course(body: CourseIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = body.programme.upper()
    _need(db, current, prog, "manage")
    if db.query(ObeCourseModel.id).filter(ObeCourseModel.programme == prog, ObeCourseModel.code == body.code.upper(),
                                          ObeCourseModel.year == body.year).first():
        raise HTTPException(status_code=409, detail="This course is already offered that year")
    if body.coordinator and not db.get(UserModel, body.coordinator):
        raise HTTPException(status_code=422, detail="Unknown course coordinator")
    c = ObeCourseModel(**body.model_dump(exclude={"programme", "code"}), programme=prog, code=body.code.upper())
    db.add(c)
    db.commit()
    return {"id": c.id, "message": f"{c.code} added for {c.year}"}


class CoursePatch(BaseModel):
    coordinator: Optional[str] = Field(None, max_length=60)
    students: Optional[int] = Field(None, ge=0, le=2000)


@router.patch("/courses/{course_id}", summary="Change a course offering's coordinator or student count")
def update_course(course_id: int, body: CoursePatch, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    c = _course(db, course_id)
    _need(db, current, c.programme, "manage")
    if body.coordinator is not None:
        if body.coordinator and not db.get(UserModel, body.coordinator):
            raise HTTPException(status_code=422, detail="Unknown course coordinator")
        c.coordinator = body.coordinator or None
    if body.students is not None:
        c.students = body.students
    db.commit()
    return {"message": "Saved"}


@router.delete("/courses/{course_id}", summary="Remove a course offering and its OBE records")
def delete_course(course_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    c = _course(db, course_id)
    _need(db, current, c.programme, "manage")
    asm = [a for (a,) in db.query(ObeAssessmentModel.id).filter(ObeAssessmentModel.course_id == c.id)]
    db.query(ObeQuestionModel).filter(ObeQuestionModel.assessment_id.in_(asm)).delete(synchronize_session=False)
    for model in (ObeAssessmentModel, ObeSurveyModel, ObeMappingModel, ObeCOModel):
        db.query(model).filter(model.course_id == c.id).delete(synchronize_session=False)
    db.delete(c)
    db.commit()
    return {"message": "Removed"}


@router.get("/courses/{course_id}", summary="The course file: COs, mapping, assessments, survey, attainment")
def course_file(course_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    c = _course(db, course_id)
    _need(db, current, c.programme)
    s = A.settings(db, c.programme)
    att = A.course_attainment(db, c, s)
    mapping = db.query(ObeMappingModel).filter(ObeMappingModel.course_id == c.id).all()
    outs = db.query(ObeOutcomeModel).filter(ObeOutcomeModel.programme == c.programme, ObeOutcomeModel.kind.in_(["PO", "PSO"])).order_by(
        ObeOutcomeModel.kind, ObeOutcomeModel.ord).all()
    assessments = []
    for asm in db.query(ObeAssessmentModel).filter(ObeAssessmentModel.course_id == c.id).order_by(ObeAssessmentModel.held_on, ObeAssessmentModel.id):
        qs = db.query(ObeQuestionModel).filter(ObeQuestionModel.assessment_id == asm.id).order_by(ObeQuestionModel.id).all()
        assessments.append({"id": asm.id, "name": asm.name, "kind": asm.kind, "held_on": asm.held_on.isoformat() if asm.held_on else None,
                            "students": asm.students, "source": asm.source,
                            "questions": [{"label": q.label, "co": q.co_code, "max": q.max_marks, "attempted": q.attempted,
                                           "reached": q.reached, "mean": round(q.mean, 2) if q.mean is not None else None} for q in qs]})
    coord = db.get(UserModel, c.coordinator) if c.coordinator else None
    surveys = {x.co_code: {"responses": x.responses, "mean": x.mean} for x in db.query(ObeSurveyModel).filter(ObeSurveyModel.course_id == c.id)}
    return {"id": c.id, "programme": c.programme, "code": c.code, "name": c.name, "semester": c.semester, "year": c.year,
            "kind": c.kind, "credits": c.credits, "students": c.students, "coordinator": coord.name if coord else None,
            "outcomes": [{"code": o.code, "kind": o.kind, "title": o.title} for o in outs],
            "mapping": [{"co": m.co_code, "outcome": m.outcome, "strength": m.strength} for m in mapping],
            "assessments": assessments, "surveys": surveys, "attainment": att, "settings": A.settings_out(s),
            "can_edit": _course_edit(db, current, c)}


class COIn(BaseModel):
    code: str = Field(..., pattern=r"^CO\d{1,2}$")
    text: str = Field(..., min_length=5, max_length=600)
    bloom: Optional[Literal["K1", "K2", "K3", "K4", "K5", "K6"]] = None


@router.put("/courses/{course_id}/cos", summary="Set the course's COs")
def save_cos(course_id: int, body: List[COIn], db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    c = _course(db, course_id)
    _need_course_edit(db, current, c)
    if not 1 <= len(body) <= 12 or len({x.code for x in body}) != len(body):
        raise HTTPException(status_code=422, detail="Give 1-12 COs with different codes")
    keep = {x.code for x in body}
    used = {q.co_code for q in db.query(ObeQuestionModel).join(ObeAssessmentModel).filter(ObeAssessmentModel.course_id == c.id)}
    if used - keep:
        raise HTTPException(status_code=409, detail=f"{', '.join(sorted(used - keep))} is tested in an imported assessment: remove that assessment first")
    db.query(ObeCOModel).filter(ObeCOModel.course_id == c.id, ObeCOModel.code.notin_(keep)).delete(synchronize_session=False)
    db.query(ObeMappingModel).filter(ObeMappingModel.course_id == c.id, ObeMappingModel.co_code.notin_(keep)).delete(synchronize_session=False)
    for x in body:
        co = db.query(ObeCOModel).filter(ObeCOModel.course_id == c.id, ObeCOModel.code == x.code).first() or ObeCOModel(course_id=c.id, code=x.code)
        co.text, co.bloom = x.text.strip(), x.bloom
        db.add(co)
    db.commit()
    return {"message": f"{len(body)} COs saved"}


class MapIn(BaseModel):
    co: str = Field(..., pattern=r"^CO\d{1,2}$")
    outcome: str = Field(..., pattern=r"^(PO|PSO)\d{1,2}$")
    strength: int = Field(..., ge=0, le=3)            # 0 clears the cell


@router.put("/courses/{course_id}/mapping", summary="Set the CO-PO / PSO mapping (1 low, 2 medium, 3 high; 0 clears)")
def save_mapping(course_id: int, body: List[MapIn], db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    c = _course(db, course_id)
    _need_course_edit(db, current, c)
    cos = {x.code for x in db.query(ObeCOModel).filter(ObeCOModel.course_id == c.id)}
    outs = {o.code for o in db.query(ObeOutcomeModel).filter(ObeOutcomeModel.programme == c.programme)}
    for m in body:
        if m.co not in cos or m.outcome not in outs:
            raise HTTPException(status_code=422, detail=f"{m.co} / {m.outcome} isn't a CO of this course / an outcome of {c.programme}")
    for m in body:
        row = db.query(ObeMappingModel).filter(ObeMappingModel.course_id == c.id, ObeMappingModel.co_code == m.co,
                                               ObeMappingModel.outcome == m.outcome).first()
        if m.strength == 0:
            if row:
                db.delete(row)
            continue
        row = row or ObeMappingModel(course_id=c.id, co_code=m.co, outcome=m.outcome)
        row.strength = m.strength
        db.add(row)
    db.commit()
    return {"message": "Mapping saved"}


@router.get("/courses/{course_id}/template", summary="A marks sheet for this course: questions row, CO row, maximum marks row, roll numbers")
def template(course_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    c = _course(db, course_id)
    _need(db, current, c.programme)
    from openpyxl import Workbook
    cos = [x.code for x in db.query(ObeCOModel).filter(ObeCOModel.course_id == c.id).order_by(ObeCOModel.code)] or ["CO1"]
    wb = Workbook()
    ws = wb.active
    ws.title = "Marks"
    labels = [f"Q{i + 1}" for i in range(len(cos))]
    ws.append(["Roll No"] + labels)
    ws.append(["CO"] + cos)
    ws.append(["Max marks"] + [5] * len(cos))
    rolls = []
    if c.year == academic_year() and c.semester:
        year_of_study = (c.semester + 1) // 2
        rolls = [r.roll_no for r in db.query(RosterEntryModel).filter(RosterEntryModel.department == c.programme,
                                                                      RosterEntryModel.year == year_of_study).order_by(RosterEntryModel.roll_no)]
    for r in rolls:
        ws.append([r])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f'attachment; filename="{c.code}-{c.year}-marks-template.xlsx"'})


@router.post("/courses/{course_id}/assessments", summary="Import an assessment's marks sheet (only per-question totals are kept)")
def import_assessment(course_id: int, name: str = Form(..., min_length=2, max_length=60),
                      kind: Literal["internal", "external"] = Form("internal"), held_on: Optional[date] = Form(None),
                      file: UploadFile = File(...), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    c = _course(db, course_id)
    _need_course_edit(db, current, c)
    data = file.file.read(MAX_SHEET_BYTES + 1)
    if len(data) > MAX_SHEET_BYTES:
        raise HTTPException(status_code=422, detail="Marks sheets must be 5 MB or smaller")
    cos = {x.code for x in db.query(ObeCOModel).filter(ObeCOModel.course_id == c.id)}
    if not cos:
        raise HTTPException(status_code=400, detail="Add the course's COs first")
    s = A.settings(db, c.programme)
    try:
        questions, students = A.read_marks_sheet(data, file.filename or "", cos, s.target_pct)
    except A.SheetError as e:
        raise HTTPException(status_code=422, detail=str(e))
    del data                                            # individual marks are not kept
    asm = ObeAssessmentModel(course_id=c.id, name=name.strip(), kind=kind, held_on=held_on, students=students,
                             source=(file.filename or "")[:120], imported_by=current["sub"])
    db.add(asm)
    db.flush()
    for q in questions:
        db.add(ObeQuestionModel(assessment_id=asm.id, label=q.label, co_code=q.co, max_marks=q.max_marks, attempted=q.attempted,
                                reached=q.reached, mean=q.total / q.attempted if q.attempted else None))
    db.commit()
    return {"message": f"{name}: {len(questions)} questions from {students} students imported (totals only)",
            "attainment": A.course_attainment(db, c, s)}


@router.delete("/assessments/{assessment_id}", summary="Remove an imported assessment")
def delete_assessment(assessment_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    asm = db.get(ObeAssessmentModel, assessment_id)
    if not asm:
        raise HTTPException(status_code=404, detail="Not found")
    _need_course_edit(db, current, _course(db, asm.course_id))
    db.query(ObeQuestionModel).filter(ObeQuestionModel.assessment_id == asm.id).delete(synchronize_session=False)
    db.delete(asm)
    db.commit()
    return {"message": "Removed"}


class SurveyIn(BaseModel):
    co: str = Field(..., pattern=r"^CO\d{1,2}$")
    responses: int = Field(..., ge=0, le=5000)
    mean: float = Field(..., ge=1, le=5)


@router.put("/courses/{course_id}/survey", summary="Course-exit survey results per CO (mean rating 1-5)")
def save_survey(course_id: int, body: List[SurveyIn], db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    c = _course(db, course_id)
    _need_course_edit(db, current, c)
    cos = {x.code for x in db.query(ObeCOModel).filter(ObeCOModel.course_id == c.id)}
    for x in body:
        if x.co not in cos:
            raise HTTPException(status_code=422, detail=f"{x.co} isn't a CO of this course")
        row = db.query(ObeSurveyModel).filter(ObeSurveyModel.course_id == c.id, ObeSurveyModel.co_code == x.co).first() or \
            ObeSurveyModel(course_id=c.id, co_code=x.co)
        row.responses, row.mean = x.responses, x.mean
        db.add(row)
    db.commit()
    return {"message": "Survey saved"}


# ── Programme attainment, rules, actions ─────────────────────────────────────────
@router.get("/attainment", summary="PO / PSO attainment of a year, the courses behind it, and the gaps")
def attainment(programme: str = Query("IT", max_length=20), year: Optional[str] = None, db: Session = Depends(get_db),
               current: dict = Depends(get_current_user)):
    prog = programme.upper()
    _need(db, current, prog)
    if not year:
        have = sorted({y for (y,) in db.query(ObeCourseModel.year).filter(ObeCourseModel.programme == prog).distinct()}, reverse=True)
        done = [y for y in have if y < academic_year()]
        year = (done or have or [academic_year()])[0]
    return A.programme_attainment(db, prog, year)


class SettingsIn(BaseModel):
    programme: str = Field(..., max_length=20)
    target_pct: float = Field(..., ge=30, le=90)
    level1_pct: float = Field(..., ge=10, le=100)
    level2_pct: float = Field(..., ge=10, le=100)
    level3_pct: float = Field(..., ge=10, le=100)
    internal_weight: float = Field(..., ge=0, le=1)
    direct_weight: float = Field(..., ge=0, le=1)
    po_target: float = Field(..., ge=0.5, le=3)


@router.put("/settings", summary="Set the programme's attainment rules")
def save_settings(body: SettingsIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = body.programme.upper()
    _need(db, current, prog, "manage")
    if not body.level1_pct < body.level2_pct < body.level3_pct:
        raise HTTPException(status_code=422, detail="Levels must rise: level 1 < level 2 < level 3")
    s = A.settings(db, prog)
    for k in ("target_pct", "level1_pct", "level2_pct", "level3_pct", "internal_weight", "direct_weight", "po_target"):
        setattr(s, k, getattr(body, k))
    s.updated_by = current["sub"]
    db.commit()
    return A.settings_out(s)


def _action_out(a: ObeActionModel) -> dict:
    return {"id": a.id, "year": a.year, "outcome": a.outcome, "attained": a.attained, "target": a.target,
            "observation": a.observation, "action": a.action, "responsible": a.responsible,
            "due": a.due.isoformat() if a.due else None, "status": a.status, "result": a.result}


@router.get("/actions", summary="Actions on POs / PSOs below target (closing the loop)")
def actions(programme: str = Query("IT", max_length=20), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _need(db, current, programme.upper())
    return [_action_out(a) for a in db.query(ObeActionModel).filter(ObeActionModel.programme == programme.upper())
            .order_by(ObeActionModel.year.desc(), ObeActionModel.outcome)]


class ActionIn(BaseModel):
    programme: str = Field(..., max_length=20)
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    outcome: str = Field(..., pattern=r"^(PO|PSO)\d{1,2}$")
    attained: Optional[float] = None
    target: Optional[float] = None
    observation: str = Field(..., min_length=5, max_length=2000)
    action: str = Field(..., min_length=5, max_length=2000)
    responsible: Optional[str] = Field(None, max_length=120)
    due: Optional[date] = None
    status: Literal["planned", "in_progress", "done"] = "planned"
    result: Optional[str] = Field(None, max_length=2000)


@router.post("/actions", summary="Record an action for a PO / PSO gap")
def add_action(body: ActionIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _need(db, current, body.programme.upper(), "manage")
    a = ObeActionModel(**body.model_dump(exclude={"programme"}), programme=body.programme.upper(), created_by=current["sub"])
    db.add(a)
    db.commit()
    return _action_out(a)


class ActionPatch(BaseModel):
    status: Literal["planned", "in_progress", "done"]
    result: Optional[str] = Field(None, max_length=2000)


@router.patch("/actions/{action_id}", summary="Update an action's status and its effect")
def update_action(action_id: int, body: ActionPatch, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = db.get(ObeActionModel, action_id)
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    _need(db, current, a.programme, "manage")
    a.status, a.result = body.status, body.result if body.result is not None else a.result
    db.commit()
    return _action_out(a)
