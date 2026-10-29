"""
Create a sign-in account for every student of a branch on the college roll list (student_roster). The roll
number links the account to the student: attendance and bunk analysis, timetable, notices and requests all
come from it. Nothing is emailed to anyone.

  - students sign in with their roll number (or the account's email) and a random temporary password; the logins
    are written to backend/app/db/student_accounts.local.txt (git-ignored, personal data: never commit or share it)
    so the Admin Office can hand them out. Students should change it under My account after signing in;
  - the account's email is the one on the roll list when it is a valid address no other account uses; otherwise
    a placeholder <roll>@students.campussphere.example (it can't receive mail; sign in with the roll number);
  - skips roll numbers already linked to an account (a student who signed up themselves keeps theirs), and
    GENERATED placeholder rows;
  - --dry-run shows what would happen; --remove deletes only the accounts this script created (ids "u_stu_...").

Usage (from the project root):
    python backend/app/db/create_student_accounts.py --branch IT --dry-run
    python backend/app/db/create_student_accounts.py --branch IT
    python backend/app/db/create_student_accounts.py --branch IT --remove
    python backend/app/db/create_student_accounts.py --branch IT --reissue   # new passwords before printing slips
"""
import argparse
import secrets
import sys
from datetime import datetime
from pathlib import Path

from pydantic import EmailStr, TypeAdapter, ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.core.security import get_password_hash  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.models.campus import UserModel  # noqa: E402
from backend.app.models.services import RosterEntryModel, StudentProfileModel  # noqa: E402

OUT = Path(__file__).resolve().parent / "student_accounts.local.txt"
PREFIX = "u_stu_"
PLACEHOLDER_DOMAIN = "students.campussphere.example"
_email = TypeAdapter(EmailStr)


def _valid(email: str) -> bool:
    try:
        _email.validate_python(email)
        return True
    except ValidationError:
        return False


# Copied by hand from a printed slip: no 0/O, 1/l/I or symbols. 10 characters from 54 is about 57 bits.
READABLE = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def readable_password(n: int = 10) -> str:
    return "".join(secrets.choice(READABLE) for _ in range(n))


def reissue(db, branch: str, dry_run: bool) -> list:
    """New readable temporary passwords for this script's accounts whose temporary one hasn't been used yet."""
    out = []
    for u, p in db.query(UserModel, StudentProfileModel).join(StudentProfileModel, StudentProfileModel.user_id == UserModel.id).filter(
            UserModel.id.like(f"{PREFIX}%"), UserModel.department == branch, UserModel.must_change_password == True).order_by(  # noqa: E712
            StudentProfileModel.year, StudentProfileModel.section, StudentProfileModel.roll_no):
        pw = readable_password()
        if not dry_run:
            u.hashed_password = get_password_hash(pw)
        out.append((p.year, p.section or "", p.roll_no, u.name.upper(), u.email, pw))
    if not dry_run:
        db.commit()
    return out


def create(db, branch: str, dry_run: bool) -> tuple[list, list]:
    created, skipped = [], []
    today = datetime.utcnow().strftime("%Y-%m-%d")
    linked = {p.roll_no for p in db.query(StudentProfileModel).all() if p.roll_no} | \
             {u.roll_no for u in db.query(UserModel).filter(UserModel.roll_no.isnot(None)).all()}
    used = {(u.email or "").lower() for u in db.query(UserModel).all()}
    rows = db.query(RosterEntryModel).filter(RosterEntryModel.department == branch).order_by(
        RosterEntryModel.year, RosterEntryModel.section, RosterEntryModel.roll_no).all()
    for r in rows:
        if (r.source or "").startswith("GENERATED"):
            continue
        if r.roll_no in linked:
            skipped.append((r.roll_no, r.name, "already linked to an account"))
            continue
        email = (r.email or "").strip().lower()
        if not email or email in used or not _valid(email):
            email = f"{r.roll_no.lower()}@{PLACEHOLDER_DOMAIN}"
        if email in used:
            skipped.append((r.roll_no, r.name, f"{email} is taken"))
            continue
        used.add(email)
        pw = readable_password()
        if not dry_run:
            uid = f"{PREFIX}{r.roll_no.lower().replace('-', '')}"
            db.add(UserModel(id=uid, name=r.name.title(), email=email, role="student", department=branch,
                             roll_no=r.roll_no, status="active", hashed_password=get_password_hash(pw), must_change_password=True,
                             joined_at=today, last_active=today))
            db.add(StudentProfileModel(user_id=uid, roll_no=r.roll_no, department=branch, program="B.E.",
                                       year=r.year, section=r.section,
                                       parent_name=r.father_name.title() if r.father_name else None))
        created.append((r.year, r.section or "", r.roll_no, r.name, email, pw))   # plain values
    if not dry_run:
        db.commit()
    return created, skipped


def main():
    ap = argparse.ArgumentParser(description="Create student accounts for a branch's roll list")
    ap.add_argument("--branch", required=True, help="e.g. IT")
    ap.add_argument("--dry-run", action="store_true", help="Show what would be created, change nothing")
    ap.add_argument("--remove", action="store_true", help="Delete the accounts this script created for the branch")
    ap.add_argument("--reissue", action="store_true", help="New temporary passwords for accounts that haven't signed in and changed theirs")
    args = ap.parse_args()
    branch = args.branch.strip().upper()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if args.remove:
            ids = [u.id for u in db.query(UserModel).filter(UserModel.id.like(f"{PREFIX}%"), UserModel.department == branch)]
            db.query(StudentProfileModel).filter(StudentProfileModel.user_id.in_(ids)).delete(synchronize_session=False)
            n = db.query(UserModel).filter(UserModel.id.in_(ids)).delete(synchronize_session=False)
            db.commit()
            print(f"Removed {n} {branch} student accounts created by this script.")
            return
        if args.reissue:
            created, skipped = reissue(db, branch, args.dry_run), []
        else:
            created, skipped = create(db, branch, args.dry_run)
    finally:
        db.close()

    for roll, name, why in skipped:
        print(f"skip  {roll} {name}: {why}")
    real = sum(1 for c in created if not c[4].endswith(PLACEHOLDER_DOMAIN))
    if args.reissue:
        print(f"{'Would reissue' if args.dry_run else 'Reissued'} {len(created)} temporary passwords for {branch}.")
    else:
        print(f"{'Would create' if args.dry_run else 'Created'} {len(created)} {branch} student accounts "
              f"({real} with the roll list's email, {len(created) - real} sign in by roll number only); skipped {len(skipped)}.")
    if args.dry_run or not created:
        return
    previous = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    lines = [] if previous else ["# CampusSphere student accounts (local only — git-ignored; personal data: do not commit or share).",
                                 "# Students sign in with their roll number and this temporary password, then change it under My account.", ""]
    lines.append(f"# {branch} · {'reissued (replaces earlier lines)' if args.reissue else 'created'} {datetime.now():%d %b %Y %H:%M}")
    for year, sec, roll, name, email, pw in created:
        lines.append(f"Y{year} {sec:<2} {roll:<16} {name:<34} {pw:<14} {email}")
    OUT.write_text(previous + "\n".join(lines) + "\n", encoding="utf-8")
    print(f"Logins written to {OUT}")


if __name__ == "__main__":
    main()
