"""
Attainment of course outcomes (COs) and programme outcomes (POs / PSOs), the way NBA's SAR asks for it.

  question     a student 'reaches' a question when they score at least target_pct (60%) of its marks
  CO, per kind share of students reaching the CO's questions (all internal assessments together; the SEE apart)
               -> level 3 at >= level3_pct (70%), 2 at >= level2_pct (60%), 1 at >= level1_pct (50%), else 0
  direct       internal_weight x CIE level + (1 - internal_weight) x SEE level (whichever exists if one is missing)
  indirect     course-exit survey: mean rating 1-5 scaled to 0-3 (mean / 5 x 3)
  CO           direct_weight x direct + (1 - direct_weight) x indirect (direct only without a survey)
  PO / PSO     over every mapped CO: sum(CO level x strength) / sum(strength); a course's own contribution likewise
  gap          a PO / PSO below po_target (2.0) needs an action (NBA 7.1)

Marks sheets (import): row 1 question labels, row 2 the CO each tests, row 3 its maximum marks, then one row per
student: roll number and marks (blank or AB = not attempted). Only totals per question are kept.
"""
import csv
import io
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from backend.app.models.obe import (
    ObeAssessmentModel, ObeCOModel, ObeCourseModel, ObeMappingModel, ObeOutcomeModel, ObeQuestionModel,
    ObeSettingsModel, ObeSurveyModel,
)


def settings(db: Session, programme: str) -> ObeSettingsModel:
    s = db.get(ObeSettingsModel, programme)
    if not s:
        s = ObeSettingsModel(programme=programme)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def settings_out(s: ObeSettingsModel) -> dict:
    return {k: getattr(s, k) for k in ("programme", "target_pct", "level1_pct", "level2_pct", "level3_pct",
                                       "internal_weight", "direct_weight", "po_target")}


def level(pct: Optional[float], s: ObeSettingsModel) -> Optional[int]:
    if pct is None:
        return None
    return 3 if pct >= s.level3_pct else 2 if pct >= s.level2_pct else 1 if pct >= s.level1_pct else 0


def _r(x, n=2):
    return round(x, n) if x is not None else None


# ── One course ───────────────────────────────────────────────────────────────────
def course_attainment(db: Session, course: ObeCourseModel, s: Optional[ObeSettingsModel] = None) -> dict:
    s = s or settings(db, course.programme)
    cos = db.query(ObeCOModel).filter(ObeCOModel.course_id == course.id).order_by(ObeCOModel.code).all()
    assessments = db.query(ObeAssessmentModel).filter(ObeAssessmentModel.course_id == course.id).all()
    kind_of = {a.id: a.kind for a in assessments}
    tally = defaultdict(lambda: {"internal": [0, 0], "external": [0, 0]})     # co -> kind -> [reached, attempted]
    for q in db.query(ObeQuestionModel).filter(ObeQuestionModel.assessment_id.in_(list(kind_of))).all():
        t = tally[q.co_code][kind_of[q.assessment_id]]
        t[0] += q.reached
        t[1] += q.attempted
    surveys = {x.co_code: x for x in db.query(ObeSurveyModel).filter(ObeSurveyModel.course_id == course.id)}
    out = []
    for co in cos:
        t = tally.get(co.code)
        pct_i = 100 * t["internal"][0] / t["internal"][1] if t and t["internal"][1] else None
        pct_e = 100 * t["external"][0] / t["external"][1] if t and t["external"][1] else None
        li, le = level(pct_i, s), level(pct_e, s)
        if li is not None and le is not None:
            direct = s.internal_weight * li + (1 - s.internal_weight) * le
        else:
            direct = li if li is not None else le
        sv = surveys.get(co.code)
        indirect = sv.mean / 5 * 3 if sv and sv.mean else None
        if direct is not None and indirect is not None:
            final = s.direct_weight * direct + (1 - s.direct_weight) * indirect
        else:
            final = direct if direct is not None else indirect
        out.append({"code": co.code, "text": co.text, "bloom": co.bloom,
                    "internal_pct": _r(pct_i, 1), "internal_level": li, "external_pct": _r(pct_e, 1), "external_level": le,
                    "direct": _r(direct), "survey_mean": _r(sv.mean) if sv and sv.mean else None, "indirect": _r(indirect),
                    "attainment": _r(final)})
    mapping = db.query(ObeMappingModel).filter(ObeMappingModel.course_id == course.id).all()
    co_level = {c["code"]: c["attainment"] for c in out}
    contrib = defaultdict(lambda: [0.0, 0])
    for m in mapping:
        if co_level.get(m.co_code) is not None:
            contrib[m.outcome][0] += co_level[m.co_code] * m.strength
            contrib[m.outcome][1] += m.strength
    po = {k: _r(v[0] / v[1]) for k, v in contrib.items() if v[1]}
    measured = [c["attainment"] for c in out if c["attainment"] is not None]
    return {"cos": out, "po": po, "average": _r(sum(measured) / len(measured)) if measured else None,
            "measured": len(measured), "assessments": len(assessments)}


# ── The programme ────────────────────────────────────────────────────────────────
def programme_attainment(db: Session, programme: str, year: str) -> dict:
    """Every PO / PSO for an academic year, from all its course offerings, with the courses behind each."""
    s = settings(db, programme)
    outcomes = db.query(ObeOutcomeModel).filter(ObeOutcomeModel.programme == programme,
                                                ObeOutcomeModel.kind.in_(["PO", "PSO"])).order_by(ObeOutcomeModel.ord).all()
    courses = db.query(ObeCourseModel).filter(ObeCourseModel.programme == programme, ObeCourseModel.year == year).all()
    total = defaultdict(lambda: [0.0, 0])
    per_course = []
    for c in courses:
        a = course_attainment(db, c, s)
        mapping = db.query(ObeMappingModel).filter(ObeMappingModel.course_id == c.id).all()
        co_level = {x["code"]: x["attainment"] for x in a["cos"]}
        for m in mapping:
            if co_level.get(m.co_code) is not None:
                total[m.outcome][0] += co_level[m.co_code] * m.strength
                total[m.outcome][1] += m.strength
        per_course.append({"id": c.id, "code": c.code, "name": c.name, "semester": c.semester, "po": a["po"],
                           "average": a["average"], "measured": a["measured"], "cos": len(a["cos"])})
    rows = []
    for o in outcomes:
        v = total.get(o.code)
        att = _r(v[0] / v[1]) if v and v[1] else None
        rows.append({"code": o.code, "kind": o.kind, "title": o.title, "attainment": att, "target": s.po_target,
                     "met": att is not None and att >= s.po_target,
                     "courses": sum(1 for pc in per_course if o.code in pc["po"])})
    return {"programme": programme, "year": year, "settings": settings_out(s), "outcomes": rows,
            "courses": sorted(per_course, key=lambda x: (x["semester"] or 0, x["code"])),
            "gaps": [r for r in rows if r["attainment"] is not None and not r["met"]]}


# ── Marks sheet ──────────────────────────────────────────────────────────────────
class SheetError(ValueError):
    pass


@dataclass
class SheetQuestion:
    label: str
    co: str
    max_marks: float
    attempted: int = 0
    reached: int = 0
    total: float = 0.0


def _rows(data: bytes, filename: str) -> list:
    name = (filename or "").lower()
    if name.endswith(".csv"):
        text = data.decode("utf-8-sig", errors="replace")
        return [[c.strip() for c in r] for r in csv.reader(io.StringIO(text))]
    if name.endswith(".xlsx") and data[:4] == b"PK\x03\x04":
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        ws = wb.worksheets[0]
        return [["" if v is None else str(v).strip() for v in r] for r in ws.iter_rows(values_only=True)]
    raise SheetError("Upload the marks sheet as .xlsx or .csv")


def read_marks_sheet(data: bytes, filename: str, cos: set, target_pct: float) -> tuple[list, int]:
    """(questions with totals, students) from a marks sheet. Individual marks are read here and not kept."""
    rows = [r for r in _rows(data, filename) if any(c for c in r)]
    if len(rows) < 4:
        raise SheetError("The sheet needs 3 header rows (questions, COs, maximum marks) and at least one student")
    labels, co_row, max_row = rows[0], rows[1], rows[2]
    qs = []
    for i in range(1, len(labels)):
        if not labels[i]:
            continue
        co = (co_row[i] if i < len(co_row) else "").upper().replace(" ", "")
        if co not in cos:
            raise SheetError(f"Question {labels[i]}: '{co or 'blank'}' is not one of this course's COs ({', '.join(sorted(cos))})")
        try:
            mx = float(max_row[i])
        except (ValueError, IndexError):
            raise SheetError(f"Question {labels[i]}: the maximum marks must be a number")
        if mx <= 0:
            raise SheetError(f"Question {labels[i]}: the maximum marks must be more than 0")
        qs.append((i, SheetQuestion(labels[i], co, mx)))
    if not qs:
        raise SheetError("No questions found in the first row")
    students = 0
    for r in rows[3:]:
        if not (r[0] if r else ""):
            continue
        students += 1
        for i, q in qs:
            cell = r[i] if i < len(r) else ""
            if cell in ("", "AB", "ab", "-", "NA"):
                continue
            try:
                v = float(cell)
            except ValueError:
                raise SheetError(f"Student {r[0]}, question {q.label}: '{cell}' is not a mark")
            if v < 0 or v > q.max_marks:
                raise SheetError(f"Student {r[0]}, question {q.label}: {v} is outside 0-{q.max_marks:g}")
            q.attempted += 1
            q.total += v
            q.reached += v >= q.max_marks * target_pct / 100 - 1e-9
    return [q for _, q in qs], students
