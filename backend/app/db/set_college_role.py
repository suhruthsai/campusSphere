"""
Give someone a college-wide role. One holder per role: this replaces the current one.

  principal            the last approver on every certificate; management views (Department report, Accreditation,
                       desk turnaround, Placements)
  coe                  Controller of Examinations: the Exam Cell
  placement_officer    Training & Placement Officer: runs the Placement Cell (drives, results, report)
  placement_director   Director (Placements & Projects): the same Placement Cell rights

  - finds the person's faculty account by name (titles ignored), or creates one (placeholder email, temporary
    password written to faculty_accounts.local.txt, git-ignored; they choose their own password at first sign-in);
  - --email sets the account's email when creating it; --department its department (default Administration).

Usage (from the project root):
    python backend/app/db/set_college_role.py --role principal --name "Dr. Marthi Kameswara Rao" --dry-run
    python backend/app/db/set_college_role.py --role placement_officer --name "Dr. J. Kandasamy"
"""
import argparse
import re
import secrets
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.core.security import get_password_hash  # noqa: E402
from backend.app.db.migrations import ensure_columns  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.models.campus import UserModel  # noqa: E402
from backend.app.models.services import ApproverAssignmentModel  # noqa: E402
from backend.app.student_services.catalog import ROLE_LABELS  # noqa: E402

FACULTY_LOGINS = Path(__file__).resolve().parent / "faculty_accounts.local.txt"
TITLES = r"^((dr|prof|mr|mrs|ms|sri|smt)\.?\s*)+"
ROLES = ("principal", "coe", "placement_officer", "placement_director")


def _norm(s: str) -> str:
    return re.sub(r"[^a-z]", "", re.sub(TITLES, "", (s or "").strip().lower()))


def main():
    ap = argparse.ArgumentParser(description="Give someone a college-wide role")
    ap.add_argument("--role", required=True, choices=ROLES)
    ap.add_argument("--name", required=True)
    ap.add_argument("--email", help="Email for a new account (default: a placeholder)")
    ap.add_argument("--department", default="Administration", help="Department for a new account")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    label = ROLE_LABELS[args.role]
    Base.metadata.create_all(bind=engine)
    ensure_columns(engine)
    db = SessionLocal()
    login = None
    try:
        want = _norm(args.name)
        hits = [u for u in db.query(UserModel).filter(UserModel.role.in_(["faculty", "staff"])) if want and _norm(u.name) == want]
        if len(hits) > 1:
            sys.exit(f"Several accounts are named {args.name!r}: {[(u.id, u.email) for u in hits]}")
        user = hits[0] if hits else None
        if user is None:
            pw = secrets.token_urlsafe(9)
            email = (args.email or f"{want}@faculty.campussphere.example").lower()
            if db.query(UserModel).filter(UserModel.email == email).first():
                sys.exit(f"{email} is already used by another account")
            today = datetime.utcnow().strftime("%Y-%m-%d")
            user = UserModel(id=f"u_fac_{want}", name=args.name.strip(), email=email, role="faculty",
                             department=args.department, status="active", hashed_password=get_password_hash(pw),
                             must_change_password=True, joined_at=today, last_active=today)
            db.add(user)
            login = (user.name, email, pw)
        old = [a.user_id for a in db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.role == args.role)]
        old_names = [u.name for u in db.query(UserModel).filter(UserModel.id.in_(old)) if u.id != user.id]
        db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.role == args.role).delete(synchronize_session=False)
        db.add(ApproverAssignmentModel(role=args.role, user_id=user.id))
        name, uid = user.name, user.id
        if args.dry_run:
            db.rollback()
        else:
            db.commit()
    finally:
        db.close()

    print(f"{'DRY RUN · ' if args.dry_run else ''}{label}: {name} ({uid})" + (f"; replaces {', '.join(old_names)}" if old_names else ""))
    if login:
        print(f"New account: {login[1]}")
        if not args.dry_run:
            prev = FACULTY_LOGINS.read_text(encoding="utf-8") if FACULTY_LOGINS.exists() else ""
            FACULTY_LOGINS.write_text(prev + f"# {label} · created {datetime.now():%d %b %Y %H:%M}\n"
                                      f"{args.department:<14} {login[0]:<32} {login[1]:<34} {login[2]}\n", encoding="utf-8")
            print(f"Login written to {FACULTY_LOGINS}")
    if args.role == "principal":
        print("Requests already waiting at the old Principal's desk stay there; new requests go to the new Principal.")


if __name__ == "__main__":
    main()
