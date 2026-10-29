"""
Readiness for NAAC / NBA: the checks NAAC's Data Validation and Verification (DVV) and a peer team would make, a
readiness estimate per criterion, filing exports, and a mock peer-visit drill-down.

  DVV checks     blockers: figures resting on demonstration data. High: quantitative values without evidence,
                 verified research without evidence, impossible values. Medium: missing years, unpublished feedback
                 ATRs, meetings without minutes, SFR above the norm. Low: unconfirmed college facts
  estimate       NOT a predicted grade: per criterion, the share of its quantitative metric-years that are ready
                 (value + evidence, or a live figure from real records) x the criterion's marks. For NBA, criterion 5
                 also uses the computed FCR and FQI
  exports        an Excel workbook in the shape of the data templates, and a ZIP of the evidence files with an index;
                 while demonstration data exists both are marked DRAFT - NOT FOR SUBMISSION
"""
import io
import random
import zipfile
from collections import Counter
from datetime import datetime

from sqlalchemy.orm import Session

from backend.app.accreditation import catalog as C
from backend.app.accreditation import workspace as W
from backend.app.models.accreditation import AccrEvidenceModel, AccrValueModel, InstitutionFactModel
from backend.app.student_services.workflow import academic_year


def _f(severity, area, message, fix, metric=None):
    return {"severity": severity, "area": area, "message": message, "fix": fix, "metric": metric}


def dvv_checks(db: Session, framework: str, programme: str = "") -> list:
    from backend.app.models.feedback import FeedbackATRModel, FeedbackFormModel
    from backend.app.models.institution import MeetingModel
    from backend.app.models.research import ResearchItemModel
    from backend.app.research.summary import year_summary
    out = []
    gen = W.generated_areas(db)
    if gen:
        out.append(_f("blocker", "Data", f"Demonstration data is loaded ({', '.join(sorted(gen))}). Nothing resting on it may be filed.",
                      "Remove it with the generate_* --remove scripts before preparing the SSR / SAR."))
    g = W.grid(db, framework, programme)
    rows = [r for c in g["criteria"] for r in c["metrics"]] + g["profile"]
    for r in rows:
        if r["kind"] != "QnM":
            continue
        cells = [c for c in r["cells"] if c["year"] != g["current_year"]]
        noev = [c["year"] for c in cells if c["status"] == "needs_evidence"]
        if noev:
            out.append(_f("high", "Evidence", f"{r['code']} {r['title']}: values without evidence for {', '.join(noev)}.",
                          "Attach the supporting document for each year; DVV rejects unsupported values.", r["code"]))
        missing = [c["year"] for c in cells if c["status"] == "missing"]
        if 0 < len(missing) < len(cells):
            out.append(_f("medium", "Completeness", f"{r['code']} {r['title']}: no value for {', '.join(missing)}.",
                          "Every year of the assessment period needs a value.", r["code"]))
        for c in cells:
            if r["unit"] == "pct" and c["value"] is not None and not 0 <= c["value"] <= 100:
                out.append(_f("high", "Consistency", f"{r['code']} {c['year']}: {c['value']}% is impossible.", "Correct the value.", r["code"]))
    # Extended Profile vs the metrics that derive from it
    stored = {(v.code, v.year): v.value for v in db.query(AccrValueModel).filter(AccrValueModel.framework == "naac", AccrValueModel.value.isnot(None))}
    for y in g["assessment_years"]:
        t, s = stored.get(("EP3.1", y)), stored.get(("EP3.2", y))
        if t and s and t > s:
            out.append(_f("high", "Consistency", f"{y}: more full-time teachers ({t:g}) than sanctioned posts ({s:g}).", "Check EP3.1 / EP3.2.", "EP3.1"))
    # Research verified without evidence
    if framework == "nba" or not programme:
        n = db.query(ResearchItemModel).filter(ResearchItemModel.verified == True, ResearchItemModel.evidence.is_(None),  # noqa: E712
                                               ResearchItemModel.link.is_(None)).count()
        if n:
            out.append(_f("high", "Research", f"{n} verified research items have no evidence file or DOI.",
                          "Attach the first page / certificate / sanction letter, or unverify them.", "3.3.2"))
    # Feedback loop closed and published
    unpub = db.query(FeedbackATRModel, FeedbackFormModel).join(FeedbackFormModel, FeedbackFormModel.id == FeedbackATRModel.form_id).filter(
        FeedbackATRModel.status == "approved", FeedbackATRModel.published == False, FeedbackFormModel.kind != "teaching").count()  # noqa: E712
    if unpub:
        out.append(_f("medium", "Feedback", f"{unpub} approved feedback ATRs are not published on the website (NAAC 1.4.2 option A needs it).",
                      "Publish them on the Feedback page.", "1.4.2"))
    nominutes = db.query(MeetingModel).filter(MeetingModel.minutes.is_(None), MeetingModel.year.in_(g["assessment_years"])).count()
    if nominutes:
        out.append(_f("medium", "Governance", f"{nominutes} meetings in the assessment period have no signed minutes attached.",
                      "Attach the minutes; peer teams read them.", "6.2.3"))
    if programme:
        last = year_summary(db, programme, g["assessment_years"][0])
        if last["sfr"] and last["sfr"] > 20:
            out.append(_f("medium", "Faculty", f"{programme} SFR is {last['sfr']} in {last['year']} (NBA expects 20 or better).",
                          "Recruit faculty or document the plan; NBA 5.1 marks fall as SFR rises.", "5.1"))
    unconfirmed = db.query(InstitutionFactModel).filter(InstitutionFactModel.verified == False).count()  # noqa: E712
    if unconfirmed:
        out.append(_f("low", "Profile", f"{unconfirmed} college facts read from the website are not confirmed by the IQAC.",
                      "Confirm them in the workspace (College facts).", None))
    order = {"blocker": 0, "high": 1, "medium": 2, "low": 3}
    return sorted(out, key=lambda x: order[x["severity"]])


def estimate(db: Session, framework: str, programme: str = "") -> dict:
    """Per criterion, the share of quantitative metrics covered (a ready / locked year in the workspace, or a live figure
    from CampusSphere's records) x its marks. Two readings: as recorded, and fileable now (demonstration data excluded)."""
    g = W.grid(db, framework, programme)
    gen = W.generated_areas(db)
    live = W.live_metrics(db, framework, programme)
    crits, tot_all, tot_file = [], 0.0, 0.0
    for c in g["criteria"]:
        qnm = [r for r in c["metrics"] if r["kind"] == "QnM"]
        cov_all = cov_file = 0
        for r in qnm:
            ready = any(x["status"] in ("ready", "locked") for x in r["cells"] if x["year"] != g["current_year"])
            lm = live.get(r["live"]) if r["live"] else None
            is_live = bool(lm and lm.get("status") == "live")
            demo = is_live and W.LIVE_AREAS.get(r["live"]) in gen
            cov_all += ready or is_live
            cov_file += ready or (is_live and not demo)
        n = len(qnm) or 1
        e_all, e_file = c["marks"] * cov_all / n, c["marks"] * cov_file / n
        tot_all += e_all
        tot_file += e_file
        crits.append({"code": c["code"], "title": c["title"], "marks": c["marks"], "metrics": len(qnm),
                      "covered": cov_all, "covered_fileable": cov_file, "ready_pct": round(100 * cov_all / n),
                      "fileable_pct": round(100 * cov_file / n), "estimate": round(e_all, 1), "estimate_fileable": round(e_file, 1)})
    if framework == "nba" and programme:
        from backend.app.research.summary import year_summary
        s = year_summary(db, programme, g["assessment_years"][0])
        c5 = next(c for c in crits if c["code"] == "5")
        if s["fcr_marks"] is not None:
            c5["computed"] = {"FCR (5.2) /25": s["fcr_marks"], "FQI (5.3) /25": s["fqi_marks"], "SFR (5.1)": s["sfr"]}
    return {"framework": framework, "programme": programme, "criteria": crits, "total": round(tot_all, 1),
            "fileable": round(tot_file, 1), "max": sum(c["marks"] for c in crits), "demo_data": sorted(gen),
            "note": "Readiness estimate, not a predicted grade: the share of each criterion's quantitative metrics backed by "
                    "CampusSphere's records or by evidence, times its marks. 'Fileable now' leaves out demonstration data. "
                    "Qualitative metrics and the peer visit are judged separately."}


# ── Exports ──────────────────────────────────────────────────────────────────────
def workbook(db: Session, framework: str, programme: str = "") -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    g = W.grid(db, framework, programme)
    draft = bool(W.generated_areas(db))
    ev = {}
    for e in db.query(AccrEvidenceModel).filter(AccrEvidenceModel.framework == framework, AccrEvidenceModel.programme == programme,
                                                AccrEvidenceModel.removed == False):  # noqa: E712
        ev.setdefault((e.code, e.year), []).append(e.url or f"evidence/{e.code}/{e.year}/{e.original or e.filename}")
    wb = Workbook()
    ws = wb.active
    ws.title = "Cover"
    ws.append([f"MVSR Engineering College · {framework.upper()}{f' · {programme}' if programme else ''} · data workbook"])
    ws.append([g["version"]])
    ws.append([f"Generated {datetime.now():%d %b %Y %H:%M} · assessment period {g['assessment_years'][-1]} to {g['assessment_years'][0]}"])
    if draft:
        ws.append(["DRAFT - CONTAINS DEMONSTRATION DATA - NOT FOR SUBMISSION TO NAAC / NBA"])
        ws["A4"].font = Font(bold=True, color="C00000", size=14)
    ws["A1"].font = Font(bold=True, size=14)
    sheets = ([("Extended Profile", g["profile"])] if g["profile"] else []) + [(f"Criterion {c['code']}", c["metrics"]) for c in g["criteria"]]
    years = g["assessment_years"]
    for name, rows in sheets:
        s = wb.create_sheet(name[:31])
        s.append(["Metric", "Title", "Type", "Unit"] + years + ["Evidence"])
        for cell in s[1]:
            cell.font = Font(bold=True)
            cell.fill = PatternFill("solid", fgColor="DDEBF7")
        for r in rows:
            vals = []
            for y in years:
                c = next((x for x in r["cells"] if x["year"] == y), None)
                vals.append("" if not c else c["value"] if c["value"] is not None else (c["text"] or ""))
            links = "; ".join(l for y in years for l in ev.get((r["code"], y), []))
            s.append([r["code"], r["title"], r["kind"], r["unit"]] + vals + [links])
        s.column_dimensions["B"].width = 60
        if draft:
            s.append([])
            s.append(["DRAFT - NOT FOR SUBMISSION"])
    issues = wb.create_sheet("DVV checks")
    issues.append(["Severity", "Area", "Metric", "Finding", "Fix"])
    for i in dvv_checks(db, framework, programme):
        issues.append([i["severity"], i["area"], i["metric"] or "", i["message"], i["fix"]])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def evidence_zip(db: Session, framework: str, programme: str = "") -> bytes:
    buf = io.BytesIO()
    rows = ["metric,year,title,kind,file_or_link,signed"]
    draft = bool(W.generated_areas(db))
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for e in db.query(AccrEvidenceModel).filter(AccrEvidenceModel.framework == framework, AccrEvidenceModel.programme == programme,
                                                    AccrEvidenceModel.removed == False).order_by(AccrEvidenceModel.code, AccrEvidenceModel.year):  # noqa: E712
            crit = C.criterion_of(e.code)
            if e.kind == "file" and e.filename:
                path = W.evidence_path(e.filename)
                if path.exists():
                    arc = f"Criterion {crit}/{e.code}/{e.year}/{(e.original or e.filename).replace('/', '_')}"
                    z.write(path, arc)
                    rows.append(f'{e.code},{e.year},"{e.title}",file,"{arc}",{"yes" if e.signed else "no"}')
            elif e.url:
                rows.append(f'{e.code},{e.year},"{e.title}",link,"{e.url}",no')
        z.writestr("index.csv", "\n".join(rows))
        if draft:
            z.writestr("DRAFT - NOT FOR SUBMISSION.txt", "This pack was prepared while demonstration data is loaded in CampusSphere. Do not submit it.")
    return buf.getvalue()


# ── Mock peer visit ──────────────────────────────────────────────────────────────
QUESTIONS = {
    "1": ["Show the BoS minutes where the latest syllabus revision was approved.", "How is feedback on the curriculum acted upon? Show one ATR."],
    "2": ["Pick a course: show its course file, CO-PO mapping and attainment.", "How are slow learners identified and supported?",
          "Show the mentor's record for a student of my choosing."],
    "3": ["Show the evidence for three papers listed in 3.3.2.", "What did the IIC do last year?"],
    "4": ["Show the library footfall register for last month.", "Which classrooms are ICT-enabled? Take us to one."],
    "5": ["Show offer letters for five placed students.", "How does a student raise a grievance, and how fast is it resolved?"],
    "6": ["Show the IQAC minutes and what happened to its decisions.", "Show the perspective plan and its review."],
    "7": ["Show the green audit report.", "What are your two best practices, and their outcomes?"],
}


def mock_visit(db: Session, programme: str = "IT", seed=None) -> dict:
    """A random drill-down like a peer team's: one course file, one student, one teacher, one meeting, and questions."""
    from backend.app.attendance import core as Att
    from backend.app.models.institution import MeetingModel
    from backend.app.models.obe import ObeCourseModel
    from backend.app.models.research import FacultyRecordModel, ResearchItemModel
    from backend.app.models.services import RosterEntryModel, StudentProfileModel
    from backend.app.obe.attainment import course_attainment
    rng = random.Random(seed)
    current = academic_year()
    checks = []
    # A course file from the last completed year
    years = sorted({y for (y,) in db.query(ObeCourseModel.year).filter(ObeCourseModel.programme == programme).distinct() if y < current})
    course = None
    if years:
        cs = db.query(ObeCourseModel).filter(ObeCourseModel.programme == programme, ObeCourseModel.year == years[-1]).all()
        if cs:
            c = rng.choice(cs)
            a = course_attainment(db, c)
            ok = a["measured"] > 0 and a["assessments"] > 0
            course = {"id": c.id, "code": c.code, "name": c.name, "year": c.year, "cos": len(a["cos"]), "assessments": a["assessments"],
                      "average": a["average"], "pass": ok}
            checks.append(("Course file with CO attainment", ok))
    # A student: roll list, attendance, mentor
    student = None
    roster = db.query(RosterEntryModel).filter(RosterEntryModel.department == programme, RosterEntryModel.year.isnot(None)).all()
    if roster:
        r = rng.choice(roster)
        prof = db.query(StudentProfileModel).filter(StudentProfileModel.roll_no == r.roll_no).first()
        marks = Att.marks_by_subject(db, r.roll_no)
        att, held = sum(v[0] for v in marks.values()), sum(v[1] for v in marks.values())
        student = {"roll_no": r.roll_no, "name": r.name, "class": f"{programme}-{r.year}{r.section}",
                   "attendance": round(100 * att / held, 1) if held else None, "mentor": bool(prof and prof.mentor_id)}
        checks.append(("Student's attendance recorded", held > 0))
        checks.append(("Student has a mentor", student["mentor"]))
    # A teacher: research with evidence
    teacher = None
    fac = db.query(FacultyRecordModel).filter(FacultyRecordModel.department == programme, FacultyRecordModel.left_on.is_(None)).all()
    if fac:
        f = rng.choice(fac)
        items = db.query(ResearchItemModel).filter(ResearchItemModel.faculty_id == f.id, ResearchItemModel.verified == True).all()  # noqa: E712
        with_ev = sum(1 for i in items if i.evidence or i.link)
        teacher = {"name": f.name, "designation": f.designation, "qualification": f.qualification, "verified_items": len(items),
                   "with_evidence": with_ev}
        checks.append(("Teacher's verified research has evidence", not items or with_ev == len(items)))
    # A meeting
    meeting = None
    ms = db.query(MeetingModel).filter(MeetingModel.year < current).all()
    if ms:
        m = rng.choice(ms)
        d = m.decisions or []
        meeting = {"body": m.body, "held_on": m.held_on.isoformat(), "decisions": len(d),
                   "done": sum(1 for x in d if x.get("status") == "done"), "minutes": bool(m.minutes)}
        checks.append(("Meeting has signed minutes", meeting["minutes"]))
        checks.append(("Meeting's decisions carried out", meeting["done"] == meeting["decisions"]))
    qs = [{"criterion": k, "question": rng.choice(v)} for k, v in QUESTIONS.items()]
    passed = sum(1 for _, ok in checks if ok)
    return {"programme": programme, "course": course, "student": student, "teacher": teacher, "meeting": meeting,
            "checks": [{"check": n, "pass": ok} for n, ok in checks], "passed": passed, "total": len(checks), "questions": qs}
