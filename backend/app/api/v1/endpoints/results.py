"""
Examination results as the Exam Cell's totals: each semester's appeared / passed and the dates (NAAC 2.5.1,
2.5.2, 2.6.3), and each admission batch from intake to graduation (NBA 4.1 enrolment ratio, 4.2 success index,
4.3-4.4 academic performance index). No student's marks or grades are stored.

  enrolment ratio  first-year admitted / sanctioned intake
  success index    graduated in the stipulated period / (first-year admitted + lateral entries); without backlogs
                   and in total
  API              mean CGPA (out of 10) of the year's successful students x successful / appeared
  who              the Controller of Examinations, the IQAC, admins, and the programme's HOD / NBA coordinator
"""
from collections import defaultdict
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.accreditation import workspace as W
from backend.app.core.roles import user_roles
from backend.app.core.security import get_current_user
from backend.app.db.session import get_db
from backend.app.models.feedback import BatchOutcomeModel, ResultSummaryModel

router = APIRouter()


def _access(db: Session, current: dict, programme: str) -> dict:
    a = W.access(db, current)
    manage = a["edit_all"] or user_roles(db, current)["coe"] or programme in a["programmes"]
    return {"manage": manage, "view": manage or a["view"]}


def _need(db, current, programme, what="view"):
    a = _access(db, current, programme)
    if not a[what]:
        raise HTTPException(status_code=403, detail="Only the Exam Cell, the IQAC, the programme's HOD / NBA coordinator and management")
    return a


def _summary_out(r: ResultSummaryModel) -> dict:
    return {"id": r.id, "programme": r.programme, "year": r.year, "semester": r.semester, "exam": r.exam,
            "last_exam_on": r.last_exam_on.isoformat() if r.last_exam_on else None,
            "declared_on": r.declared_on.isoformat() if r.declared_on else None,
            "days_to_declare": (r.declared_on - r.last_exam_on).days if r.declared_on and r.last_exam_on else None,
            "appeared": r.appeared, "passed": r.passed, "pass_pct": round(100 * r.passed / r.appeared, 1) if r.appeared else None,
            "distinction": r.distinction, "first_class": r.first_class, "mean_sgpa": r.mean_sgpa, "complaints": r.complaints}


def _batch_out(b: BatchOutcomeModel) -> dict:
    base = b.admitted + (b.lateral or 0)
    grad = (b.graduated_clean or 0) + (b.graduated_backlog or 0) if b.graduated_clean is not None else None
    api = lambda cg, p, a: round(cg * p / a, 2) if cg and p is not None and a else None  # noqa: E731
    return {"id": b.id, "programme": b.programme, "batch": b.batch, "graduating": b.batch + 4, "intake": b.intake,
            "admitted": b.admitted, "lateral": b.lateral, "graduated_clean": b.graduated_clean, "graduated_backlog": b.graduated_backlog,
            "enrolment_ratio": round(100 * b.admitted / b.intake, 1) if b.intake else None,
            "success_clean": round(b.graduated_clean / base, 3) if b.graduated_clean is not None and base else None,
            "success_total": round(grad / base, 3) if grad is not None and base else None,
            "cgpa_2nd": b.cgpa_2nd, "passed_2nd": b.passed_2nd, "appeared_2nd": b.appeared_2nd,
            "api_2nd": api(b.cgpa_2nd, b.passed_2nd, b.appeared_2nd),
            "cgpa_3rd": b.cgpa_3rd, "passed_3rd": b.passed_3rd, "appeared_3rd": b.appeared_3rd,
            "api_3rd": api(b.cgpa_3rd, b.passed_3rd, b.appeared_3rd)}


def overview(db: Session, programme: str) -> dict:
    """Year-wise pass %, days to declare and evaluation grievances; batch-wise NBA 4.1-4.4 figures."""
    sums = db.query(ResultSummaryModel).filter(ResultSummaryModel.programme == programme).order_by(
        ResultSummaryModel.year, ResultSummaryModel.semester).all()
    by_year = defaultdict(lambda: {"appeared": 0, "passed": 0, "days": [], "complaints": 0})
    for r in sums:
        if r.exam != "regular":
            continue
        y = by_year[r.year]
        y["appeared"] += r.appeared
        y["passed"] += r.passed
        y["complaints"] += r.complaints or 0
        if r.declared_on and r.last_exam_on:
            y["days"].append((r.declared_on - r.last_exam_on).days)
    years = [{"year": k, "appeared": v["appeared"], "passed": v["passed"],
              "pass_pct": round(100 * v["passed"] / v["appeared"], 1) if v["appeared"] else None,
              "days_to_declare": round(sum(v["days"]) / len(v["days"]), 1) if v["days"] else None,
              "complaints_pct": round(100 * v["complaints"] / v["appeared"], 2) if v["appeared"] else None}
             for k, v in sorted(by_year.items())]
    batches = [_batch_out(b) for b in db.query(BatchOutcomeModel).filter(BatchOutcomeModel.programme == programme).order_by(BatchOutcomeModel.batch)]
    return {"programme": programme, "years": years, "summaries": [_summary_out(r) for r in sums], "batches": batches}


@router.get("/overview", summary="Results by year and by batch, with the NAAC / NBA figures")
def get_overview(programme: str = Query("IT", max_length=20), db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = programme.upper()
    a = _need(db, current, prog)
    return {**overview(db, prog), "can_manage": a["manage"]}


class SummaryIn(BaseModel):
    programme: str = Field(..., max_length=20)
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    semester: int = Field(..., ge=1, le=8)
    exam: Literal["regular", "supplementary"] = "regular"
    last_exam_on: Optional[date] = None
    declared_on: Optional[date] = None
    appeared: int = Field(..., ge=0, le=5000)
    passed: int = Field(..., ge=0, le=5000)
    distinction: Optional[int] = Field(None, ge=0)
    first_class: Optional[int] = Field(None, ge=0)
    mean_sgpa: Optional[float] = Field(None, ge=0, le=10)
    complaints: Optional[int] = Field(None, ge=0)


@router.put("/summaries", summary="Enter / correct a semester examination's results (Exam Cell)")
def save_summary(body: SummaryIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = body.programme.upper()
    _need(db, current, prog, "manage")
    if body.passed > body.appeared:
        raise HTTPException(status_code=422, detail="More passed than appeared")
    if body.declared_on and body.last_exam_on and body.declared_on < body.last_exam_on:
        raise HTTPException(status_code=422, detail="Results can't be declared before the last examination")
    if (body.distinction or 0) + (body.first_class or 0) > body.passed:
        raise HTTPException(status_code=422, detail="Distinctions and first classes can't exceed those who passed")
    r = db.query(ResultSummaryModel).filter(ResultSummaryModel.programme == prog, ResultSummaryModel.year == body.year,
                                            ResultSummaryModel.semester == body.semester, ResultSummaryModel.exam == body.exam).first()
    r = r or ResultSummaryModel(programme=prog, year=body.year, semester=body.semester, exam=body.exam)
    for k in ("last_exam_on", "declared_on", "appeared", "passed", "distinction", "first_class", "mean_sgpa", "complaints"):
        setattr(r, k, getattr(body, k))
    r.entered_by = current["sub"]
    db.add(r)
    db.commit()
    return _summary_out(r)


class BatchIn(BaseModel):
    programme: str = Field(..., max_length=20)
    batch: int = Field(..., ge=2000, le=2100)
    intake: int = Field(..., ge=1, le=2000)
    admitted: int = Field(..., ge=0, le=2000)
    lateral: int = Field(0, ge=0, le=500)
    graduated_clean: Optional[int] = Field(None, ge=0)
    graduated_backlog: Optional[int] = Field(None, ge=0)
    cgpa_2nd: Optional[float] = Field(None, ge=0, le=10)
    passed_2nd: Optional[int] = Field(None, ge=0)
    appeared_2nd: Optional[int] = Field(None, ge=0)
    cgpa_3rd: Optional[float] = Field(None, ge=0, le=10)
    passed_3rd: Optional[int] = Field(None, ge=0)
    appeared_3rd: Optional[int] = Field(None, ge=0)


@router.put("/batches", summary="Enter / correct an admission batch's figures (Exam Cell / Admin Office)")
def save_batch(body: BatchIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    prog = body.programme.upper()
    _need(db, current, prog, "manage")
    if (body.graduated_clean or 0) + (body.graduated_backlog or 0) > body.admitted + body.lateral:
        raise HTTPException(status_code=422, detail="More graduates than students admitted")
    for p, a in ((body.passed_2nd, body.appeared_2nd), (body.passed_3rd, body.appeared_3rd)):
        if p is not None and a is not None and p > a:
            raise HTTPException(status_code=422, detail="More successful than appeared")
    b = db.query(BatchOutcomeModel).filter(BatchOutcomeModel.programme == prog, BatchOutcomeModel.batch == body.batch).first()
    b = b or BatchOutcomeModel(programme=prog, batch=body.batch)
    for k, v in body.model_dump(exclude={"programme", "batch"}).items():
        setattr(b, k, v)
    b.entered_by = current["sub"]
    db.add(b)
    db.commit()
    return _batch_out(b)
