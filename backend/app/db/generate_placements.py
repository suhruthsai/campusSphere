"""
Generate the IT placement season: what the Placement Cell's records look like for the IT final year (passing out
in 2027) from July to now, plus internships for the pre-final year and the numbers of earlier outgoing batches.

  drives         about a dozen companies from July, results declared; the one held yesterday awaits results; two
                 take registrations now; one opens next week. Dates move with the IT pilot (generate_it_pilot.py),
                 so the season always ends "now"
  applications   final-year IT students apply to most drives until they hold an offer; with one, only to drives
                 paying 1.5x their best offer (the college's one-offer rule)
  results        each round shortlists some students; stronger students (steadier attendance stands in for
                 academics) clear more rounds. Around 55-60% of the batch is placed so far, a few with two offers
  internships    pre-final year (2028) internships: one completed, one open, one coming
  earlier years  final numbers of the IT batches that passed out in 2022-2026 (eligible, placed, higher studies...)

Every generated row carries pilot_run = RUN, so `--remove` deletes exactly this data.

Usage (from the project root):
    python backend/app/db/generate_placements.py            # (re)generate; removes an earlier run first
    python backend/app/db/generate_placements.py --remove
"""
import argparse
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.db.generate_it_pilot import D, IST, TODAY, habit  # noqa: E402
from backend.app.db.migrations import ensure_columns  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.models import placements as _models  # noqa: E402,F401  (creates the tables)
from backend.app.models.campus import UserModel  # noqa: E402
from backend.app.models.placements import PlacementBatchSummaryModel, PlacementDriveModel, PlacementRegistrationModel  # noqa: E402
from backend.app.models.services import ApproverAssignmentModel, RosterEntryModel, StudentProfileModel  # noqa: E402

RUN = "it-placements-2026"
BRANCH = "IT"
FINAL, PREFINAL = 2027, 2028
SERVICE_BRANCHES = ["CSD", "CSE", "CSIT", "ECE", "IT"]
rng = random.Random(2027)

STD_ROUNDS = ["Online assessment", "Technical interview", "HR interview"]
# (company, role, kind, LPA or stipend, mode, location, drive date (first-run month, day), rounds, selectivity, branches)
JOBS = [
    ("Accenture", "Associate Software Engineer", 4.5, "on-campus", "Hyderabad", (7, 23), STD_ROUNDS + [], 0.17, SERVICE_BRANCHES),
    ("Capgemini", "Analyst", 4.25, "on-campus", "Hyderabad / Bengaluru", (8, 6), ["Pseudocode & game-based test", "Technical + HR interview"], 0.16, SERVICE_BRANCHES),
    ("TCS", "Digital", 7.0, "pool", "Pan India", (8, 20), ["TCS NQT (advanced)", "Technical interview", "Managerial + HR"], 0.05, SERVICE_BRANCHES),
    ("TCS", "Ninja", 3.36, "pool", "Pan India", (8, 20), ["TCS NQT", "Technical + HR interview"], 0.17, SERVICE_BRANCHES),
    ("Infosys", "Systems Engineer", 3.6, "virtual", "Mysuru training, then any DC", (9, 3), ["Online test", "Interview"], 0.17, SERVICE_BRANCHES),
    ("Cognizant", "GenC Next", 6.75, "on-campus", "Hyderabad / Chennai", (9, 10), ["Coding assessment", "Technical interview", "HR"], 0.07, ["CSE", "CSIT", "CSD", "IT"]),
    ("Deloitte", "Analyst Trainee", 7.6, "on-campus", "Hyderabad", (9, 17), ["Aptitude + JAM", "Group discussion", "Technical + HR"], 0.06, ["CSE", "CSIT", "CSD", "IT"]),
    ("Wipro", "Project Engineer", 3.5, "virtual", "Pan India", (9, 24), ["Online assessment", "Technical + HR interview"], 0.16, SERVICE_BRANCHES),
    ("ValueLabs", "Software Engineer", 5.0, "on-campus", "Hyderabad", (10, 1), ["Coding test", "Technical interview", "HR"], 0.10, ["CSE", "CSIT", "CSD", "IT"]),
    ("Darwinbox", "Associate Software Engineer", 12.0, "on-campus", "Hyderabad", (10, 8), ["Coding test", "Technical 1", "Technical 2", "HR"], 0.025, ["CSE", "CSIT", "IT"]),
    ("HCLTech", "Graduate Engineer Trainee", 4.25, "on-campus", "Chennai / Noida", (10, 15), STD_ROUNDS, 0.15, SERVICE_BRANCHES),
    ("Virtusa", "Associate Engineer", 5.5, "on-campus", "Hyderabad", (10, 28), ["Coding test", "Technical interview", "HR"], 0.12, ["CSE", "CSIT", "CSD", "IT"]),
]
OPEN_JOBS = [   # (company, role, LPA, mode, location, opened (m, d), closes in days from today, drive in days, rounds, branches)
    ("Tech Mahindra", "Associate Software Engineer", 3.25, "on-campus", "Hyderabad", (10, 22), 2, 8, STD_ROUNDS, SERVICE_BRANCHES),
    ("ServiceNow", "Associate Software Engineer", 18.0, "on-campus", "Hyderabad", (10, 26), 5, 14, ["Coding test", "Technical 1", "Technical 2", "Hiring manager"], ["CSE", "CSIT", "IT"]),
]
UPCOMING_JOBS = [  # opens in N days
    ("Providence India", "Software Engineer", 10.0, "on-campus", "Hyderabad", 6, 16, 24, ["Coding test", "Technical interview", "HR"], ["CSE", "CSIT", "IT"]),
]
INTERNSHIPS = [  # (company, role, stipend, (m, d) drive or None, open?, branches)
    ("Virtusa", "Winter Intern (6 weeks)", 10000, (10, 14), "done", ["CSE", "CSIT", "IT"]),
    ("T-Hub startups", "Summer Intern (8 weeks)", 15000, None, "open", SERVICE_BRANCHES),
    ("Darwinbox", "Summer Intern", 40000, None, "upcoming", ["CSE", "CSIT", "IT"]),
]
HISTORY = [  # IT batches that already passed out: (batch, eligible, placed, offers, higher studies, entrepreneurs, median, highest, recruiters)
    (2022, 158, 104, 121, 17, 2, 3.8, 12.0, 31),
    (2023, 164, 112, 133, 15, 1, 4.0, 14.5, 34),
    (2024, 171, 121, 140, 16, 3, 4.25, 16.0, 36),
    (2025, 176, 129, 151, 14, 2, 4.5, 21.0, 39),
    (2026, 183, 138, 162, 13, 3, 5.0, 24.0, 41),
]


def at(day, hhmm="10:00"):
    h, m = map(int, hhmm.split(":"))
    return datetime.combine(day, datetime.min.time()).replace(hour=h, minute=m) - IST


def remove(db) -> dict:
    drives = [d for (d,) in db.query(PlacementDriveModel.id).filter(PlacementDriveModel.pilot_run == RUN)]
    n = {"registrations": db.query(PlacementRegistrationModel).filter(
        PlacementRegistrationModel.drive_id.in_(drives) | (PlacementRegistrationModel.pilot_run == RUN)).delete(synchronize_session=False)}
    n["drives"] = db.query(PlacementDriveModel).filter(PlacementDriveModel.pilot_run == RUN).delete(synchronize_session=False)
    n["batches"] = db.query(PlacementBatchSummaryModel).filter(PlacementBatchSummaryModel.pilot_run == RUN).delete(synchronize_session=False)
    db.commit()
    return n


def skill(roll: str) -> float:
    """How a student fares in tests and interviews: steady attendance stands in for academics, plus luck."""
    return 0.55 * habit(roll) + 0.45 * random.Random(roll + "placement").random()


def main():
    ap = argparse.ArgumentParser(description="Generate (or remove) the IT placement season")
    ap.add_argument("--remove", action="store_true")
    args = ap.parse_args()
    Base.metadata.create_all(bind=engine)
    ensure_columns(engine)
    db = SessionLocal()
    try:
        gone = remove(db)
        if args.remove:
            print(f"Removed the IT placement data: {gone}")
            return
        if any(gone.values()):
            print(f"Removed the earlier run first: {gone}")
        # Drives are posted and results recorded by the Training & Placement Officer (else an admin)
        tpo = db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.role == "placement_officer").first()
        admin = (db.get(UserModel, tpo.user_id) if tpo else None) or             db.query(UserModel).filter(UserModel.role == "admin").order_by(UserModel.joined_at).first()
        users = {p.roll_no: p.user_id for p in db.query(StudentProfileModel).filter(StudentProfileModel.department == BRANCH)}
        roster = db.query(RosterEntryModel).filter(RosterEntryModel.department == BRANCH).all()
        final = sorted((r for r in roster if r.year == 4), key=lambda r: r.roll_no)
        prefinal = sorted((r for r in roster if r.year == 3), key=lambda r: r.roll_no)
        today = TODAY
        offers = {}                                   # roll -> best LPA so far
        n_drives = n_regs = n_sel = 0

        def add_drive(**kw):
            d = PlacementDriveModel(created_by=admin.id if admin else None, pilot_run=RUN,
                                    eligibility=kw.pop("eligibility", "60% or 6.5 CGPA throughout, no active backlogs"), **kw)
            db.add(d)
            db.flush()
            return d

        # ── Final year: completed drives, in date order (offers change who may apply next) ──
        for company, role, ctc, mode, loc, (m, dd), rounds, rate, branches in JOBS:
            day = D(m, dd)
            if day >= today:
                continue
            declared = day < today - timedelta(days=1)            # yesterday's drive: results awaited
            d = add_drive(company=company, role=role, kind="job", ctc_lpa=ctc, mode=mode, location=loc, departments=branches,
                          batch=FINAL, rounds=rounds, opens_at=at(day - timedelta(days=12), "09:00"),
                          register_by=at(day - timedelta(days=3), "23:59"), drive_date=day,
                          results_out=at(day + timedelta(days=rng.randint(2, 6)), "18:00") if declared else None,
                          description=f"{company} is hiring {role}s for the {FINAL} batch. CTC {ctc:g} LPA.")
            n_drives += 1
            applicants = []
            for r in final:
                best = offers.get(r.roll_no, 0)
                if best and ctc < 1.5 * best:
                    continue                                   # one-offer rule
                keen = 0.85 if not best else 0.55
                if habit(r.roll_no) < 0.45:
                    keen *= 0.4                                # students who hardly come rarely apply
                if rng.random() < keen:
                    applicants.append(r)
            ranked = sorted(applicants, key=lambda r: skill(r.roll_no) + rng.uniform(-0.12, 0.12), reverse=True)
            n_select = max(1, round(len(applicants) * rate)) if declared else 0
            n_short = max(n_select, round(len(applicants) * min(0.85, rate * 2.6)))
            for i, r in enumerate(ranked):
                reg_at = d.opens_at + timedelta(hours=rng.uniform(2, (d.register_by - d.opens_at).total_seconds() / 3600 - 1))
                if not declared:
                    status, rr = ("shortlisted", 1) if i < n_short else ("registered", 0)
                elif rng.random() < 0.03:
                    status, rr = "absent", 0
                elif i < n_select:
                    status, rr = "selected", len(rounds)
                    offers[r.roll_no] = max(offers.get(r.roll_no, 0), ctc)
                    n_sel += 1
                elif i < n_short:
                    status, rr = "not_selected", rng.randint(1, max(1, len(rounds) - 1))
                else:
                    status, rr = "not_selected", 0
                db.add(PlacementRegistrationModel(drive_id=d.id, roll_no=r.roll_no, user_id=users.get(r.roll_no), status=status,
                                                  round_reached=rr, registered_at=reg_at, updated_at=d.results_out or reg_at,
                                                  updated_by=admin.id if admin and declared else None, pilot_run=RUN))
                n_regs += 1

        # ── Final year: open now, and coming ──
        for company, role, ctc, mode, loc, (m, dd), closes, drive_in, rounds, branches in OPEN_JOBS:
            d = add_drive(company=company, role=role, kind="job", ctc_lpa=ctc, mode=mode, location=loc, departments=branches,
                          batch=FINAL, rounds=rounds, opens_at=at(D(m, dd), "09:00"),
                          register_by=at(today + timedelta(days=closes), "23:59"), drive_date=today + timedelta(days=drive_in),
                          description=f"{company} is hiring {role}s for the {FINAL} batch. CTC {ctc:g} LPA.")
            n_drives += 1
            for r in final:
                best = offers.get(r.roll_no, 0)
                if (best and ctc < 1.5 * best) or rng.random() > (0.55 if not best else 0.4):
                    continue
                reg_at = d.opens_at + timedelta(hours=rng.uniform(1, max(2, (datetime.utcnow() - d.opens_at).total_seconds() / 3600)))
                db.add(PlacementRegistrationModel(drive_id=d.id, roll_no=r.roll_no, user_id=users.get(r.roll_no),
                                                  registered_at=reg_at, pilot_run=RUN))
                n_regs += 1
        for company, role, ctc, mode, loc, opens_in, closes_in, drive_in, rounds, branches in UPCOMING_JOBS:
            add_drive(company=company, role=role, kind="job", ctc_lpa=ctc, mode=mode, location=loc, departments=branches, batch=FINAL,
                      rounds=rounds, opens_at=at(today + timedelta(days=opens_in), "09:00"),
                      register_by=at(today + timedelta(days=closes_in), "23:59"), drive_date=today + timedelta(days=drive_in),
                      description=f"{company} is hiring {role}s for the {FINAL} batch. CTC {ctc:g} LPA.")
            n_drives += 1

        # ── Pre-final year: internships ──
        for company, role, stipend, when, state, branches in INTERNSHIPS:
            if state == "done":
                day = D(*when)
                d = add_drive(company=company, role=role, kind="internship", stipend=stipend, mode="on-campus", location="Hyderabad",
                              departments=branches, batch=PREFINAL, rounds=["Coding test", "Interview"],
                              opens_at=at(day - timedelta(days=10)), register_by=at(day - timedelta(days=3), "23:59"),
                              drive_date=day, results_out=at(day + timedelta(days=4), "18:00"),
                              eligibility="No active backlogs", description=f"{role} at {company}, ₹{stipend:,} a month.")
                applicants = [r for r in prefinal if rng.random() < 0.45]
                ranked = sorted(applicants, key=lambda r: skill(r.roll_no), reverse=True)
                for i, r in enumerate(ranked):
                    status = "selected" if i < round(len(ranked) * 0.15) else "not_selected"
                    db.add(PlacementRegistrationModel(drive_id=d.id, roll_no=r.roll_no, user_id=users.get(r.roll_no), status=status,
                                                      round_reached=2 if status == "selected" else rng.randint(0, 1),
                                                      registered_at=d.opens_at + timedelta(days=rng.uniform(0.2, 6)),
                                                      updated_at=d.results_out, updated_by=admin.id if admin else None, pilot_run=RUN))
                    n_regs += 1
            else:
                opens = today - timedelta(days=4) if state == "open" else today + timedelta(days=9)
                d = add_drive(company=company, role=role, kind="internship", stipend=stipend, mode="virtual" if state == "open" else "on-campus",
                              location="Hyderabad", departments=branches, batch=PREFINAL, rounds=["Online test", "Interview"],
                              opens_at=at(opens), register_by=at(opens + timedelta(days=12), "23:59"),
                              drive_date=opens + timedelta(days=18), eligibility="No active backlogs",
                              description=f"{role} at {company}, ₹{stipend:,} a month.")
                if state == "open":
                    for r in prefinal:
                        if rng.random() < 0.35:
                            db.add(PlacementRegistrationModel(drive_id=d.id, roll_no=r.roll_no, user_id=users.get(r.roll_no),
                                                              registered_at=d.opens_at + timedelta(hours=rng.uniform(1, 90)), pilot_run=RUN))
                            n_regs += 1
            n_drives += 1

        # ── Earlier outgoing batches ──
        for batch, eligible, placed, offers_n, hs, ent, med, high, rec in HISTORY:
            db.add(PlacementBatchSummaryModel(department=BRANCH, batch=batch, eligible=eligible, placed=placed, offers=offers_n,
                                              higher_studies=hs, entrepreneurs=ent, median_ctc=med, highest_ctc=high,
                                              recruiters=rec, pilot_run=RUN))
        db.commit()
        placed = len(offers)
    finally:
        db.close()
    print(f"IT placements generated: {n_drives} drives, {n_regs} applications, {n_sel} offers to {placed} of "
          f"{len(final)} final-year students ({100 * placed / max(1, len(final)):.0f}%), {len(HISTORY)} earlier batches")


if __name__ == "__main__":
    main()
