"""
What a signed-in user actually holds, beyond their account role: the menus are built from this so each
person sees only the desks that are theirs (an HOD gets Substitutions for their department, the CoE the Exam
Cell, a clearance officer the No-dues desk, the Principal Accreditation) and a student sees Joining or Leaving
only while it applies to them.
"""
from sqlalchemy.orm import Session

from backend.app.models.admissions import AdmissionModel
from backend.app.models.leaving import ClearanceOfficerModel, ExitModel
from backend.app.models.services import ApproverAssignmentModel, StudentProfileModel

APPROVER_ASSIGNMENTS = ("class_incharge", "ahod", "hod", "principal", "coe")


def _dept(d) -> str:
    return (d or "").strip().upper()


def _on_accreditation_team(db: Session, uid: str) -> bool:
    from backend.app.models.accreditation import AccrRoleModel
    return db.query(AccrRoleModel.id).filter(AccrRoleModel.user_id == uid).first() is not None


def _coordinates_a_course(db: Session, uid: str) -> bool:
    from backend.app.models.obe import ObeCourseModel
    return db.query(ObeCourseModel.id).filter(ObeCourseModel.coordinator == uid).first() is not None


def user_roles(db: Session, current: dict) -> dict:
    uid, role = current["sub"], current.get("role")
    assignments = db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.user_id == uid).all()
    held = {a.role for a in assignments}
    hod_departments = sorted({_dept(a.department) for a in assignments if a.role == "hod" and a.department})
    officer = db.query(ClearanceOfficerModel).filter(ClearanceOfficerModel.user_id == uid).all()
    mentor = db.query(StudentProfileModel.user_id).filter(StudentProfileModel.mentor_id == uid).first() is not None
    principal = "principal" in held

    out = {
        "role": role,
        "admin": role == "admin",
        "principal": principal,
        "management": role == "admin" or principal,      # Accreditation, desk wall
        "coe": "coe" in held,
        # Runs the Placement Cell (drives and results): the Training & Placement Officer and the Placement Director
        "placement_officer": bool(held & {"placement_officer", "placement_director"}),
        # On the accreditation team (IQAC Coordinator, criterion in-charge, NBA coordinator, metric owner)
        "accreditation_team": _on_accreditation_team(db, uid),
        # Coordinates a course offering (keeps its COs, mapping and marks for OBE)
        "course_coordinator": _coordinates_a_course(db, uid),
        "hod_departments": hod_departments,
        "hod": bool(hod_departments),
        "clearance_units": sorted({f"{o.unit}:{_dept(o.department)}" if o.department else o.unit for o in officer}),
        "clearance_officer": bool(officer),
        "approver": mentor or bool(held & set(APPROVER_ASSIGNMENTS)),
        "joining_open": False,
        "leaving_open": False,
        "placements_open": False,
    }
    if role == "student":
        admission = db.query(AdmissionModel).filter(AdmissionModel.user_id == uid).first()
        profile = db.query(StudentProfileModel).filter(StudentProfileModel.user_id == uid).first()
        exit_rec = db.query(ExitModel).filter(ExitModel.user_id == uid).first()
        # Joining: an application still in progress, or a new account with no academic details yet (a joinee)
        out["joining_open"] = bool(admission and admission.status != "enrolled") or (not admission and not (profile and profile.year))
        # Leaving: once the exit has started, in the final year, or as a first-year joinee (the one who may withdraw,
        # so the link must not be hidden from them)
        new_joinee = bool(admission and admission.status == "enrolled" and (not profile or profile.year in (None, 1)))
        out["leaving_open"] = bool(exit_rec) or bool(profile and profile.year == 4) or new_joinee
        # Placements: final years (jobs) and pre-final years (internships)
        out["placements_open"] = bool(profile and profile.year in (3, 4))
    return out
