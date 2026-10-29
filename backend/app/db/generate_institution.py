"""
Generate five years (2021-22 to 2025-26, and the year in progress) of institution records for NAAC criteria 4-7
and NBA 1, 4.5-4.6, 6, 9-10:

  progression  IT graduates going to higher studies, qualifying GATE / GRE / CAT, starting up; student awards (sports,
               cultural, technical, by level); college events; alumni contributions. Students are described by batch,
               not named or given real roll numbers
  figures      expenditure excluding salary, infrastructure and maintenance spending, library (books, e-resources,
               footfall, volumes), computers, bandwidth, ICT rooms, audits, solar, rainwater harvesting
  meetings     IQAC, Board of Studies (IT), Academic Council, Governing Body, Finance Committee, DAB / PAC (IT), anti-
               ragging, grievance and ICC meetings with their decisions (older ones carried out, recent ones open);
               no minutes are attached

Every generated row carries pilot_run = RUN, so `--remove` deletes exactly this data.

Usage (from the project root):
    python backend/app/db/generate_institution.py            # (re)generate; removes an earlier run first
    python backend/app/db/generate_institution.py --remove
"""
import argparse
import random
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import backend.app.main  # noqa: E402,F401  (every table registered and migrated, like the server)
from backend.app.db.session import SessionLocal  # noqa: E402
from backend.app.models.institution import InstitutionStatModel, MeetingModel, StudentAchievementModel  # noqa: E402

RUN = "it-institution-2026"
YEARS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26", "2026-27"]
rng = random.Random(1983)

HIGHER = ["M.Tech, IIIT Hyderabad", "M.Tech, NIT Warangal", "M.Tech, JNTU Hyderabad", "M.S. Computer Science, a US university",
          "M.S. Data Science, a German university", "MBA, IIM (CAT)", "M.Tech, University of Hyderabad", "M.Sc. AI, a UK university"]
EXAMS = ["GATE (CS)", "GATE (DA)", "GRE", "CAT", "TOEFL / IELTS", "GATE (CS)"]
AWARDS = [("sports", "Inter-college athletics, 400 m"), ("sports", "Osmania University cricket"), ("sports", "State-level kabaddi"),
          ("cultural", "Inter-college dance competition"), ("cultural", "Classical music, youth festival"),
          ("technical", "Smart India Hackathon"), ("technical", "Inter-college coding contest"), ("technical", "Project expo")]
EVENTS = [("technical", "Annual technical symposium"), ("cultural", "Annual cultural fest"), ("sports", "Annual sports meet"),
          ("technical", "24-hour hackathon"), ("cultural", "Ethnic day"), ("sports", "Inter-department cricket league"),
          ("technical", "Industry tech talk series"), ("cultural", "Telugu literary fest")]
DECISIONS = {
    "iqac": ["Conduct the academic audit of all departments", "Prepare and upload the AQAR", "Collect feedback from all stakeholders",
             "Organise an FDP on outcome-based education", "Review attendance below 75% each month"],
    "bos": ["Revise the scheme of the R25 regulation", "Introduce Cloud Computing as a professional elective",
            "Add a mini project in the 5th semester", "Update the lab manuals"],
    "academic_council": ["Approve the revised curricula", "Approve the academic calendar", "Approve new value-added courses"],
    "governing_body": ["Approve the annual budget", "Approve new faculty recruitment", "Approve the perspective plan review"],
    "finance": ["Approve lab equipment purchases", "Approve the library e-resource renewal", "Review the audited statements"],
    "dab": ["Review PEOs with industry members", "Strengthen industry internships"],
    "pac": ["Review CO-PO attainment", "Plan actions on POs below target", "Review course files"],
    "anti_ragging": ["Squad visits to hostels and buses", "Display anti-ragging helpline notices"],
    "grievance": ["Resolve pending student grievances", "Publish the grievance procedure"],
    "icc": ["Gender-sensitisation workshop", "Review complaints received"],
}
PLAN = {"iqac": (4, None), "bos": (2, "IT"), "academic_council": (2, None), "governing_body": (2, None), "finance": (2, None),
        "dab": (2, "IT"), "pac": (3, "IT"), "anti_ragging": (2, None), "grievance": (2, None), "icc": (2, None)}


def remove(db) -> dict:
    n = {}
    for name, model in (("achievements", StudentAchievementModel), ("figures", InstitutionStatModel), ("meetings", MeetingModel)):
        n[name] = db.query(model).filter(model.pilot_run == RUN).delete(synchronize_session=False)
    db.commit()
    return n


def ydate(year: str) -> date:
    return date(int(year[:4]), 7, 1) + timedelta(days=rng.randint(15, 330))


def main():
    ap = argparse.ArgumentParser(description="Generate (or remove) institution records")
    ap.add_argument("--remove", action="store_true")
    args = ap.parse_args()
    db = SessionLocal()
    try:
        gone = remove(db)
        if args.remove:
            print(f"Removed the institution records: {gone}")
            return
        n = 0
        for yi, year in enumerate(YEARS):
            current = year == YEARS[-1]
            batch = int(year[:4]) - 3                     # the batch graduating that year
            scale = 0.4 if current else 1
            add = lambda **kw: db.add(StudentAchievementModel(year=year, on_date=kw.pop("on_date", ydate(year)), pilot_run=RUN, **kw))  # noqa: E731
            for i in range(round(rng.randint(10, 15) * scale)):
                add(kind="higher_studies", programme="IT", student_name=f"Graduate {i + 1} · batch {batch}", title=rng.choice(HIGHER))
                n += 1
            for i in range(round(rng.randint(9, 16) * scale)):
                add(kind="exam", programme="IT", student_name=f"Student {i + 1} · batch {batch}", title=f"{rng.choice(EXAMS)} {int(year[:4]) + 1}")
                n += 1
            if rng.random() < 0.6:
                add(kind="startup", programme="IT", student_name=f"Graduate · batch {batch}", title="Student startup incubated at the IIC")
                n += 1
            for _ in range(round(rng.randint(8, 14) * scale)):
                cat, title = rng.choice(AWARDS)
                add(kind="award", programme=rng.choice(["IT", None]), category=cat, title=title,
                    level=rng.choices(["college", "state", "national", "international"], [3, 4, 2, 0.4])[0])
                n += 1
            for cat, title in rng.sample(EVENTS, round(rng.randint(6, 8) * scale)):
                add(kind="event", programme=None, category=cat, title=f"{title} {int(year[:4]) + 1}", participants=rng.randint(150, 1200))
                n += 1
            if not current:
                for _ in range(rng.randint(1, 3)):
                    add(kind="alumni_contribution", programme=None, title=rng.choice(["Scholarship fund for meritorious students", "Lab equipment donation",
                                                                                     "Library books donation", "Guest lectures and mentoring"]),
                        amount_lakh=round(rng.uniform(0.5, 4), 2))
                    n += 1
            # Yearly figures (the year in progress: what is known so far)
            g = 1 + 0.06 * yi
            figures = {"expenditure_total": round(rng.uniform(950, 1050) * g, 1), "infra_augmentation": round(rng.uniform(140, 210) * g, 1),
                       "maintenance": round(rng.uniform(85, 120) * g, 1), "library_books_spend": round(rng.uniform(11, 18) * g, 2),
                       "library_eresources": 4 + min(2, yi // 2), "library_footfall": rng.randint(340, 470), "library_volumes": 62000 + 2100 * yi,
                       "computers": 960 + 45 * yi, "bandwidth_mbps": [500, 500, 1000, 1000, 1500, 1500][yi], "smart_rooms": 38 + 5 * yi,
                       "solar_kw": [100, 100, 160, 160, 250, 250][yi]}
            for k, v in figures.items():
                if current and k in ("expenditure_total", "infra_augmentation", "maintenance", "library_books_spend"):
                    continue
                db.add(InstitutionStatModel(key=k, year=year, value=v, pilot_run=RUN))
            for k, v in {"green_audit": "yes" if yi >= 1 else "no", "gender_audit": "yes" if yi >= 2 else "no", "rainwater_harvesting": "yes"}.items():
                if not current:
                    db.add(InstitutionStatModel(key=k, year=year, text=v, pilot_run=RUN))
            # Meetings
            for body, (per_year, prog) in PLAN.items():
                for k in range(per_year if not current else max(1, per_year // 2)):
                    held = date(int(year[:4]), 7, 1) + timedelta(days=int((k + 0.5) * (365 if not current else 110) / per_year) + rng.randint(-10, 10))
                    picks = rng.sample(DECISIONS[body], min(len(DECISIONS[body]), rng.randint(2, 3)))
                    db.add(MeetingModel(body=body, programme=prog, held_on=held, year=year, attendees=rng.randint(8, 24),
                                        agenda=f"{'; '.join(picks)}.", pilot_run=RUN,
                                        decisions=[{"text": d, "owner": "IQAC" if body == "iqac" else "HOD (IT)" if prog else "Principal",
                                                    "status": "open" if current or (yi == len(YEARS) - 2 and rng.random() < 0.3) else "done"}
                                                   for d in picks]))
        db.commit()
    finally:
        db.close()
    print(f"Institution records generated: {n} progression / achievement records, yearly figures and statutory meetings for {len(YEARS)} years")


if __name__ == "__main__":
    main()
