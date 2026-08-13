from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, JSON, Text, Date, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.db.session import Base

# ─── Existing Models ───────────────────────────────────────────────────────────

class UserModel(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="student") # admin, faculty, student, staff
    department = Column(String, default="CSE")
    roll_no = Column(String, nullable=True)
    staff_id = Column(String, nullable=True)
    status = Column(String, default="active")
    joined_at = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d"))
    last_active = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d"))

    # Relationships
    attendance_logs = relationship("AttendanceLogModel", back_populates="user", cascade="all, delete-orphan")
    announcements = relationship("AnnouncementModel", back_populates="author", cascade="all, delete-orphan")

class BuildingModel(Base):
    __tablename__ = "buildings"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    x = Column(Float, default=0.0)
    z = Column(Float, default=0.0)
    height = Column(Float, default=1.2)
    floors = Column(Integer, default=2)
    color = Column(String, default="#00E5FF")
    occupancy = Column(Integer, default=0)
    energy = Column(String, default="Normal")
    health = Column(String, default="Good")
    capacity = Column(Integer, default=240)
    departments = Column(JSON, default=list)

    # Relationships
    rooms = relationship("RoomMediaModel", back_populates="building", cascade="all, delete-orphan")
    events = relationship("CampusEventModel", back_populates="building", cascade="all, delete-orphan")

class ClassroomModel(Base):
    __tablename__ = "classrooms"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    building = Column(String, ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True)
    floor = Column(Integer, default=1)
    capacity = Column(Integer, default=60)
    equipment = Column(JSON, default=list)
    occupancy = Column(Integer, default=0)
    status = Column(String, default="available")
    type = Column(String, default="Lecture Hall")
    location_type = Column(String, default="CLASSROOM")

class LabModel(Base):
    __tablename__ = "labs"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    building = Column(String, ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True)
    floor = Column(Integer, default=1)
    capacity = Column(Integer, default=30)
    occupancy = Column(Integer, default=0)
    status = Column(String, default="available")
    color = Column(String, default="#00FFB3")
    equipment = Column(JSON, default=list)
    reservations = Column(JSON, default=list)

class TelemetryLogModel(Base):
    __tablename__ = "telemetry_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    module = Column(String, nullable=False) # energy, water, environment, crowd, attendance
    data = Column(JSON, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

# ─── New Models ────────────────────────────────────────────────────────────────

class RoomMediaModel(Base):
    """Stores photo/video metadata for rooms and labs."""
    __tablename__ = "room_media"

    id = Column(Integer, primary_key=True, autoincrement=True)
    building_id = Column(String, ForeignKey("buildings.id", ondelete="CASCADE"), nullable=False, index=True)
    room_label = Column(String, nullable=False)          # e.g. "CSE Lab (CS-101)"
    floor = Column(String, nullable=False)               # e.g. "Ground Floor"
    media_type = Column(String, nullable=False)          # "photo" | "video"
    url = Column(Text, nullable=False)                   # file path or cloud URL
    caption = Column(String, nullable=True)
    uploaded_by = Column(String, nullable=True)          # staff name or ID
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    building = relationship("BuildingModel", back_populates="rooms")


class AttendanceLogModel(Base):
    """Tracks student attendance per class session."""
    __tablename__ = "attendance_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    building_id = Column(String, ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True)
    room_label = Column(String, nullable=True)           # e.g. "Classroom 301"
    subject = Column(String, nullable=False)
    status = Column(String, default="present")           # "present" | "absent" | "late"
    date = Column(String, nullable=False)                # YYYY-MM-DD
    period = Column(Integer, nullable=True)              # 1-8 period number
    marked_by = Column(String, nullable=True)            # faculty ID
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("UserModel", back_populates="attendance_logs")


class CampusEventModel(Base):
    """Scheduled campus events in rooms or halls."""
    __tablename__ = "campus_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    building_id = Column(String, ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True, index=True)
    room_label = Column(String, nullable=True)           # e.g. "KVR Conference Hall"
    event_type = Column(String, default="academic")      # "academic" | "cultural" | "sports" | "seminar"
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    organizer = Column(String, nullable=True)
    max_attendees = Column(Integer, default=100)
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    building = relationship("BuildingModel", back_populates="events")


class AnnouncementModel(Base):
    """Faculty/admin announcements."""
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    author_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    department = Column(String, nullable=True)           # None = campus-wide
    priority = Column(String, default="normal")          # "normal" | "urgent" | "info"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    author = relationship("UserModel", back_populates="announcements")


# ─── Timetable Layer ────────────────────────────────────────────────────────────

class SubjectModel(Base):
    """Academic subject catalog — independent of any classroom or faculty."""
    __tablename__ = "subjects"

    id          = Column(String, primary_key=True, index=True)   # e.g. "U21PC701IT"
    name        = Column(String, nullable=False)                  # "Internet of Things"
    code        = Column(String, nullable=False, index=True)     # "IOT"
    department  = Column(String, nullable=False, default="IT")
    semester    = Column(Integer, nullable=True)                  # 7
    credits     = Column(Integer, nullable=True)                  # 4
    subject_type = Column(String, default="theory")              # "theory" | "lab" | "project" | "elective"

    timetable_entries = relationship("TimetableEntryModel", back_populates="subject_rel",
                                     foreign_keys="TimetableEntryModel.subject_id")


class FacultyProfileModel(Base):
    """Academic faculty directory — separate from auth UserModel."""
    __tablename__ = "faculty_profiles"

    id              = Column(String, primary_key=True, index=True)  # e.g. "FAC001"
    name            = Column(String, nullable=False)
    department      = Column(String, nullable=False, default="IT")
    designation     = Column(String, nullable=True)                 # "Associate Professor"
    email           = Column(String, nullable=True)
    specialization  = Column(String, nullable=True)
    is_active       = Column(Boolean, default=True)

    timetable_entries = relationship("TimetableEntryModel", back_populates="faculty_rel",
                                     foreign_keys="TimetableEntryModel.faculty_id")


class TimetableEntryModel(Base):
    """
    Core time-aware mapping:  Classroom + Day + Period → Subject + Faculty + Section

    A classroom can host completely different faculty, subjects, and student groups
    in each period.  No permanent association with any teacher or subject.
    """
    __tablename__ = "timetable_entries"

    id              = Column(Integer, primary_key=True, autoincrement=True)

    # ── Time axes ────────────────────────────────────────────────────────────
    day_of_week     = Column(Integer, nullable=False, index=True)  # 0=Mon, 5=Sat
    period_number   = Column(Integer, nullable=False)              # 1–8
    start_time      = Column(String, nullable=False)               # "09:30"
    end_time        = Column(String, nullable=False)               # "10:30"

    # ── Physical location ────────────────────────────────────────────────────
    classroom_id    = Column(String, ForeignKey("classrooms.id", ondelete="CASCADE"),
                             nullable=False, index=True)

    # ── Academic data (denormalised for fast reads) ──────────────────────────
    subject_id      = Column(String, ForeignKey("subjects.id", ondelete="SET NULL"),
                             nullable=True, index=True)
    subject_name    = Column(String, nullable=False)               # kept for display even if subject deleted
    faculty_id      = Column(String, ForeignKey("faculty_profiles.id", ondelete="SET NULL"),
                             nullable=True, index=True)
    faculty_name    = Column(String, nullable=False)               # kept for display

    # ── Section information ──────────────────────────────────────────────────
    department      = Column(String, nullable=False, default="IT")
    academic_year   = Column(String, nullable=False, default="2026-2027")  # "2026-2027"
    section         = Column(String, nullable=False)               # "IT-4B"
    semester        = Column(Integer, nullable=False, default=7)   # 7
    batch           = Column(String, nullable=True)                # None=whole class | "1" | "2"

    # ── Validity ─────────────────────────────────────────────────────────────
    effective_from  = Column(Date, nullable=True)
    effective_until = Column(Date, nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    # ── Relationships ────────────────────────────────────────────────────────
    classroom_rel   = relationship("ClassroomModel", foreign_keys=[classroom_id])
    subject_rel     = relationship("SubjectModel",   foreign_keys=[subject_id],
                                   back_populates="timetable_entries")
    faculty_rel     = relationship("FacultyProfileModel", foreign_keys=[faculty_id],
                                   back_populates="timetable_entries")

    # ── Composite indexes for conflict detection (all 3 types) ───────────────
    __table_args__ = (
        Index("ix_tt_classroom_day", "classroom_id", "day_of_week"),
        Index("ix_tt_faculty_day",   "faculty_id",   "day_of_week"),
        Index("ix_tt_section_day",   "section",      "day_of_week"),
    )

