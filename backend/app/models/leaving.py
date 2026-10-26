# Student Services V3: leaving the college — no-dues clearance across departments, who clears
# each unit, and the fees for leaving documents (TC, provisional certificate, transcripts...).
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text

from backend.app.db.session import Base


class ExitModel(Base):
    """A student's exit from the college. status: in_progress -> cleared (every unit cleared)."""
    __tablename__ = "exits"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    reason       = Column(String, nullable=False)     # Course completed | Discontinued | Transfer to another institution
    leaving_date = Column(Date, nullable=False)
    status       = Column(String, default="in_progress", index=True)
    department   = Column(String, nullable=True)      # the student's department when they left
    cleared_at   = Column(DateTime, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)


class ClearanceItemModel(Base):
    """One unit's no-dues sign-off for an exit. status: pending | dues | cleared."""
    __tablename__ = "clearance_items"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    exit_id     = Column(Integer, ForeignKey("exits.id", ondelete="CASCADE"), nullable=False, index=True)
    unit        = Column(String, nullable=False)       # library | accounts | department | transport | exam_cell | placement | sports
    status      = Column(String, default="pending", index=True)
    dues_amount = Column(Integer, nullable=True)       # rupees, when status is "dues"
    remarks     = Column(Text, nullable=True)
    acted_by    = Column(String, nullable=True)
    acted_at    = Column(DateTime, nullable=True)
    payment_id  = Column(Integer, nullable=True)       # set when the dues were paid online


class ClearanceOfficerModel(Base):
    """Who signs off a clearance unit. For the 'department' unit, one per department."""
    __tablename__ = "clearance_officers"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    unit       = Column(String, nullable=False, index=True)
    department = Column(String, nullable=True)
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DocumentFeeModel(Base):
    """Admin-set fee for a document type (overrides the catalogue default)."""
    __tablename__ = "document_fees"

    doc_type   = Column(String, primary_key=True)
    amount     = Column(Integer, nullable=False)       # rupees; per copy for transcripts
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
