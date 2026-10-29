"""
Generate IT faculty service records and six years of research and development (2021-22 to 2026-27), for NBA
criterion 5 and NAAC 2.4 / 3 / 6.3.

  records     every IT teacher on the faculty list (and the C-section AHOD): cadre, qualification (a 'Dr.' has a
              PhD), joining date, earlier experience; the HOD and two senior professors are recognised PhD guides.
              Four former teachers (left 2022-2025) are recorded by role, not by name, for the retention figure
  research    papers (indexed journals, conferences), books and chapters, patents, funded projects and consultancy,
              FDPs attended / organised, resource-person invitations, PhDs guided. Most are verified by the HOD;
              recent ones wait for verification. Generated items carry no evidence file or DOI
  activities  extension programmes (NSS and outreach), collaborations, IPR workshops; MoUs as published on the
              college website (TalentSprint, MEPAC3, TSCOST, Smart INFR-EST, IIT Bombay Spoken Tutorials)

Every generated row carries pilot_run = RUN, so `--remove` deletes exactly this data.

Usage (from the project root):
    python backend/app/db/generate_faculty_research.py            # (re)generate; removes an earlier run first
    python backend/app/db/generate_faculty_research.py --remove
"""
import argparse
import random
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import backend.app.main  # noqa: E402,F401  (every table registered and migrated, like the server)
from backend.app.db.session import SessionLocal  # noqa: E402
from backend.app.models.campus import FacultyProfileModel  # noqa: E402
from backend.app.models.research import DeptActivityModel, FacultyRecordModel, ResearchItemModel  # noqa: E402

RUN = "it-research-2026"
DEPT = "IT"
YEARS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26", "2026-27"]
rng = random.Random(2021)

PROFESSORS = {"FAC_AVK", "FAC_SAM"}                         # HOD and the senior professor
ASSOCIATES = {"FAC_VIJ", "FAC_VAS", "FAC_UGN", "FAC_RVS"}   # AHODs and senior doctorates
GUIDES = {"FAC_AVK", "FAC_SAM", "FAC_RVS"}
AREAS = ["machine learning", "network security", "cloud computing", "Internet of Things", "data mining", "blockchain",
         "natural language processing", "computer vision", "software engineering", "big data analytics"]
METHODS = ["A deep learning approach to", "An efficient framework for", "A lightweight scheme for", "Optimised algorithms for",
           "A comparative study of", "A hybrid model for", "Secure and scalable", "Explainable models for"]
TASKS = {"machine learning": ["crop yield prediction", "credit risk scoring", "student performance prediction"],
         "network security": ["intrusion detection in IoT networks", "phishing URL detection", "DDoS mitigation"],
         "cloud computing": ["task scheduling in cloud data centres", "energy-aware VM placement", "serverless workloads"],
         "Internet of Things": ["smart irrigation", "air-quality monitoring", "healthcare wearables"],
         "data mining": ["frequent pattern mining", "customer churn analysis", "outlier detection in sensor data"],
         "blockchain": ["land-record management", "academic credential verification", "supply-chain traceability"],
         "natural language processing": ["Telugu text summarisation", "fake news detection", "sentiment analysis of reviews"],
         "computer vision": ["plant disease detection", "traffic sign recognition", "crowd counting"],
         "software engineering": ["test-case prioritisation", "effort estimation", "defect prediction"],
         "big data analytics": ["real-time stream processing", "healthcare analytics", "smart-city data platforms"]}
AGENCIES = [("AICTE (Research Promotion Scheme)", 12, 20), ("DST-SERB", 18, 35), ("TSCOST", 3, 6), ("UGC (minor research project)", 4, 8)]


def remove(db) -> dict:
    recs = [r for (r,) in db.query(FacultyRecordModel.id).filter(FacultyRecordModel.pilot_run == RUN)]
    n = {"items": db.query(ResearchItemModel).filter(ResearchItemModel.faculty_id.in_(recs) | (ResearchItemModel.pilot_run == RUN)).delete(synchronize_session=False),
         "records": db.query(FacultyRecordModel).filter(FacultyRecordModel.pilot_run == RUN).delete(synchronize_session=False),
         "activities": db.query(DeptActivityModel).filter(DeptActivityModel.pilot_run == RUN).delete(synchronize_session=False)}
    db.commit()
    return n


def ydate(year: str) -> date:
    y = int(year[:4])
    return date(y, 7, 1) + timedelta(days=rng.randint(10, 340))


def main():
    ap = argparse.ArgumentParser(description="Generate (or remove) IT faculty records and research")
    ap.add_argument("--remove", action="store_true")
    args = ap.parse_args()
    db = SessionLocal()
    try:
        gone = remove(db)
        if args.remove:
            print(f"Removed the IT faculty and research data: {gone}")
            return
        if db.query(FacultyRecordModel.id).filter(FacultyRecordModel.department == DEPT).first():
            sys.exit("IT already has faculty records that this script didn't create: not touching them")
        records = []
        for p in db.query(FacultyProfileModel).filter(FacultyProfileModel.department == DEPT, FacultyProfileModel.is_active == True):  # noqa: E712
            phd = p.name.replace(" ", "").lower().startswith("dr.")
            desig = "Professor" if p.id in PROFESSORS else "Associate Professor" if p.id in ASSOCIATES or phd else "Assistant Professor"
            senior = desig != "Assistant Professor"
            joined = date(rng.randint(2002, 2012) if senior else rng.randint(2010, 2023), rng.choice([6, 7, 12]), rng.randint(1, 28))
            r = FacultyRecordModel(profile_id=p.id, name=p.name, department=DEPT, designation=desig,
                                   qualification="PhD" if phd else rng.choice(["M.Tech", "M.Tech", "M.Tech", "M.E"]),
                                   phd_year=rng.randint(2008, 2021) if phd else None, specialisation=rng.choice(AREAS),
                                   joined_on=joined, prior_experience=round(rng.uniform(1, 8) if senior else rng.uniform(0, 4), 1),
                                   industry_experience=round(rng.choice([0, 0, 0, 1, 2]), 1), net_set=not phd and rng.random() < 0.3,
                                   research_guide=p.id in GUIDES, pilot_run=RUN)
            db.add(r)
            records.append(r)
        records.append(FacultyRecordModel(name="Venu Gopal", department=DEPT, designation="Associate Professor", qualification="M.Tech",
                                          specialisation="computer networks", joined_on=date(2009, 7, 12), prior_experience=3.0, pilot_run=RUN))
        db.add(records[-1])
        for i, (joined, left) in enumerate([(2015, 2022), (2018, 2023), (2019, 2024), (2020, 2025)], 1):
            db.add(FacultyRecordModel(name=f"Former Assistant Professor {i} (left {left})", department=DEPT, designation="Assistant Professor",
                                      qualification="M.Tech", joined_on=date(joined, 7, 1), left_on=date(left, 5, 31),
                                      prior_experience=round(rng.uniform(0, 3), 1), pilot_run=RUN))
        db.flush()

        n = 0
        for yi, year in enumerate(YEARS):
            current = year == YEARS[-1]
            for r in records:
                if r.joined_on > date(int(year[:4]) + 1, 6, 30):
                    continue
                phd = r.qualification == "PhD"
                area = r.specialisation if r.specialisation in TASKS else rng.choice(AREAS)

                def item(kind, title, **kw):
                    nonlocal n
                    recent = current or (year == YEARS[-2] and rng.random() < 0.2)
                    db.add(ResearchItemModel(faculty_id=r.id, department=DEPT, kind=kind, title=title, year=year,
                                             on_date=kw.pop("on_date", ydate(year)), verified=not recent,
                                             verified_by="HOD" if not recent else None, created_by="faculty", pilot_run=RUN, **kw))
                    n += 1

                papers = (rng.choice([1, 1, 2, 2, 3]) if phd else rng.choice([0, 0, 1, 1])) // (2 if current else 1)
                for _ in range(papers):
                    item("journal", f"{rng.choice(METHODS)} {rng.choice(TASKS[area])}", indexing=rng.choice(["scopus", "scopus", "ugc_care", "wos"]),
                         status="published")
                for _ in range(rng.choice([0, 1, 1, 2]) // (2 if current else 1)):
                    item("conference", f"{rng.choice(METHODS)} {rng.choice(TASKS[area])}", indexing="scopus", status="published",
                         venue="International conference (IEEE / Springer proceedings)")
                if rng.random() < (0.5 if not current else 0.3):
                    item("fdp_attended", f"FDP on {rng.choice(AREAS).title()}", days=rng.choice([5, 5, 6, 10]), venue=rng.choice(
                        ["AICTE ATAL Academy", "NITTTR Chennai", "IIT Bombay (Spoken Tutorial)", "JNTUH", "NPTEL"]))
                if phd and rng.random() < 0.25:
                    item("resource_person", f"Invited talk: {area} in practice", venue="Engineering college FDP")
                if phd and rng.random() < 0.08 and not current:
                    item("chapter", f"{rng.choice(METHODS)} {rng.choice(TASKS[area])}", venue="Springer book series", status="published")
                if r.research_guide and not current and rng.random() < 0.6:
                    item("phd_guided", f"PhD awarded: {rng.choice(TASKS[area])}", status="awarded", venue="Osmania University")
            # Department-level research by year
            senior = [r for r in records if r.qualification == "PhD"]
            for _ in range(rng.randint(1, 2)):
                r = rng.choice(senior)
                agency, lo, hi = rng.choice(AGENCIES)
                db.add(ResearchItemModel(faculty_id=r.id, department=DEPT, kind="project", year=year, on_date=ydate(year),
                                         title=f"{rng.choice(METHODS)} {rng.choice(TASKS[rng.choice(AREAS)])}", venue=agency,
                                         amount_lakh=round(rng.uniform(lo, hi), 2), status="sanctioned" if current else rng.choice(["ongoing", "completed"]),
                                         verified=not current, verified_by=None if current else "HOD", pilot_run=RUN))
                n += 1
            for _ in range(rng.randint(1, 3)):
                r = rng.choice(senior)
                db.add(ResearchItemModel(faculty_id=r.id, department=DEPT, kind="patent", year=year, on_date=ydate(year),
                                         title=f"System and method for {rng.choice(TASKS[rng.choice(AREAS)])}", venue="Indian Patent Office",
                                         status=rng.choice(["filed", "published_patent", "published_patent", "granted"]),
                                         verified=not current, verified_by=None if current else "HOD", pilot_run=RUN))
                n += 1
            for _ in range(rng.randint(1, 2)):
                r = rng.choice(senior)
                db.add(ResearchItemModel(faculty_id=r.id, department=DEPT, kind="consultancy", year=year, on_date=ydate(year),
                                         title=f"Consultancy: {rng.choice(['software audit', 'web portal development', 'data analytics dashboard', 'network design review'])}",
                                         venue=rng.choice(["GHMC", "A Hyderabad IT firm", "TSIIC", "A state PSU"]), amount_lakh=round(rng.uniform(0.8, 4.5), 2),
                                         status="completed", verified=not current, verified_by=None if current else "HOD", pilot_run=RUN))
                n += 1
            for t in rng.sample(["Machine Learning with Python", "Cyber Security Essentials", "Full Stack Development", "Research Methodology",
                                 "Outcome-Based Education", "IoT and Embedded Systems"], 2):
                r = rng.choice(records[:10])
                db.add(ResearchItemModel(faculty_id=r.id, department=DEPT, kind="fdp_organised", year=year, on_date=ydate(year),
                                         title=f"FDP: {t}", days=5, status="completed", verified=not current,
                                         verified_by=None if current else "HOD", pilot_run=RUN))
                n += 1

            # Activities
            for t in rng.sample(["NSS special camp at Nadergul village", "Digital literacy drive for school students", "Blood donation camp",
                                 "Tree plantation drive", "Swachh Bharat cleanliness drive", "Cyber-safety awareness for senior citizens",
                                 "Free coding workshop for government school students", "Voter awareness programme"], rng.randint(4, 6)):
                db.add(DeptActivityModel(kind="extension", department=DEPT if "coding" in t or "Cyber" in t or "Digital" in t else None,
                                         title=t, year=year, on_date=ydate(year), participants=rng.randint(40, 220), pilot_run=RUN))
            db.add(DeptActivityModel(kind="ipr_workshop", department=DEPT, title=rng.choice(["Workshop on IPR and patent filing",
                                     "Research methodology workshop", "Startup and innovation bootcamp (IIC)"]), year=year,
                                     on_date=ydate(year), participants=rng.randint(60, 150), pilot_run=RUN))
            for _ in range(rng.randint(1, 2)):
                db.add(DeptActivityModel(kind="collaboration", department=DEPT, title=rng.choice(["Student internships with an industry partner",
                                         "Faculty industry immersion programme", "Joint workshop with a partner institution"]),
                                         year=year, on_date=ydate(year), participants=rng.randint(10, 60), pilot_run=RUN))
        # MoUs as published on the college website (AICTE disclosure 17.4)
        for partner, signed, yr in [("TalentSprint", date(2020, 8, 1), "2020-21"), ("MEPAC3 Engineering Solutions Pvt. Ltd.", date(2019, 9, 1), "2019-20"),
                                    ("Telangana State Council of Science & Technology (TSCOST)", date(2019, 2, 1), "2018-19"),
                                    ("Smart INFR-EST", date(2019, 3, 1), "2018-19"), ("IIT Bombay (Spoken Tutorials)", date(2017, 7, 1), "2017-18")]:
            db.add(DeptActivityModel(kind="mou", department=None, title=f"MoU with {partner}", partner=partner, year=yr, on_date=signed,
                                     valid_until=date(signed.year + 8, signed.month, 1), link="https://mvsrec.edu.in/index.php?id=1737&option=com_content&view=article",
                                     description="As listed in the college's AICTE mandatory disclosure (MoUs).", pilot_run=RUN))
        db.commit()
    finally:
        db.close()
    print(f"IT faculty and research generated: {len(records) + 4} service records ({len(records)} current, 4 former), "
          f"{n} research items, MoUs and activities for {len(YEARS)} years")


if __name__ == "__main__":
    main()
