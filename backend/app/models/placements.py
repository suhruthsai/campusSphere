# Placements: drives the Placement Cell runs (jobs for the final year, internships for the pre-final year),
# students' registrations and results (shortlisted, selected...), and each outgoing batch's summary for the
# years before CampusSphere (NAAC 5.2 / NBA criterion 4 ask for the last few batches).
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint

from backend.app.db.session import Base


class PlacementDriveModel(Base):
    """One company's drive: who may apply (branches, passing-out batch), when, and what it pays."""
    __tablename__ = "placement_drives"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    company      = Column(String, nullable=False)
    role         = Column(String, nullable=False)                 # "Associate Software Engineer"
    kind         = Column(String, nullable=False, default="job")  # job | internship
    ctc_lpa      = Column(Float, nullable=True)                   # jobs: lakh per annum
    stipend      = Column(Integer, nullable=True)                 # internships: rupees per month
    location     = Column(String, nullable=True)
    mode         = Column(String, nullable=False, default="on-campus")   # on-campus | virtual | pool
    departments  = Column(JSON, nullable=False, default=list)     # ["IT", "CSE"]: branches that may apply
    batch        = Column(Integer, nullable=False, index=True)    # passing-out year, e.g. 2027
    eligibility  = Column(String, nullable=True)                  # "60% throughout, no active backlogs"
    rounds       = Column(JSON, nullable=False, default=list)     # ["Online test", "Technical interview", "HR"]
    description  = Column(Text, nullable=True)
    opens_at     = Column(DateTime, nullable=False)               # registrations open
    register_by  = Column(DateTime, nullable=False)               # registrations close
    drive_date   = Column(Date, nullable=False)
    results_out  = Column(DateTime, nullable=True)                # set when the Placement Cell declares results
    cancelled    = Column(Integer, nullable=False, default=0)
    created_by   = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    pilot_run    = Column(String, nullable=True, index=True)      # generated data: one command removes it


class PlacementRegistrationModel(Base):
    """A student's application to a drive and how far it got. By roll number, like attendance."""
    __tablename__ = "placement_registrations"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    drive_id      = Column(Integer, ForeignKey("placement_drives.id", ondelete="CASCADE"), nullable=False, index=True)
    roll_no       = Column(String, nullable=False, index=True)
    user_id       = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status        = Column(String, nullable=False, default="registered")
    # registered | shortlisted | selected | not_selected | absent | withdrawn
    round_reached = Column(Integer, nullable=False, default=0)    # rounds cleared
    registered_at = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by    = Column(String, nullable=True)
    pilot_run     = Column(String, nullable=True, index=True)

    __table_args__ = (UniqueConstraint("drive_id", "roll_no", name="uq_placement_registration"),)


class PlacementBatchSummaryModel(Base):
    """An outgoing batch's final numbers per branch, for batches recorded before (or outside) CampusSphere."""
    __tablename__ = "placement_batch_summaries"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    department     = Column(String, nullable=False)
    batch          = Column(Integer, nullable=False)              # passing-out year
    eligible       = Column(Integer, nullable=False)              # students in the outgoing batch who sought jobs
    placed         = Column(Integer, nullable=False)              # students with at least one offer
    offers         = Column(Integer, nullable=False)
    higher_studies = Column(Integer, nullable=False, default=0)
    entrepreneurs  = Column(Integer, nullable=False, default=0)
    median_ctc     = Column(Float, nullable=True)
    highest_ctc    = Column(Float, nullable=True)
    recruiters     = Column(Integer, nullable=True)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    pilot_run      = Column(String, nullable=True, index=True)

    __table_args__ = (UniqueConstraint("department", "batch", name="uq_placement_batch"),)
