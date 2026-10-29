"""
Generate the IT programme's outcome-based education records: what NBA's criteria 2, 3 and 7 look for, built on the
real IT courses (the timetable's subject codes) and the teachers who teach them.

  outcomes     3 PEOs, the 12 POs (NBA's graduate attributes) and 2 PSOs for IT
  courses      every credit course of semesters 3, 5 and 7 offered in 2023-24, 2024-25, 2025-26 (completed) and
               2026-27 (in progress); course coordinator = the teacher with the most periods
  COs          4-5 per course with Bloom levels, and a CO-PO / PSO mapping (1-3)
  assessments  completed years: CIE-1, CIE-2, an assignment and the SEE, two questions per CO, as per-question
               totals only (no student's marks); course-exit surveys. The year in progress: the first assignment
  the loop     a few POs fall short in 2024-25; actions were taken, and they recover in 2025-26 (NBA 7.1)

Every generated row carries pilot_run = RUN, so `--remove` deletes exactly this data.

Usage (from the project root):
    python backend/app/db/generate_obe.py            # (re)generate; removes an earlier run first
    python backend/app/db/generate_obe.py --remove
"""
import argparse
import random
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import backend.app.main  # noqa: E402,F401  (every table registered and migrated, like the server)
from backend.app.db.session import SessionLocal  # noqa: E402
from backend.app.models.campus import TimetableEntryModel, UserModel  # noqa: E402
from backend.app.models.obe import (  # noqa: E402
    ObeActionModel, ObeAssessmentModel, ObeCOModel, ObeCourseModel, ObeMappingModel, ObeOutcomeModel,
    ObeQuestionModel, ObeSurveyModel,
)
from backend.app.models.services import RosterEntryModel  # noqa: E402
from backend.app.obe import attainment as A  # noqa: E402

RUN = "it-obe-2026"
PROG = "IT"
DONE_YEARS = ["2023-24", "2024-25", "2025-26"]
CURRENT = "2026-27"
SKIP = ("COUNSELLING", "TUTORIAL", "CRT")
rng = random.Random(2026)

PEOS = [
    ("PEO1", "Graduates build careers in the IT industry, research or entrepreneurship, applying computing knowledge to real problems."),
    ("PEO2", "Graduates keep learning: they adapt to new technologies through higher studies, certification and professional practice."),
    ("PEO3", "Graduates work ethically in teams and communicate well, contributing to society and the profession."),
]
POS = [
    ("PO1", "Engineering knowledge", "Apply knowledge of mathematics, science, engineering fundamentals and computing to solve complex engineering problems."),
    ("PO2", "Problem analysis", "Identify, formulate, research and analyse complex engineering problems, reaching substantiated conclusions."),
    ("PO3", "Design / development of solutions", "Design solutions and system components that meet specified needs with due consideration for safety, society and environment."),
    ("PO4", "Conduct investigations of complex problems", "Use research-based knowledge, experiments, analysis and interpretation of data to reach valid conclusions."),
    ("PO5", "Modern tool usage", "Create, select and apply appropriate techniques, resources and modern engineering and IT tools, understanding their limits."),
    ("PO6", "The engineer and society", "Assess societal, health, safety, legal and cultural issues and the responsibilities relevant to professional practice."),
    ("PO7", "Environment and sustainability", "Understand the impact of engineering solutions in societal and environmental contexts and the need for sustainable development."),
    ("PO8", "Ethics", "Apply ethical principles and commit to professional ethics, responsibilities and the norms of engineering practice."),
    ("PO9", "Individual and team work", "Function effectively as an individual, and as a member or leader in diverse and multidisciplinary teams."),
    ("PO10", "Communication", "Communicate effectively with the engineering community and society: reports, documentation, presentations, instructions."),
    ("PO11", "Project management and finance", "Apply engineering and management principles to manage projects in multidisciplinary environments."),
    ("PO12", "Life-long learning", "Recognise the need for, and engage in, independent and life-long learning in the context of technological change."),
]
PSOS = [
    ("PSO1", "Software development", "Design, develop and test software and web / mobile applications using modern programming practices."),
    ("PSO2", "Data and intelligent systems", "Apply data analytics, AI, networking and security techniques to build reliable information systems."),
]
THEORY_COS = [
    ("K2", "Explain the fundamental concepts, terminology and principles of {s}."),
    ("K3", "Apply the core methods of {s} to solve standard problems."),
    ("K4", "Analyse problems in {s} and select suitable techniques and data structures."),
    ("K5", "Evaluate alternative solutions in {s} against functional and performance requirements."),
    ("K6", "Design a small solution or case study that applies {s} end to end."),
]
LAB_COS = [
    ("K3", "Implement the experiments of {s} using appropriate tools and languages."),
    ("K4", "Debug, test and analyse the programs and results of {s}."),
    ("K3", "Use modern tools and environments relevant to {s}."),
    ("K6", "Develop a mini project that integrates the skills of {s}."),
]
# CO index -> outcomes it addresses (strength)
THEORY_MAP = [{"PO1": 3, "PO2": 2, "PO12": 1, "PSO2": 1}, {"PO1": 2, "PO2": 3, "PO5": 1, "PSO1": 2},
              {"PO2": 3, "PO4": 2, "PSO2": 2}, {"PO3": 2, "PO4": 3, "PO6": 1, "PO8": 1},
              {"PO3": 3, "PO5": 2, "PO9": 1, "PO10": 1, "PO11": 1, "PSO1": 3, "PO7": 1}]
LAB_MAP = [{"PO1": 2, "PO5": 3, "PSO1": 3}, {"PO2": 2, "PO4": 3, "PSO1": 2},
           {"PO5": 3, "PO12": 2, "PSO2": 2}, {"PO3": 3, "PO9": 2, "PO10": 2, "PO11": 2, "PO8": 1, "PSO1": 3}]
# How hard each PO is to attain here (0 = easy); 2024-25 shows the gaps that 2025-26's actions closed
WEAK = {"PO6": 0.07, "PO7": 0.08, "PO10": 0.06, "PO11": 0.08}


def remove(db) -> dict:
    courses = [c for (c,) in db.query(ObeCourseModel.id).filter(ObeCourseModel.pilot_run == RUN)]
    assessments = [a for (a,) in db.query(ObeAssessmentModel.id).filter(ObeAssessmentModel.course_id.in_(courses))]
    n = {"questions": db.query(ObeQuestionModel).filter(ObeQuestionModel.assessment_id.in_(assessments)).delete(synchronize_session=False)}
    for name, model in (("assessments", ObeAssessmentModel), ("surveys", ObeSurveyModel), ("mapping", ObeMappingModel), ("cos", ObeCOModel)):
        n[name] = db.query(model).filter(model.course_id.in_(courses)).delete(synchronize_session=False)
    n["courses"] = db.query(ObeCourseModel).filter(ObeCourseModel.pilot_run == RUN).delete(synchronize_session=False)
    n["outcomes"] = db.query(ObeOutcomeModel).filter(ObeOutcomeModel.pilot_run == RUN).delete(synchronize_session=False)
    n["actions"] = db.query(ObeActionModel).filter(ObeActionModel.pilot_run == RUN).delete(synchronize_session=False)
    db.commit()
    return n


def main():
    ap = argparse.ArgumentParser(description="Generate (or remove) the IT programme's OBE records")
    ap.add_argument("--remove", action="store_true")
    args = ap.parse_args()
    db = SessionLocal()
    try:
        gone = remove(db)
        if args.remove:
            print(f"Removed the IT OBE data: {gone}")
            return
        if db.query(ObeOutcomeModel.id).filter(ObeOutcomeModel.programme == PROG).first():
            sys.exit("IT already has outcomes that this script didn't create: not touching them")

        for i, (code, text) in enumerate(PEOS, 1):
            db.add(ObeOutcomeModel(programme=PROG, kind="PEO", code=code, text=text, ord=i, pilot_run=RUN))
        for kind, rows in (("PO", POS), ("PSO", PSOS)):
            for i, (code, title, text) in enumerate(rows, 1):
                db.add(ObeOutcomeModel(programme=PROG, kind=kind, code=code, title=title, text=text, ord=i, pilot_run=RUN))

        # Courses: the IT timetable's credit courses, coordinated by the teacher with the most periods
        staff = {u.staff_id: u.id for u in db.query(UserModel).filter(UserModel.staff_id.isnot(None))}
        periods = defaultdict(Counter)
        names, sems = {}, {}
        for e in db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True,  # noqa: E712
                                                      TimetableEntryModel.section.like(f"{PROG}-%")):
            if not e.subject_id or e.subject_id.upper() in SKIP or "MCN" in (e.subject_id or ""):
                continue
            names[e.subject_id], sems[e.subject_id] = e.subject_name, e.semester
            if staff.get(e.faculty_id):
                periods[e.subject_id][staff[e.faculty_id]] += 1
        roll_count = Counter(r.year for r in db.query(RosterEntryModel).filter(RosterEntryModel.department == PROG))
        n_courses = n_asm = 0
        for year in DONE_YEARS + [CURRENT]:
            for code in sorted(names):
                name, sem = names[code], sems[code]
                kind = "project" if "PW" in code else "lab" if "Lab" in name or code[-3] == "8" else "theory"
                students = roll_count.get((sem + 1) // 2, 65) if year == CURRENT else rng.randint(180, 205)
                c = ObeCourseModel(programme=PROG, code=code, name=name, semester=sem, year=year, kind=kind,
                                   credits=1.5 if kind == "lab" else 2 if kind == "project" else 3,
                                   coordinator=periods[code].most_common(1)[0][0] if periods[code] else None,
                                   students=students, pilot_run=RUN)
                db.add(c)
                db.flush()
                n_courses += 1
                templates, maps = (LAB_COS, LAB_MAP) if kind != "theory" else (THEORY_COS, THEORY_MAP)
                for i, (bloom, text) in enumerate(templates, 1):
                    db.add(ObeCOModel(course_id=c.id, code=f"CO{i}", text=text.format(s=name), bloom=bloom))
                    for outcome, strength in maps[i - 1].items():
                        db.add(ObeMappingModel(course_id=c.id, co_code=f"CO{i}", outcome=outcome, strength=strength))
                n_asm += assessments(db, c, len(templates), maps, year, students)
        db.flush()
        actions(db)
        db.commit()
    finally:
        db.close()
    print(f"IT OBE generated: {len(PEOS)} PEOs, {len(POS)} POs, {len(PSOS)} PSOs; {n_courses} course offerings "
          f"({len(DONE_YEARS)} completed years + {CURRENT}); {n_asm} assessments (totals only)")


def assessments(db, c, n_cos, maps, year, students) -> int:
    """Per-question totals for the year's assessments; how well each CO goes depends on the POs it serves."""
    def ease(co_i):
        weak = max((WEAK.get(o, 0) for o in maps[co_i - 1]), default=0)
        if year == "2025-26":
            weak *= 0.2                               # the 2024-25 actions worked
        elif year == "2023-24":
            weak *= 0.6
        return 0.735 - weak + rng.uniform(-0.06, 0.06)

    plan = {"internal": [("CIE-1", list(range(1, min(3, n_cos) + 1)), date(int(year[:4]), 9, 20)),
                         ("CIE-2", list(range(max(1, n_cos - 2), n_cos + 1)), date(int(year[:4]), 11, 25)),
                         ("Assignment", list(range(1, n_cos + 1)), date(int(year[:4]), 10, 30))],
            "external": [("SEE", list(range(1, n_cos + 1)), date(int(year[:4]) + 1, 1, 20))]}
    if year == CURRENT:
        plan = {"internal": [("Assignment 1", [1, 2], date(int(year[:4]), 10, 10))], "external": []}
    n = 0
    for kind, items in plan.items():
        for name, co_list, held in items:
            if c.kind != "theory" and name.startswith("CIE-2"):
                continue
            sat = max(1, students - rng.randint(0, 6))
            a = ObeAssessmentModel(course_id=c.id, name=name, kind=kind, held_on=held, students=sat,
                                   source=f"{c.code}-{name}.xlsx", pilot_run=RUN)
            db.add(a)
            db.flush()
            q = 0
            for co_i in co_list:
                for part in "ab":
                    q += 1
                    attempted = sat - rng.randint(0, max(1, sat // 12))
                    p = max(0.25, min(0.97, ease(co_i) - (0.04 if kind == "external" else 0)))
                    reached = round(attempted * p)
                    mx = 10.0 if kind == "external" else 5.0
                    db.add(ObeQuestionModel(assessment_id=a.id, label=f"Q{q}", co_code=f"CO{co_i}", max_marks=mx,
                                            attempted=attempted, reached=reached, mean=round(mx * (0.35 + 0.5 * p), 2)))
            n += 1
    if year != CURRENT:
        for co_i in range(1, n_cos + 1):
            db.add(ObeSurveyModel(course_id=c.id, co_code=f"CO{co_i}", responses=round(students * rng.uniform(0.6, 0.85)),
                                  mean=round(min(4.8, 3.4 + ease(co_i) * 1.4 + rng.uniform(-0.15, 0.15)), 2)))
    return n


def actions(db):
    """The 2024-25 gaps, what was done, and the 2025-26 result."""
    before = {o["code"]: o["attainment"] for o in A.programme_attainment(db, PROG, "2024-25")["outcomes"]}
    after = {o["code"]: o["attainment"] for o in A.programme_attainment(db, PROG, "2025-26")["outcomes"]}
    target = A.settings(db, PROG).po_target
    plans = {
        "PO6": ("Few course assignments engage with societal, legal and safety issues.",
                "Added a case-study assignment on societal impact to three theory courses; invited a guest lecture on cyber law."),
        "PO7": ("Sustainability is rarely assessed outside one elective.",
                "Added a 'green computing' question to the IoT and project reviews; NSS e-waste drive linked to the IoT lab."),
        "PO9": ("Most assessments are individual: teamwork is seldom assessed.",
                "Labs moved to pair / team experiments with peer review; Project Work-I team roles recorded and assessed."),
        "PO10": ("Students' technical writing and presentations score low in project reviews.",
                 "Introduced a report-writing workshop and a presentation rubric for all labs and Project Work-I."),
        "PO11": ("Project planning and costing are barely taught.",
                 "Software Project Management elective strengthened; Gantt chart and effort estimate made part of Project Work-I review 1."),
    }
    for po, (obs, act) in plans.items():
        b, a = before.get(po), after.get(po)
        if b is None or b >= target:
            continue
        db.add(ObeActionModel(programme=PROG, year="2024-25", outcome=po, attained=b, target=target, observation=obs, action=act,
                              responsible="Programme Assessment Committee (IT)", due=date(2025, 7, 31), status="done",
                              result=f"{po} attainment rose from {b:.2f} in 2024-25 to {a:.2f} in 2025-26." if a is not None else None,
                              created_by="PAC", pilot_run=RUN))


if __name__ == "__main__":
    main()
