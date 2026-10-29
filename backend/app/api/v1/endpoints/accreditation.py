# Accreditation Autopilot: NAAC / NBA evidence from CampusSphere's records, the evidence-pack PDF,
# and the desk turnaround wall. For admins and the Principal.
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from backend.app.accreditation.desks import desk_wall
from backend.app.accreditation.evidence_pdf import render_evidence_pack
from backend.app.accreditation.metrics import ScopeError, build_report
from backend.app.accreditation.scope import Scope
from backend.app.core.security import get_current_user
from backend.app.db.session import get_db
from backend.app.models.services import ApproverAssignmentModel

router = APIRouter()

Framework = Literal["naac", "nba"]
# both = the Civil & IT Block pilot; NBA needs one programme
ScopeId = Literal["both", "civil", "it"]


def is_management(db: Session, current: dict) -> bool:
    if current["role"] == "admin":
        return True
    return bool(db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.role == "principal",
                                                         ApproverAssignmentModel.user_id == current["sub"]).first())


def require_management(db: Session = Depends(get_db), current: dict = Depends(get_current_user)) -> dict:
    if not is_management(db, current):
        raise HTTPException(status_code=403, detail="Admins and the Principal only")
    return current


@router.get("/access", summary="Whether I can open the accreditation pages")
def access(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    return {"allowed": is_management(db, current)}


@router.get("/report", summary="NAAC / NBA criterion report computed from CampusSphere's records")
def report(framework: Framework = Query("naac"), scope: ScopeId = Query("both"),
           db: Session = Depends(get_db), _m: dict = Depends(require_management)):
    try:
        return build_report(db, framework, scope)
    except ScopeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/report.pdf", summary="The criterion report as a printable evidence pack")
def report_pdf(framework: Framework = Query("naac"), scope: ScopeId = Query("both"),
               db: Session = Depends(get_db), _m: dict = Depends(require_management)):
    try:
        # Every page says "not for submission" while any figure rests on generated (demonstration) data
        from backend.app.accreditation.workspace import generated_areas
        pdf = render_evidence_pack(build_report(db, framework, scope), demonstration=bool(generated_areas(db)))
    except ScopeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    filename = f"MVSR-{framework.upper()}-{Scope(scope).meta['short'].replace(' & ', '-')}-evidence-pack-{datetime.utcnow():%Y-%m-%d}.pdf"
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{filename}"', "Cache-Control": "private, no-store"})


@router.get("/desks", summary="Desk turnaround wall: every approver desk ranked against its time target")
def desks(scope: ScopeId = Query("both"), db: Session = Depends(get_db), _m: dict = Depends(require_management)):
    return desk_wall(db, scope=Scope(scope))


# ── Workspace: yearly values, evidence and the accreditation team ──────────────────
from typing import Optional  # noqa: E402

from fastapi import File, Form, UploadFile  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from backend.app.accreditation import catalog as C  # noqa: E402
from backend.app.accreditation import workspace as W  # noqa: E402
from backend.app.models.accreditation import AccrEvidenceModel, AccrRoleModel, AccrValueModel, InstitutionFactModel  # noqa: E402
from backend.app.models.campus import UserModel  # noqa: E402
from backend.app.student_services.workflow import academic_year  # noqa: E402


def _ws(db: Session, current: dict, need: str = "view") -> dict:
    a = W.access(db, current)
    if not a[need]:
        raise HTTPException(status_code=403, detail="Only the IQAC, criterion in-charges, NBA coordinators and management")
    return a


def _known(framework: str, code: str) -> dict:
    m = C.metric(framework, code)
    if not m:
        raise HTTPException(status_code=404, detail=f"No {framework.upper()} metric {code}")
    return m


def _prog(framework: str, programme: str) -> str:
    return (programme or "").strip().upper() if framework == "nba" else ""


NOT_YOURS = "This metric is not yours to edit"


@router.get("/workspace/access", summary="What I can do in the accreditation workspace")
def ws_access(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    return W.access(db, current)


@router.get("/workspace", summary="Every metric across the assessment period, with values, evidence and readiness")
def ws_grid(framework: Framework = Query("naac"), programme: str = Query("", max_length=20),
            db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _ws(db, current)
    if framework == "nba" and not programme:
        raise HTTPException(status_code=422, detail="NBA accredits each programme separately: choose one (e.g. IT)")
    return W.grid(db, framework, _prog(framework, programme))


@router.get("/workspace/metric", summary="One metric: its years, live value, evidence and what the peer team asks for")
def ws_metric(framework: Framework = Query("naac"), code: str = Query(..., max_length=12), programme: str = Query("", max_length=20),
              db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = _ws(db, current)
    _known(framework, code)
    prog = _prog(framework, programme)
    return {**W.metric_detail(db, framework, code, prog), "can_edit": W.can_edit(a, framework, code, prog), "can_lock": a["lock"]}


class ValueIn(BaseModel):
    framework: Framework
    code: str = Field(..., max_length=12)
    programme: str = Field("", max_length=20)
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    value: Optional[float] = None
    text: Optional[str] = Field(None, max_length=20000)
    note: Optional[str] = Field(None, max_length=1000)
    origin: Literal["manual", "imported"] = "manual"


@router.put("/workspace/value", summary="Enter a metric's value for a year")
def ws_value(body: ValueIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = _ws(db, current)
    m = _known(body.framework, body.code)
    prog = _prog(body.framework, body.programme)
    if not W.can_edit(a, body.framework, body.code, prog):
        raise HTTPException(status_code=403, detail=NOT_YOURS)
    if body.year not in C.academic_years(C.years_for(body.framework, m), academic_year()):
        raise HTTPException(status_code=422, detail="That year is outside the assessment period")
    if m["unit"] == "pct" and body.value is not None and not 0 <= body.value <= 100:
        raise HTTPException(status_code=422, detail="A percentage must be between 0 and 100")
    try:
        W.save_value(db, body.framework, body.code, prog, body.year, body.value, (body.text or "").strip() or None,
                     body.note, body.origin, current["sub"])
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    db.commit()
    return {"message": "Saved"}


class LockIn(BaseModel):
    framework: Framework
    code: str = Field(..., max_length=12)
    programme: str = Field("", max_length=20)
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    locked: bool = True


@router.post("/workspace/lock", summary="Lock (or unlock) a reviewed value (IQAC Coordinator)")
def ws_lock(body: LockIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _ws(db, current, "lock")
    v = db.query(AccrValueModel).filter(AccrValueModel.framework == body.framework, AccrValueModel.code == body.code,
                                        AccrValueModel.programme == _prog(body.framework, body.programme),
                                        AccrValueModel.year == body.year).first()
    if not v:
        raise HTTPException(status_code=404, detail="Enter the value before locking it")
    if body.locked and v.origin == "generated":
        raise HTTPException(status_code=400, detail="Generated values can't be locked for filing")
    v.locked = body.locked
    v.locked_by = current["sub"] if body.locked else None
    v.locked_at = datetime.utcnow() if body.locked else None
    db.commit()
    return {"message": "Locked" if body.locked else "Unlocked"}


@router.post("/workspace/snapshot", summary="Store this year's live values (so the year keeps them after it ends)")
def ws_snapshot(framework: Framework = Query("naac"), programme: str = Query("", max_length=20),
                db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _ws(db, current, "edit_all")
    prog = _prog(framework, programme)
    g = W.grid(db, framework, prog)
    n = 0
    for row in [r for c in g["criteria"] for r in c["metrics"]] + g["profile"]:
        cell = next((c for c in row["cells"] if c["year"] == g["current_year"]), None)
        if cell and cell["origin"] in ("live", "generated") and (cell["value"] is not None or cell["text"]):
            try:
                W.save_value(db, framework, row["code"], prog, g["current_year"], cell["value"], cell["text"],
                             "Snapshot of CampusSphere's live value", cell["origin"], current["sub"])
                n += 1
            except ValueError:
                pass                                  # locked: keep the reviewed value
    db.commit()
    return {"message": f"Stored {n} live values for {g['current_year']}"}


@router.post("/workspace/evidence", summary="Attach a document (file) to a metric's year")
def ws_evidence_upload(framework: Framework = Form(...), code: str = Form(..., max_length=12), programme: str = Form("", max_length=20),
                       year: str = Form(..., pattern=r"^\d{4}-\d{2}$"), title: str = Form(..., min_length=2, max_length=200),
                       signed: bool = Form(False), replaces_id: Optional[int] = Form(None), file: UploadFile = File(...),
                       db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = _ws(db, current)
    _known(framework, code)
    prog = _prog(framework, programme)
    if not W.can_edit(a, framework, code, prog):
        raise HTTPException(status_code=403, detail=NOT_YOURS)
    try:
        saved = W.save_evidence_file(file)
    except W.EvidenceError as e:
        raise HTTPException(status_code=422, detail=str(e))
    version, old = 1, None
    if replaces_id:
        old = db.get(AccrEvidenceModel, replaces_id)
        if old and old.code == code and old.framework == framework:
            old.removed, version = True, old.version + 1
        else:
            old = None
    e = AccrEvidenceModel(framework=framework, code=code, programme=prog, year=year, title=title.strip(), kind="file",
                          original=(file.filename or "")[:200], signed=signed, version=version,
                          replaces_id=old.id if old else None, uploaded_by=current["sub"], **saved)
    db.add(e)
    db.commit()
    return W.evidence_out(e)


class LinkIn(BaseModel):
    framework: Framework
    code: str = Field(..., max_length=12)
    programme: str = Field("", max_length=20)
    year: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    title: str = Field(..., min_length=2, max_length=200)
    url: str = Field(..., pattern=r"^https?://", max_length=1000)


@router.post("/workspace/evidence/link", summary="Attach a published link (the SSR's hyperlinks) to a metric's year")
def ws_evidence_link(body: LinkIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = _ws(db, current)
    _known(body.framework, body.code)
    prog = _prog(body.framework, body.programme)
    if not W.can_edit(a, body.framework, body.code, prog):
        raise HTTPException(status_code=403, detail=NOT_YOURS)
    e = AccrEvidenceModel(framework=body.framework, code=body.code, programme=prog, year=body.year, title=body.title.strip(),
                          kind="link", url=body.url, uploaded_by=current["sub"])
    db.add(e)
    db.commit()
    return W.evidence_out(e)


@router.get("/workspace/evidence/{evidence_id}/file", summary="Open an evidence file")
def ws_evidence_file(evidence_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _ws(db, current)
    e = db.get(AccrEvidenceModel, evidence_id)
    if not e or e.kind != "file":
        raise HTTPException(status_code=404, detail="Not found")
    path = W.evidence_path(e.filename)
    if not path.exists():
        raise HTTPException(status_code=410, detail="The file is no longer available")
    return FileResponse(path, media_type=e.mime, filename=e.original or e.filename, headers={"Cache-Control": "private, no-store"})


@router.delete("/workspace/evidence/{evidence_id}", summary="Withdraw evidence (kept in the history)")
def ws_evidence_remove(evidence_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    a = _ws(db, current)
    e = db.get(AccrEvidenceModel, evidence_id)
    if not e or e.removed:
        raise HTTPException(status_code=404, detail="Not found")
    if not W.can_edit(a, e.framework, e.code, e.programme):
        raise HTTPException(status_code=403, detail=NOT_YOURS)
    e.removed = True
    db.commit()
    return {"message": "Withdrawn"}


# Team
class RoleIn(BaseModel):
    role: Literal["iqac_coordinator", "criterion_incharge", "nba_coordinator", "metric_owner"]
    user_id: str = Field(..., max_length=60)
    framework: Optional[Framework] = None
    criterion: Optional[str] = Field(None, max_length=4)
    programme: Optional[str] = Field(None, max_length=20)
    code: Optional[str] = Field(None, max_length=12)


def _team_out(db: Session) -> list:
    rows = db.query(AccrRoleModel).order_by(AccrRoleModel.role, AccrRoleModel.criterion, AccrRoleModel.programme).all()
    users = {u.id: u for u in db.query(UserModel).filter(UserModel.id.in_([r.user_id for r in rows]))}
    return [{"id": r.id, "role": r.role, "user_id": r.user_id, "name": users[r.user_id].name if r.user_id in users else "—",
             "department": users[r.user_id].department if r.user_id in users else "", "framework": r.framework,
             "criterion": r.criterion, "programme": r.programme, "code": r.code} for r in rows]


@router.get("/workspace/team", summary="The accreditation team")
def ws_team(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _ws(db, current)
    return _team_out(db)


@router.get("/workspace/people", summary="Faculty and staff who can be given accreditation roles")
def ws_people(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _ws(db, current, "manage_team")
    return [{"id": u.id, "name": u.name, "department": u.department, "email": u.email}
            for u in db.query(UserModel).filter(UserModel.role.in_(["faculty", "staff"]), UserModel.status == "active")
            .order_by(UserModel.name)]


@router.post("/workspace/team", summary="Give someone an accreditation role (IQAC Coordinator / admin / Principal)")
def ws_team_add(body: RoleIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _ws(db, current, "manage_team")
    user = db.get(UserModel, body.user_id)
    if not user or user.role not in ("faculty", "staff", "admin"):
        raise HTTPException(status_code=422, detail="Choose a faculty or staff account")
    if body.role == "criterion_incharge" and body.criterion not in [c for c, _t, _m in C.NAAC_CRITERIA]:
        raise HTTPException(status_code=422, detail="Choose a NAAC criterion (1-7)")
    if body.role == "nba_coordinator" and not body.programme:
        raise HTTPException(status_code=422, detail="Choose the programme")
    if body.role == "metric_owner" and not (body.framework and body.code and C.metric(body.framework, body.code)):
        raise HTTPException(status_code=422, detail="Choose a metric")
    if body.role == "iqac_coordinator":       # one IQAC Coordinator at a time
        db.query(AccrRoleModel).filter(AccrRoleModel.role == "iqac_coordinator").delete(synchronize_session=False)
    framework = {"criterion_incharge": "naac", "nba_coordinator": "nba", "metric_owner": body.framework}.get(body.role)
    db.add(AccrRoleModel(role=body.role, user_id=user.id, framework=framework,
                         criterion=body.criterion if body.role == "criterion_incharge" else None,
                         programme=(body.programme or "").upper() if body.role == "nba_coordinator" else None,
                         code=body.code if body.role == "metric_owner" else None))
    db.commit()
    return _team_out(db)


@router.delete("/workspace/team/{role_id}", summary="Remove an accreditation role")
def ws_team_remove(role_id: int, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _ws(db, current, "manage_team")
    db.query(AccrRoleModel).filter(AccrRoleModel.id == role_id).delete(synchronize_session=False)
    db.commit()
    return _team_out(db)


# College facts (from the website, confirmed by the IQAC)
@router.get("/workspace/facts", summary="Facts about the college for the accreditation profile")
def ws_facts(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _ws(db, current)
    return [{"key": f.key, "value": f.value, "source_url": f.source_url, "verified": f.verified,
             "updated_at": f.updated_at.isoformat() if f.updated_at else None}
            for f in db.query(InstitutionFactModel).order_by(InstitutionFactModel.key)]


class FactIn(BaseModel):
    key: str = Field(..., max_length=60)
    value: str = Field(..., min_length=1, max_length=4000)
    source_url: Optional[str] = Field(None, max_length=1000)
    verified: bool = True


@router.put("/workspace/facts", summary="Set or confirm a college fact (IQAC Coordinator / admin)")
def ws_fact_set(body: FactIn, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    _ws(db, current, "edit_all")
    f = db.query(InstitutionFactModel).filter(InstitutionFactModel.key == body.key).first() or InstitutionFactModel(key=body.key)
    f.value, f.source_url, f.verified, f.updated_by = body.value.strip(), body.source_url, body.verified, current["sub"]
    db.add(f)
    db.commit()
    return {"message": "Saved"}


# ── Readiness: DVV checks, estimate, exports, mock visit ────────────────────────────
from backend.app.accreditation import readiness as RD  # noqa: E402


@router.get("/readiness", summary="DVV-style checks and a readiness estimate per criterion")
def readiness(framework: Framework = Query("naac"), programme: str = Query("", max_length=20), db: Session = Depends(get_db),
              current: dict = Depends(get_current_user)):
    _ws(db, current)
    prog = _prog(framework, programme)
    if framework == "nba" and not prog:
        raise HTTPException(status_code=422, detail="NBA accredits each programme separately: choose one (e.g. IT)")
    live = W.live_metrics(db, framework, prog)          # computed once for the grid, estimate and checks
    g = W.grid(db, framework, prog, live)
    return {"estimate": RD.estimate(db, framework, prog, g, live), "checks": RD.dvv_checks(db, framework, prog, g)}


@router.get("/export/workbook", summary="The data workbook (Excel) in the shape of the data templates")
def export_workbook(framework: Framework = Query("naac"), programme: str = Query("", max_length=20), db: Session = Depends(get_db),
                    current: dict = Depends(get_current_user)):
    _ws(db, current)
    prog = _prog(framework, programme)
    data = RD.workbook(db, framework, prog)
    draft = "-DRAFT" if W.generated_areas(db) else ""
    name = f"MVSR-{framework.upper()}{'-' + prog if prog else ''}-data{draft}-{datetime.utcnow():%Y-%m-%d}.xlsx"
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{name}"', "Cache-Control": "private, no-store"})


@router.get("/export/evidence.zip", summary="Every evidence file, by criterion / metric / year, with an index")
def export_evidence(framework: Framework = Query("naac"), programme: str = Query("", max_length=20), db: Session = Depends(get_db),
                    current: dict = Depends(get_current_user)):
    _ws(db, current)
    prog = _prog(framework, programme)
    data = RD.evidence_zip(db, framework, prog)
    draft = "-DRAFT" if W.generated_areas(db) else ""
    return Response(data, media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="MVSR-{framework.upper()}-evidence{draft}.zip"', "Cache-Control": "private, no-store"})


@router.get("/mock-visit", summary="A random peer-team drill-down: a course file, a student, a teacher, a meeting, questions")
def mock_visit(programme: str = Query("IT", max_length=20), seed: Optional[int] = None, db: Session = Depends(get_db),
               current: dict = Depends(get_current_user)):
    _ws(db, current)
    return RD.mock_visit(db, programme.upper(), seed)
