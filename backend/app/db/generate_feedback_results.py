"""
Generate five years of IT feedback and examination results: what NAAC 1.4, 2.5, 2.6 and NBA 4, 7, 9 look for.

  feedback   2021-22 to 2025-26: students on the curriculum and on facilities, teachers on the curriculum, alumni,
             employers and parents; students on their teachers for six courses (two latest years); the Student
             Satisfaction Survey dry run (2025-26). Each closed form has an analysis-based action-taken report, approved
             by the IQAC and (except teachers' own feedback) published. 2026-27: the curriculum and facilities forms are
             open now, part-answered
  results    every semester's regular examination 2021-22 to 2025-26 (appeared, passed, dates, grievances) and the
             admission batches 2018-2024 from intake to graduation (enrolment, success, academic performance)

Every generated row carries pilot_run = RUN, so `--remove` deletes exactly this data.

Usage (from the project root):
    python backend/app/db/generate_feedback_results.py            # (re)generate; removes an earlier run first
    python backend/app/db/generate_feedback_results.py --remove
"""
import argparse
import random
import secrets
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import backend.app.main  # noqa: E402,F401  (every table registered and migrated, like the server)
from backend.app.api.v1.endpoints.feedback import R, TEMPLATES, _questions  # noqa: E402
from backend.app.db.session import SessionLocal  # noqa: E402
from backend.app.models.feedback import (  # noqa: E402
    BatchOutcomeModel, FeedbackATRModel, FeedbackFormModel, FeedbackResponseModel, ResultSummaryModel,
)
from backend.app.models.obe import ObeCourseModel  # noqa: E402

RUN = "it-feedback-2026"
PROG = "IT"
YEARS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"]
CURRENT = "2026-27"
rng = random.Random(1981)

# Statements that score lower here: the ATRs act on them, and they improve over the years
WEAK = {"Electives give real choice": 0.55, "The syllabus is revised often enough": 0.5, "Internet / Wi-Fi works reliably": 0.8,
        "The canteen is hygienic and affordable": 0.6, "Placement support was effective": 0.4, "Communication skills": 0.5,
        "Transport is reliable": 0.45, "Teachers discuss your performance in assignments with you": 0.45}
COMMENTS = {
    "curriculum": ["More industry-oriented electives please", "Add a cloud computing course", "Labs need more time",
                   "Mini projects in every semester would help", "Good syllabus overall"],
    "facilities": ["Wi-Fi drops in the IT block", "Canteen prices went up", "More buses on the Nadergul route",
                   "Library should open on Sundays before exams", "Labs are well maintained"],
    "faculty": ["Introduce more hands-on electives", "Lab equipment for IoT needs upgrading"],
    "alumni": ["Mock interviews helped me a lot", "Communication training should start in the 2nd year", "Proud of MVSR"],
    "employer": ["Good technical base; soft skills can improve", "Students adapt quickly to our stack"],
    "parent": ["Attendance SMS would be helpful", "Happy with the progress of our ward"],
    "teaching": ["Explains with good examples", "Please share notes before class", "Very supportive"],
    "sss": ["Mentoring meetings were useful", "More ICT use in classes"],
}
ACTIONS = {
    "Electives give real choice": "Board of Studies added two professional electives (Cloud Computing, DevOps) to the R21 scheme.",
    "The syllabus is revised often enough": "Syllabus review now every year in the BoS with an industry member; 18% content revised.",
    "Internet / Wi-Fi works reliably": "Bandwidth upgraded and access points added in the CS & IT block.",
    "The canteen is hygienic and affordable": "Canteen committee with student members; weekly hygiene audit; price list displayed.",
    "Placement support was effective": "Training moved to the 3rd year; aptitude and mock-interview sessions every Saturday.",
    "Communication skills": "Soft-skills course and presentation rubric in all labs; English communication lab hours added.",
    "Transport is reliable": "Two more buses on the Nadergul and Dilsukhnagar routes.",
    "Teachers discuss your performance in assignments with you": "Assignment feedback session made part of every course plan.",
}


def remove(db) -> dict:
    forms = [f for (f,) in db.query(FeedbackFormModel.id).filter(FeedbackFormModel.pilot_run == RUN)]
    n = {"responses": db.query(FeedbackResponseModel).filter(FeedbackResponseModel.form_id.in_(forms)).delete(synchronize_session=False),
         "atrs": db.query(FeedbackATRModel).filter(FeedbackATRModel.form_id.in_(forms)).delete(synchronize_session=False),
         "forms": db.query(FeedbackFormModel).filter(FeedbackFormModel.pilot_run == RUN).delete(synchronize_session=False),
         "results": db.query(ResultSummaryModel).filter(ResultSummaryModel.pilot_run == RUN).delete(synchronize_session=False),
         "batches": db.query(BatchOutcomeModel).filter(BatchOutcomeModel.pilot_run == RUN).delete(synchronize_session=False)}
    db.commit()
    return n


def rating(text: str, year_i: int) -> int:
    """A 1-5 answer: most statements average about 4; weak ones lower, improving each year as the actions take hold."""
    weak = WEAK.get(text, 0) * max(0.2, 1 - 0.18 * year_i)
    mean = 4.05 - weak + rng.uniform(-0.25, 0.25)
    return max(1, min(5, round(rng.gauss(mean, 0.8))))


def add_form(db, kind, year, year_i, n, programme=PROG, course=None, status="closed", study_year=None, title=None):
    label, audience, _ = TEMPLATES[kind]
    start = int(year[:4])
    closes = datetime(start + 1, 4, 15) if status == "closed" else datetime.utcnow() + timedelta(days=12)
    f = FeedbackFormModel(title=title or f"{label}{f' · {course.code} {course.name}' if course else ''}{f' · {programme}' if programme else ''} · {year}",
                          kind=kind, audience=audience, programme=programme, year=year, study_year=study_year,
                          course_id=course.id if course else None, questions=_questions(kind, []), status=status,
                          opens_at=closes - timedelta(days=21), closes_at=closes,
                          public_code=secrets.token_urlsafe(8) if audience == "public" else None,
                          salt=secrets.token_hex(16), created_by="IQAC", pilot_run=RUN)
    db.add(f)
    db.flush()
    role = {"students": "student", "faculty": "faculty"}.get(audience)
    for _ in range(n):
        answers = {q["id"]: rating(q["text"], year_i) for q in f.questions if q["type"] == R}
        if rng.random() < 0.18:
            answers["comment"] = rng.choice(COMMENTS.get(kind, ["Good"]))
        db.add(FeedbackResponseModel(form_id=f.id, respondent=secrets.token_hex(16), answers=answers, pilot_run=RUN,
                                     role=role or rng.choice({"alumni": ["alumni"], "employer": ["employer"], "parent": ["parent"]}.get(kind, ["alumni"])),
                                     submitted_at=f.opens_at + timedelta(days=rng.uniform(0, 20))))
    if status == "closed":
        atr(db, f, year, kind)
    return f


def atr(db, f, year, kind):
    """Observations from the lowest-rated statements, and what was done."""
    db.flush()                                        # the responses just added
    rows = [r.answers for r in db.query(FeedbackResponseModel).filter(FeedbackResponseModel.form_id == f.id)]
    means = []
    for q in f.questions:
        if q["type"] == R:
            vals = [a[q["id"]] for a in rows if q["id"] in a]
            means.append((sum(vals) / len(vals), q["text"]))
    means.sort()
    low = [t for m, t in means[:2]]
    overall = sum(m for m, _ in means) / len(means)
    obs = (f"{len(rows)} responses; overall {overall:.2f} / 5. Lowest rated: " + "; ".join(f"'{t}' ({m:.2f})" for m, t in means[:2]) +
           f". Highest: '{means[-1][1]}' ({means[-1][0]:.2f}).")
    acts = " ".join(ACTIONS.get(t, f"Discussed '{t}' in the department meeting; action plan with the HOD.") for t in low)
    published = kind != "teaching" and not (year == YEARS[-1] and kind == "facilities")   # one still awaiting publication
    start = int(year[:4])
    db.add(FeedbackATRModel(form_id=f.id, observations=obs, actions=acts, status="approved", approved_by="IQAC",
                            approved_at=datetime(start + 1, 5, 20), published=published,
                            published_at=datetime(start + 1, 6, 5) if published else None, updated_by="IQAC", pilot_run=RUN))


def main():
    ap = argparse.ArgumentParser(description="Generate (or remove) IT feedback and results history")
    ap.add_argument("--remove", action="store_true")
    args = ap.parse_args()
    db = SessionLocal()
    try:
        gone = remove(db)
        if args.remove:
            print(f"Removed the IT feedback and results data: {gone}")
            return
        n_forms = 0
        for i, year in enumerate(YEARS):
            add_form(db, "curriculum", year, i, rng.randint(330, 420))
            add_form(db, "facilities", year, i, rng.randint(380, 470), programme=None)
            add_form(db, "faculty", year, i, rng.randint(18, 24))
            add_form(db, "alumni", year, i, rng.randint(35, 70))
            add_form(db, "employer", year, i, rng.randint(9, 16))
            add_form(db, "parent", year, i, rng.randint(55, 110))
            n_forms += 6
            if year in YEARS[-2:]:
                courses = db.query(ObeCourseModel).filter(ObeCourseModel.programme == PROG, ObeCourseModel.year == year,
                                                          ObeCourseModel.kind == "theory").order_by(ObeCourseModel.code).limit(6).all()
                for c in courses:
                    add_form(db, "teaching", year, i, rng.randint(40, 62), course=c, study_year=(c.semester + 1) // 2)
                    n_forms += 1
        add_form(db, "sss", YEARS[-1], len(YEARS) - 1, 412, programme=None, title="Student Satisfaction Survey (dry run) · 2025-26")
        add_form(db, "curriculum", CURRENT, len(YEARS), 96, status="open")
        add_form(db, "facilities", CURRENT, len(YEARS), 133, programme=None, status="open")
        n_forms += 3

        # Results: every semester's regular examination (odd: Nov-Jan, even: Apr-Jun)
        n_results = 0
        for year in YEARS:
            start = int(year[:4])
            for sem in range(1, 9):
                odd = sem % 2
                last = date(start, 12, 18) if odd else date(start + 1, 5, 30)
                appeared = rng.randint(176, 205)
                pass_pct = rng.uniform(0.80, 0.93) + (0.04 if sem >= 7 else 0)
                passed = min(appeared, round(appeared * pass_pct))
                db.add(ResultSummaryModel(programme=PROG, year=year, semester=sem, exam="regular", last_exam_on=last,
                                          declared_on=last + timedelta(days=rng.randint(18, 34)), appeared=appeared, passed=passed,
                                          distinction=round(passed * rng.uniform(0.18, 0.3)), first_class=round(passed * rng.uniform(0.45, 0.55)),
                                          mean_sgpa=round(rng.uniform(7.1, 8.0), 2), complaints=rng.randint(0, 4), pilot_run=RUN))
                n_results += 1
        # Admission batches (graduating 2022-2028)
        for batch in range(2018, 2025):
            admitted = rng.randint(171, 180)
            lateral = rng.randint(14, 19)
            graduated = batch + 4 <= 2026
            base = admitted + lateral
            clean = round(base * rng.uniform(0.72, 0.82)) if graduated else None
            backlog = round(base * rng.uniform(0.07, 0.12)) if graduated else None
            app2 = admitted + lateral - rng.randint(2, 6)
            app3 = app2 - rng.randint(1, 5)
            third_done = batch + 3 <= 2026
            db.add(BatchOutcomeModel(programme=PROG, batch=batch, intake=180, admitted=admitted, lateral=lateral,
                                     graduated_clean=clean, graduated_backlog=backlog,
                                     cgpa_2nd=round(rng.uniform(7.0, 7.7), 2) if batch + 2 <= 2026 else None,
                                     passed_2nd=round(app2 * rng.uniform(0.82, 0.9)) if batch + 2 <= 2026 else None,
                                     appeared_2nd=app2 if batch + 2 <= 2026 else None,
                                     cgpa_3rd=round(rng.uniform(7.2, 7.9), 2) if third_done else None,
                                     passed_3rd=round(app3 * rng.uniform(0.85, 0.93)) if third_done else None,
                                     appeared_3rd=app3 if third_done else None, pilot_run=RUN))
        db.commit()
    finally:
        db.close()
    print(f"IT feedback and results generated: {n_forms} feedback forms with ATRs ({len(YEARS)} years + 2 open now), "
          f"{n_results} semester results, 7 admission batches")


if __name__ == "__main__":
    main()
