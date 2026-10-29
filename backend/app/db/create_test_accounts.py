"""
Create three accounts for testing the Civil & IT Block pilot end to end, and write their logins to
backend/app/db/test_accounts.local.txt (git-ignored, like demo_accounts.local.txt; never commit it).

  student  Civil, year 2, section A (a generated placeholder roll number, so it matches no real student).
           The Civil year-2 timetable gives the Morning Brief real classes.
  faculty  the student's mentor, and the Civil class in-charge (year 2, section A), Associate HOD and HOD,
           so one approval clears those four steps; the Principal step goes to the Principal on record,
           or the test admin can approve it (admins can step in for any approver).
  admin    the Accreditation pages, the desk wall, users and settings.

Running it again gives the same accounts new passwords. --remove deletes them, their requests and the
approver roles it created.

Usage (from the project root):
    python backend/app/db/create_test_accounts.py
    python backend/app/db/create_test_accounts.py --remove
"""
import argparse
import secrets
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.core.security import get_password_hash  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.models.campus import UserModel  # noqa: E402
from backend.app.models.services import (  # noqa: E402
    ApproverAssignmentModel, DocumentRequestModel, RosterEntryModel, StudentProfileModel,
)

OUT = Path(__file__).resolve().parent / "test_accounts.local.txt"
ROLL = "GEN-CIVIL-25-001"     # a placeholder from generate_placeholder_roster.py: Civil, year 2, section A
ACCOUNTS = {
    "student": {"id": "u_test_student", "name": "Test Student · Civil", "email": "test.student@example.com",
                "role": "student", "department": "CIVIL"},
    "faculty": {"id": "u_test_faculty", "name": "Test Faculty · Civil", "email": "test.faculty@example.com",
                "role": "faculty", "department": "CIVIL"},
    "admin":   {"id": "u_test_admin", "name": "Test Admin", "email": "test.admin@example.com",
                "role": "admin", "department": "Administration"},
}
ROLES = [("class_incharge", 2, "A"), ("ahod", None, None), ("hod", None, None)]   # for CIVIL


def remove(db) -> None:
    ids = [a["id"] for a in ACCOUNTS.values()]
    db.query(DocumentRequestModel).filter(DocumentRequestModel.student_id.in_(ids)).delete(synchronize_session=False)
    db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.user_id.in_(ids)).delete(synchronize_session=False)
    db.query(StudentProfileModel).filter(StudentProfileModel.user_id.in_(ids)).delete(synchronize_session=False)
    db.query(UserModel).filter(UserModel.id.in_(ids)).delete(synchronize_session=False)
    db.commit()


def create(db) -> tuple:
    if not db.get(RosterEntryModel, ROLL):
        sys.exit(f"{ROLL} isn't in the roll list. Run: python backend/app/db/generate_placeholder_roster.py --branch CIVIL")
    taken = db.query(StudentProfileModel).filter(StudentProfileModel.roll_no == ROLL,
                                                 StudentProfileModel.user_id != ACCOUNTS["student"]["id"]).first()
    if taken:
        sys.exit(f"{ROLL} is already linked to another account ({taken.user_id}).")
    today = datetime.utcnow().strftime("%Y-%m-%d")
    passwords = {}
    for key, a in ACCOUNTS.items():
        clash = db.query(UserModel).filter(UserModel.email == a["email"], UserModel.id != a["id"]).first()
        if clash:
            sys.exit(f"{a['email']} already belongs to another account ({clash.id}).")
        pw = secrets.token_urlsafe(9)
        user = db.get(UserModel, a["id"]) or UserModel(id=a["id"], joined_at=today)
        user.name, user.email, user.role, user.department = a["name"], a["email"], a["role"], a["department"]
        user.hashed_password = get_password_hash(pw)
        user.status = "active"
        user.last_active = today
        if key == "student":
            user.roll_no = ROLL
        db.add(user)
        passwords[key] = pw
    db.flush()

    fac = ACCOUNTS["faculty"]["id"]
    profile = db.get(StudentProfileModel, ACCOUNTS["student"]["id"]) or StudentProfileModel(user_id=ACCOUNTS["student"]["id"])
    profile.roll_no, profile.department, profile.program = ROLL, "CIVIL", "B.E."
    profile.year, profile.section = 2, "A"
    profile.parent_name, profile.gender = "Test Parent", "female"
    profile.mentor_id = fac
    db.add(profile)

    db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.user_id == fac).delete(synchronize_session=False)
    for role, year, section in ROLES:
        db.add(ApproverAssignmentModel(role=role, user_id=fac, department="CIVIL", year=year, section=section))
    db.commit()

    principal = db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.role == "principal").order_by(
        ApproverAssignmentModel.id.desc()).first()
    principal_name = db.get(UserModel, principal.user_id).name if principal else None
    return passwords, principal_name


def main():
    ap = argparse.ArgumentParser(description="Create (or remove) the student, faculty and admin test accounts")
    ap.add_argument("--remove", action="store_true", help="Delete the test accounts, their requests and roles")
    args = ap.parse_args()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if args.remove:
            remove(db)
            OUT.unlink(missing_ok=True)
            print("Removed the test accounts, their requests and approver roles.")
            return
        passwords, principal_name = create(db)
    finally:
        db.close()

    lines = ["# CampusSphere test accounts (local only — git-ignored, do not commit or share)",
             f"# Created {datetime.now():%d %b %Y %H:%M}. Run create_test_accounts.py again for new passwords;",
             "# --remove deletes them.", ""]
    notes = {
        "student": f"Civil · year 2 · section A · roll {ROLL} (placeholder). Try the Morning Brief and Ask Mitra.",
        "faculty": "Mentor, class in-charge, Associate HOD and HOD for that class: approves the student's requests.",
        "admin": "Accreditation, Desk turnaround, users. Can also approve the Principal step."
                 + (f" (The Principal on record is '{principal_name}'.)" if principal_name else ""),
    }
    for key, a in ACCOUNTS.items():
        lines += [f"[{key}]", f"  email:    {a['email']}", f"  password: {passwords[key]}", f"  {notes[key]}", ""]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Created the student, faculty and admin test accounts. Logins are in {OUT.relative_to(Path.cwd()) if OUT.is_relative_to(Path.cwd()) else OUT}")


if __name__ == "__main__":
    main()
