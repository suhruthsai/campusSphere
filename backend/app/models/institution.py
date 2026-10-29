# Institution records for NAAC criteria 4-7 and NBA 1, 4.5-4.6, 6, 9-10: student progression and achievements,
# yearly facility / library / ICT / finance figures, and the meetings of statutory bodies and committees with the
# decisions they took (and whether those were carried out).
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, Integer, JSON, String, Text, UniqueConstraint

from backend.app.db.session import Base


class StudentAchievementModel(Base):
    """Progression and achievements: higher studies, competitive exams, startups, awards, events organised."""
    __tablename__ = "student_achievements"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    kind         = Column(String, nullable=False, index=True)    # higher_studies | exam | startup | award | event | alumni_contribution
    programme    = Column(String, nullable=True, index=True)     # None = college-wide (events)
    year         = Column(String, nullable=False, index=True)    # academic year
    roll_no      = Column(String, nullable=True)                 # the student, where one is meant
    student_name = Column(String, nullable=True)
    title        = Column(String, nullable=False)                # "M.Tech, IIT Hyderabad" / "GATE 2025 (CS)" / "Inter-university athletics"
    level        = Column(String, nullable=True)                 # college | state | national | international
    category     = Column(String, nullable=True)                 # sports | cultural | technical (awards, events)
    participants = Column(Integer, nullable=True)                # events
    amount_lakh  = Column(Float, nullable=True)                  # alumni contributions
    on_date      = Column(Date, nullable=True)
    link         = Column(String, nullable=True)                 # evidence
    created_by   = Column(String, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    pilot_run    = Column(String, nullable=True, index=True)


class InstitutionStatModel(Base):
    """A yearly institution figure: library, ICT, budget and expenditure, audits (see stats.KEYS)."""
    __tablename__ = "institution_stats"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    key        = Column(String, nullable=False)
    year       = Column(String, nullable=False)
    value      = Column(Float, nullable=True)
    text       = Column(String, nullable=True)                   # options / yes-no / link
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    pilot_run  = Column(String, nullable=True, index=True)

    __table_args__ = (UniqueConstraint("key", "year", name="uq_institution_stat"),)


class MeetingModel(Base):
    """A meeting of a statutory body or committee, with its decisions and their follow-through."""
    __tablename__ = "meetings"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    body       = Column(String, nullable=False, index=True)      # iqac | bos | academic_council | governing_body | finance |
                                                                 # dab | pac | anti_ragging | grievance | icc
    programme  = Column(String, nullable=True)                   # BoS / DAB / PAC are per programme
    held_on    = Column(Date, nullable=False)
    year       = Column(String, nullable=False, index=True)
    attendees  = Column(Integer, nullable=True)
    agenda     = Column(Text, nullable=True)
    decisions  = Column(JSON, nullable=False, default=list)      # [{"text", "owner", "status": open | done}]
    minutes    = Column(String, nullable=True)                   # link to the signed minutes
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    pilot_run  = Column(String, nullable=True, index=True)
