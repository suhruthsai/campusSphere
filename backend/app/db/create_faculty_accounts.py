"""
Create a sign-in account for every faculty member in the timetable's faculty list, with the SAME email as their
faculty profile: that email is what links an account to its timetable (My Day, Attendance → today's periods,
section reports). Nothing is emailed to anyone.

  - skips anyone who already has an account with that email (it is already linked);
  - each new account gets a random temporary password; the logins are written to
    backend/app/db/faculty_accounts.local.txt (git-ignored, personal data: never commit or share it) so the
    Admin Office can hand them out. Faculty should change it under My account after signing in;
  - --dry-run shows what would happen; --remove deletes only the accounts this script created (ids "u_fac_...").

Usage (from the project root):
    python backend/app/db/create_faculty_accounts.py --dry-run
    python backend/app/db/create_faculty_accounts.py
    python backend/app/db/create_faculty_accounts.py --remove
"""
import argparse
import secrets
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.core.security import get_password_hash  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.models.campus import FacultyProfileModel, UserModel  # noqa: E402

OUT = Path(__file__).resolve().parent / "faculty_accounts.local.txt"
PREFIX = "u_fac_"


def _dept(d: str) -> str:
    return (d or "").strip().upper()


def create(db, dry_run: bool) -> tuple[list, list]:
    created, skipped = [], []
    today = datetime.utcnow().strftime("%Y-%m-%d")
    for f in db.query(FacultyProfileModel).filter(FacultyProfileModel.is_active == True).order_by(  # noqa: E712
            FacultyProfileModel.department, FacultyProfileModel.name).all():
        email = (f.email or "").strip().lower()
        if not email:
            skipped.append((f.name, f.email, "no email in the faculty list"))
            continue
        existing = db.query(UserModel).filter(UserModel.email.ilike(email)).first()
        if existing:
            skipped.append((f.name, email, f"already has an account ({existing.role})"))
            continue
        pw = secrets.token_urlsafe(9)
        if not dry_run:
            db.add(UserModel(id=f"{PREFIX}{f.id.lower()}", name=f.name, email=email, role="faculty",
                             department=_dept(f.department), staff_id=f.id, status="active", must_change_password=True,
                             hashed_password=get_password_hash(pw), joined_at=today, last_active=today))
        created.append((f.department, f.name, email, pw))   # plain values: usable after the session closes
    if not dry_run:
        db.commit()
    return created, skipped


def main():
    ap = argparse.ArgumentParser(description="Create faculty accounts linked to the timetable by email")
    ap.add_argument("--dry-run", action="store_true", help="Show what would be created, change nothing")
    ap.add_argument("--remove", action="store_true", help="Delete the accounts this script created")
    args = ap.parse_args()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if args.remove:
            n = db.query(UserModel).filter(UserModel.id.like(f"{PREFIX}%")).delete(synchronize_session=False)
            db.commit()
            print(f"Removed {n} faculty accounts created by this script.")
            return
        created, skipped = create(db, args.dry_run)
    finally:
        db.close()

    for name, email, why in skipped:
        print(f"skip  {name} <{email}>: {why}")
    print(f"{'Would create' if args.dry_run else 'Created'} {len(created)} faculty accounts; skipped {len(skipped)}.")
    if args.dry_run or not created:
        return
    previous = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    lines = [] if previous else ["# CampusSphere faculty accounts (local only — git-ignored; personal data: do not commit or share).",
                                 "# Hand each person their own login; they should change the password under My account.", ""]
    lines.append(f"# Created {datetime.now():%d %b %Y %H:%M}")
    for dept, name, email, pw in created:
        lines.append(f"{dept:<14} {name:<32} {email:<34} {pw}")
    OUT.write_text(previous + "\n".join(lines) + "\n", encoding="utf-8")
    print(f"Logins written to {OUT}")


if __name__ == "__main__":
    main()
