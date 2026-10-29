# Class attendance: one session per timetabled period actually held (a timetable entry on a date), one mark per
# student on the roll (by roll number, so it counts from day one even before the student has an account),
# who is in each lab batch / elective group, and the college's attendance rules.
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint

from backend.app.db.session import Base


class AttendanceSessionModel(Base):
    """A class period that was held and marked: timetable entry + date."""
    __tablename__ = "attendance_sessions"

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    timetable_entry_id = Column(Integer, ForeignKey("timetable_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    date               = Column(Date, nullable=False, index=True)
    section            = Column(String, nullable=False, index=True)    # timetable section, e.g. "IT-4A", "Civil-3"
    department         = Column(String, nullable=False)
    subject_name       = Column(String, nullable=False)
    batch              = Column(String, nullable=True)                 # lab batch / elective group, None = whole class
    period_number      = Column(Integer, nullable=False)
    marked_by          = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    marked_by_name     = Column(String, nullable=True)
    marked_at          = Column(DateTime, default=datetime.utcnow)
    updated_at         = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    pilot_run          = Column(String, nullable=True, index=True)  # set on generated pilot data: one command removes it

    __table_args__ = (UniqueConstraint("timetable_entry_id", "date", name="uq_attendance_entry_date"),)


class AttendanceMarkModel(Base):
    """One student's mark in one session. present and late both count as attended."""
    __tablename__ = "attendance_marks"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    roll_no    = Column(String, nullable=False, index=True)
    status     = Column(String, nullable=False, default="present")     # present | absent | late

    __table_args__ = (UniqueConstraint("session_id", "roll_no", name="uq_attendance_mark"),)


class AttendanceGroupModel(Base):
    """Who is in a lab batch or elective group of a section. Batches 1/2 and G1/G2 start as a split of the roll
    list by roll number; a row here moves a student. Electives start empty: the teacher picks the students."""
    __tablename__ = "attendance_groups"

    id      = Column(Integer, primary_key=True, autoincrement=True)
    section = Column(String, nullable=False)
    batch   = Column(String, nullable=False)     # the group this row is about
    roll_no = Column(String, nullable=False)
    member  = Column(Integer, nullable=False, default=1)   # 1 = in this group, 0 = moved out of it
    pilot_run = Column(String, nullable=True)

    __table_args__ = (UniqueConstraint("section", "batch", "roll_no", name="uq_attendance_group"),
                      Index("ix_attendance_group_section", "section", "batch"))


class AttendanceRulesModel(Base):
    """The college's attendance rules (one row). Osmania University: 75% required; 65-75% may be condoned;
    below 65% the student is detained. Editable by admins."""
    __tablename__ = "attendance_rules"

    id             = Column(Integer, primary_key=True)
    target_pct     = Column(Integer, nullable=False, default=75)
    floor_pct      = Column(Integer, nullable=False, default=65)
    semester_start = Column(Date, nullable=True)
    semester_end   = Column(Date, nullable=True)
    edit_hours     = Column(Integer, nullable=False, default=24)    # faculty may correct a session this long after class
    updated_by     = Column(String, nullable=True)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
