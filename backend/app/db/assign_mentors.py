"""
Give every student of a branch who has no mentor yet a provisional mentor from that branch's faculty, evenly:
students in year / section / roll order are split into one block per faculty member, so each mentor gets a run of
consecutive roll numbers (about the same number each). Mentors approve their students' certificate requests.
The HOD (or admin) can change any mentor afterwards; students who already have one keep theirs.

Faculty holding HOD / Associate HOD for the branch are left out (they approve later in the same chain).

Usage (from the project root):
    python backend/app/db/assign_mentors.py --branch IT --dry-run
    python backend/app/db/assign_mentors.py --branch IT
"""
import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.db.migrations import ensure_columns  # noqa: E402
from backend.app.db.session import SessionLocal, engine  # noqa: E402
from backend.app.models.campus import UserModel  # noqa: E402
from backend.app.models.services import ApproverAssignmentModel, StudentProfileModel  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description="Assign provisional mentors evenly")
    ap.add_argument("--branch", required=True, help="e.g. IT")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    branch = args.branch.strip().upper()
    ensure_columns(engine)
    db = SessionLocal()
    try:
        heads = {a.user_id for a in db.query(ApproverAssignmentModel).filter(
            ApproverAssignmentModel.role.in_(["hod", "ahod"]), ApproverAssignmentModel.department == branch)}
        faculty = [f for f in db.query(UserModel).filter(UserModel.role == "faculty", UserModel.department == branch,
                                                         UserModel.status == "active").order_by(UserModel.name)
                   if f.id not in heads]
        students = db.query(StudentProfileModel).filter(StudentProfileModel.department == branch,
                                                        StudentProfileModel.mentor_id.is_(None)).all()
        students.sort(key=lambda p: (p.year or 9, p.section or "", p.roll_no or ""))
        if not faculty:
            sys.exit(f"No active {branch} faculty accounts to be mentors")
        per, extra = divmod(len(students), len(faculty))
        i, plan = 0, []
        for k, f in enumerate(faculty):
            n = per + (1 if k < extra else 0)
            block = students[i:i + n]
            i += n
            for p in block:
                p.mentor_id = f.id
            if block:
                plan.append((f.name, len(block), *(f"Y{p.year}{p.section} {p.roll_no}" for p in (block[0], block[-1]))))  # plain values
        if args.dry_run:
            db.rollback()
        else:
            db.commit()
    finally:
        db.close()

    for name, n, a, b in plan:
        print(f"{name:<26} {n:>3} students  {a}  ->  {b}")
    print(f"{'Would assign' if args.dry_run else 'Assigned'} {sum(p[1] for p in plan)} {branch} students to "
          f"{len(plan)} mentors (provisional; the HOD can change them).")


if __name__ == "__main__":
    main()
