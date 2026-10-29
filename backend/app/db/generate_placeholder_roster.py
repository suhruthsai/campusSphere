"""
Generate a PLACEHOLDER roll list for a branch whose official roll list isn't available yet, so the
Civil & IT Block pilot can be demonstrated end to end. These are invented students, not real ones:

  - roll numbers look like GEN-CIVIL-23-001, a format no real MVSR roll number has, so the roll-number
    check when a student fills in their profile can never match one;
  - every row's source starts with "GENERATED" and its notes say it is a placeholder (shown on the
    Roll list page); the accreditation report marks metrics built on them as Simulated, not Live;
  - importing the official roll list (import_roll_lists.py) adds the real students; remove the
    placeholders with --remove.

Usage (from the project root):
    python backend/app/db/generate_placeholder_roster.py --branch CIVIL --per-class 70
    python backend/app/db/generate_placeholder_roster.py --branch CIVIL --remove
"""
import argparse
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.db.import_roll_lists import academic_year  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.models.services import RosterEntryModel  # noqa: E402

PLACEHOLDER_SOURCE = "GENERATED placeholder"
NOTE = "Generated placeholder, not a real student. Replace with the official roll list."

FIRST = ["Aarav", "Abhinav", "Akhil", "Anil", "Arjun", "Bharath", "Charan", "Chaitanya", "Deepak", "Dinesh",
         "Ganesh", "Harsha", "Karthik", "Kiran", "Krishna", "Mahesh", "Manoj", "Naveen", "Nikhil", "Pavan",
         "Pranay", "Rahul", "Rajesh", "Ravi", "Rohith", "Sai", "Sandeep", "Srikanth", "Suresh", "Teja",
         "Varun", "Vamshi", "Vinay", "Vivek", "Yashwanth", "Akshaya", "Anusha", "Bhavana", "Deepika", "Divya",
         "Harika", "Keerthi", "Lahari", "Meghana", "Mounika", "Navya", "Pooja", "Pranavi", "Ramya", "Sahithi",
         "Sindhu", "Sneha", "Sravani", "Swathi", "Tejaswini", "Varshitha", "Vyshnavi", "Yamini"]
LAST = ["Reddy", "Rao", "Goud", "Naidu", "Sharma", "Varma", "Chary", "Yadav", "Kumar", "Prasad",
        "Mudiraj", "Nayak", "Patel", "Chowdary", "Murthy", "Babu", "Shetty", "Raju", "Achari", "Gupta"]


def generate(db, branch: str, per_class: int, seed: int = 2026) -> int:
    rng = random.Random(f"{branch}-{seed}")
    ay = academic_year()
    start = int(ay[:4])
    added = 0
    for year in (1, 2, 3, 4):
        admitted = start - (year - 1)
        for n in range(1, per_class + 1):
            roll = f"GEN-{branch}-{admitted % 100:02d}-{n:03d}"
            row = db.get(RosterEntryModel, roll) or RosterEntryModel(roll_no=roll)
            row.name = f"{rng.choice(FIRST)} {rng.choice(LAST)}".upper()
            row.father_name = None
            row.department = branch
            row.year = year
            row.section = "A"
            row.email = None
            row.admission_year = admitted
            row.academic_year = ay
            row.source = f"{PLACEHOLDER_SOURCE} ({branch}, {per_class} per class)"
            row.notes = NOTE
            db.add(row)
            added += 1
    db.commit()
    return added


def remove(db, branch: str) -> int:
    q = db.query(RosterEntryModel).filter(RosterEntryModel.department == branch,
                                          RosterEntryModel.source.like(f"{PLACEHOLDER_SOURCE}%"))
    n = q.count()
    q.delete(synchronize_session=False)
    db.commit()
    return n


def main():
    ap = argparse.ArgumentParser(description="Generate (or remove) a placeholder roll list for one branch")
    ap.add_argument("--branch", required=True, help="Branch code as stored in the roll list, e.g. CIVIL")
    ap.add_argument("--per-class", type=int, default=70, help="Students per class; one class per year (default 70)")
    ap.add_argument("--remove", action="store_true", help="Delete this branch's placeholder rows")
    args = ap.parse_args()
    branch = args.branch.strip().upper()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if args.remove:
            print(f"Removed {remove(db, branch)} placeholder {branch} students.")
        else:
            n = generate(db, branch, args.per_class)
            print(f"Generated {n} placeholder {branch} students ({args.per_class} per class, years 1-4, section A).")
            print("They are marked GENERATED; accreditation metrics built on them show as Simulated.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
