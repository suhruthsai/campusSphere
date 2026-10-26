# Student Services (V1): academic profiles, approver assignments and document requests
# (bonafide / NOC) that move through the approval chain Mentor -> Class In-charge ->
# Associate HOD -> HOD -> Principal.
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text, Index

from backend.app.db.session import Base


class StudentProfileModel(Base):
    """Academic details the certificates need; one row per student user."""
    __tablename__ = "student_profiles"

    user_id     = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    roll_no     = Column(String, nullable=True)
    department  = Column(String, nullable=False)                 # "CSE", "ECE", ...
    program     = Column(String, nullable=False, default="B.E.")
    year        = Column(Integer, nullable=True)                 # 1-4
    section     = Column(String, nullable=True)                  # "A", "B", ...
    parent_name = Column(String, nullable=True)                  # for "S/o" / "D/o" on certificates
    gender      = Column(String, nullable=True)                  # "male" | "female" | "other"
    mentor_id   = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ApproverAssignmentModel(Base):
    """Who holds an approval role. class_incharge is per department+year+section,
    ahod/hod per department, principal college-wide. (Mentors are per student.)"""
    __tablename__ = "approver_assignments"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    role       = Column(String, nullable=False, index=True)      # class_incharge | ahod | hod | principal
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    department = Column(String, nullable=True)
    year       = Column(Integer, nullable=True)
    section    = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_approver_scope", "role", "department", "year", "section"),)


class DocumentRequestModel(Base):
    """A student's request for a document and its progress through the approval chain.

    steps: [{role, label, approver_id, approver_name, status: pending|approved|rejected,
             acted_at, acted_by_id, acted_by_name, remarks}] — the audit trail.
    student: snapshot of the student's details when they asked, so the certificate
             text doesn't change if their profile is edited later.
    """
    __tablename__ = "document_requests"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    ref_no       = Column(String, unique=True, index=True, nullable=True)   # MVSR/BON/2026/00001
    student_id   = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type     = Column(String, nullable=False)              # bonafide | noc
    purpose      = Column(String, nullable=False)
    details      = Column(JSON, default=dict)                  # purpose_details, organization, dates...
    student      = Column(JSON, default=dict)
    steps        = Column(JSON, default=list)
    current_step = Column(Integer, default=0)
    status       = Column(String, default="in_review", index=True)  # in_review | approved | rejected | cancelled
    step_since   = Column(DateTime, default=datetime.utcnow)  # when the current step started (SLA clock)
    verify_code  = Column(String, unique=True, index=True, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    issued_at    = Column(DateTime, nullable=True)
    notes        = Column(Text, nullable=True)
    # V3 leaving documents (added to existing databases by db/migrations.py)
    amount       = Column(Integer, nullable=True)      # fee for this request, rupees (copies included)
    payment_id   = Column(Integer, nullable=True)
    fulfilment   = Column(String, nullable=True)       # generated | upload
    issued_file  = Column(String, nullable=True)       # uploaded final document (Exam Cell)
    dispatch     = Column(JSON, nullable=True)         # {"mode", "tracking", "at", "by"}


class RosterEntryModel(Base):
    """The college's official roll list (one row per student, imported from the branch roll-list PDFs).
    Used to check what students enter about themselves; not a login account."""
    __tablename__ = "student_roster"

    roll_no        = Column(String, primary_key=True)             # e.g. "1602-23-737-001"
    name           = Column(String, nullable=False)
    father_name    = Column(String, nullable=True)
    department     = Column(String, nullable=False, index=True)  # CSE, ECE, IT, CSIT, CSD, ...
    year           = Column(Integer, nullable=False, index=True)  # 1-4 in the current academic year
    section        = Column(String, nullable=True)
    email          = Column(String, nullable=True)               # only well-formed addresses are kept
    admission_year = Column(Integer, nullable=True)              # from the roll number (None if it has no year)
    academic_year  = Column(String, nullable=False)              # roll list valid for, e.g. "2026-27"
    source         = Column(String, nullable=True)               # file it came from
    notes          = Column(Text, nullable=True)                 # anything odd found while importing
    imported_at    = Column(DateTime, default=datetime.utcnow)
