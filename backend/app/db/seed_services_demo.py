"""
Demo data for Student Services: a CSE approval chain (mentor, class in-charge 3-A,
associate HOD, HOD, principal) and one demo student (V1 certificates), plus an Admin Office
staff account, a new joinee and sample joining fee heads (V2 joining & fees), and a Controller
of Examinations plus no-dues clearance officers (V3 leaving), so every flow can be shown before
the college's real staff and fees are set up.

Run from the project root:  python backend/app/db/seed_services_demo.py
Re-running is safe (existing demo accounts are kept, assignments are refreshed).
Demo logins are written to backend/app/db/demo_accounts.local.txt (git-ignored).
Set DEMO_PASSWORD to choose the password; otherwise a random one is generated once.
"""
import os
import secrets
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

from backend.app.core.security import get_password_hash
from backend.app.db.session import Base, SessionLocal, engine
from backend.app.models.campus import UserModel
from backend.app.models.admissions import FeeHeadModel
from backend.app.models.leaving import ClearanceOfficerModel
from backend.app.models.services import ApproverAssignmentModel, StudentProfileModel

CREDENTIALS_FILE = Path(__file__).with_name("demo_accounts.local.txt")

APPROVERS = [
    # (key, name, email, department)
    ("mentor",         "Mentor · CSE (Demo)",            "demo.mentor.cse@example.com",   "CSE"),
    ("class_incharge", "Class In-charge · CSE 3-A (Demo)", "demo.incharge.cse@example.com", "CSE"),
    ("ahod",           "Associate HOD · CSE (Demo)",     "demo.ahod.cse@example.com",     "CSE"),
    ("hod",            "HOD · CSE (Demo)",               "demo.hod.cse@example.com",      "CSE"),
    ("principal",      "Principal (Demo)",               "demo.principal@example.com",    "Administration"),
    ("coe",            "Controller of Examinations (Demo)", "demo.coe@example.com",       "Examinations"),
]
STUDENT = ("Demo Student · CSE", "demo.student.cse@example.com", "CSE", "1602-23-733-001")
OFFICE = ("Admin Office (Demo)", "demo.office@example.com")
JOINEE = ("Demo Joinee", "demo.joinee@example.com")
# Placeholder amounts only — MVSR's real fees must be entered in Services -> Fee settings
DEMO_FEE_HEADS = [
    ("Special fee", 5500, False, 1),
    ("CRT / placement training fee", 15000, False, 2),
    ("University (Osmania) fees", 3250, False, 3),
    ("College bus fee (optional)", 30000, True, 4),
]


def _password() -> str:
    if os.getenv("DEMO_PASSWORD"):
        return os.environ["DEMO_PASSWORD"]
    if CREDENTIALS_FILE.exists():
        for line in CREDENTIALS_FILE.read_text(encoding="utf-8").splitlines():
            if line.startswith("password:"):
                return line.split(":", 1)[1].strip()
    return secrets.token_urlsafe(10)


def _user(db, name, email, role, department, password, roll_no=None):
    user = db.query(UserModel).filter(UserModel.email == email).first()
    if user:
        return user, False
    today = datetime.utcnow().strftime("%Y-%m-%d")
    user = UserModel(
        id=f"u_{uuid.uuid4().hex[:10]}", name=name, email=email, hashed_password=get_password_hash(password),
        role=role, department=department, roll_no=roll_no, staff_id=None, status="active",
        joined_at=today, last_active=today,
    )
    db.add(user)
    db.flush()
    return user, True


def seed():
    Base.metadata.create_all(bind=engine)
    password = _password()
    db = SessionLocal()
    try:
        people = {}
        for key, name, email, dept in APPROVERS:
            people[key], _ = _user(db, name, email, "faculty", dept, password)
        student, _ = _user(db, STUDENT[0], STUDENT[1], "student", STUDENT[2], password, roll_no=STUDENT[3])
        _user(db, OFFICE[0], OFFICE[1], "staff", "Administration", password)
        _user(db, JOINEE[0], JOINEE[1], "student", "CSE", password)
        # No-dues clearance officers (one account per unit is fine for a demo)
        office = db.query(UserModel).filter(UserModel.email == OFFICE[1]).first()
        officers = {"library": office, "accounts": office, "transport": office, "placement": office,
                    "sports": office, "exam_cell": people["coe"]}
        for unit, who in officers.items():
            db.query(ClearanceOfficerModel).filter(ClearanceOfficerModel.unit == unit, ClearanceOfficerModel.department == None).delete(synchronize_session=False)  # noqa: E711
            db.add(ClearanceOfficerModel(unit=unit, department=None, user_id=who.id))
        db.query(ClearanceOfficerModel).filter(ClearanceOfficerModel.unit == "department", ClearanceOfficerModel.department == "CSE").delete(synchronize_session=False)
        db.add(ClearanceOfficerModel(unit="department", department="CSE", user_id=people["hod"].id))
        if not db.query(FeeHeadModel).count():
            for name, amount, optional, order in DEMO_FEE_HEADS:
                db.add(FeeHeadModel(name=name, amount=amount, optional=optional, sort_order=order, active=True,
                                    description="Demo amount — replace with the college's actual fee"))

        scopes = {
            "class_incharge": ("CSE", 3, "A"),
            "ahod": ("CSE", None, None),
            "hod": ("CSE", None, None),
            "principal": (None, None, None),
            "coe": (None, None, None),
        }
        for role, (dept, year, section) in scopes.items():
            db.query(ApproverAssignmentModel).filter(
                ApproverAssignmentModel.role == role, ApproverAssignmentModel.department == dept,
                ApproverAssignmentModel.year == year, ApproverAssignmentModel.section == section,
            ).delete(synchronize_session=False)
            db.add(ApproverAssignmentModel(role=role, user_id=people[role].id, department=dept, year=year, section=section))

        profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == student.id).first()
        if not profile:
            profile = StudentProfileModel(user_id=student.id, department="CSE")
            db.add(profile)
        profile.roll_no = STUDENT[3]
        profile.program = "B.E."
        profile.year = 3
        profile.section = "A"
        profile.parent_name = profile.parent_name or "Demo Parent"
        profile.gender = profile.gender or "female"
        profile.mentor_id = people["mentor"].id

        db.commit()
        lines = ["# Student Services demo accounts (local only — do not commit)", f"password: {password}", ""]
        lines += [f"{key:15} {email}" for key, _, email, _ in APPROVERS]
        lines += [f"{'student':15} {STUDENT[1]}", f"{'office':15} {OFFICE[1]}", f"{'joinee':15} {JOINEE[1]}"]
        CREDENTIALS_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"Student Services demo data ready. Logins saved to {CREDENTIALS_FILE}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
