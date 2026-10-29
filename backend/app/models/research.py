# Faculty and research (NBA criterion 5; NAAC 2.4, 3, 6.3): each teacher's service record (qualification, cadre,
# joining / leaving, experience), the research and development they report (papers, patents, projects, FDPs, PhD
# guidance...) verified by the HOD, and department activities (MoUs, extension, collaborations, IPR workshops).
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text

from backend.app.db.session import Base


class FacultyRecordModel(Base):
    """A teacher's service record. Linked to the faculty list when they are on it; former faculty keep a record
    (retention, NBA 5.4)."""
    __tablename__ = "faculty_records"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    profile_id       = Column(String, ForeignKey("faculty_profiles.id", ondelete="SET NULL"), nullable=True, unique=True)
    name             = Column(String, nullable=False)
    department       = Column(String, nullable=False, index=True)       # "IT"
    designation      = Column(String, nullable=False)                   # Professor | Associate Professor | Assistant Professor
    qualification    = Column(String, nullable=False)                   # PhD | M.Tech | M.E | M.Sc | MBA | Other
    phd_year         = Column(Integer, nullable=True)
    specialisation   = Column(String, nullable=True)
    nature           = Column(String, nullable=False, default="regular")   # regular | contract | visiting | adjunct
    joined_on        = Column(Date, nullable=False)
    left_on          = Column(Date, nullable=True)
    prior_experience = Column(Float, nullable=False, default=0)         # years of teaching before joining
    industry_experience = Column(Float, nullable=False, default=0)
    net_set          = Column(Boolean, nullable=False, default=False)   # NET / SET / SLET qualified
    research_guide   = Column(Boolean, nullable=False, default=False)   # recognised PhD supervisor
    updated_by       = Column(String, nullable=True)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    pilot_run        = Column(String, nullable=True, index=True)


class ResearchItemModel(Base):
    """One research / development item a teacher reports. Counts once the HOD (or IQAC) has verified it against
    its evidence."""
    __tablename__ = "research_items"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    faculty_id  = Column(Integer, ForeignKey("faculty_records.id", ondelete="CASCADE"), nullable=False, index=True)
    department  = Column(String, nullable=False, index=True)
    kind        = Column(String, nullable=False, index=True)
    # journal | conference | book | chapter | patent | project | consultancy | fdp_attended | fdp_organised |
    # resource_person | phd_guided | award
    title       = Column(String, nullable=False)
    venue       = Column(String, nullable=True)                         # journal / conference / publisher / funding agency
    indexing    = Column(String, nullable=True)                         # scopus | wos | ugc_care | other
    year        = Column(String, nullable=False, index=True)            # academic year, "2024-25"
    on_date     = Column(Date, nullable=True)
    amount_lakh = Column(Float, nullable=True)                          # projects, consultancy, grants
    status      = Column(String, nullable=True)                         # published | filed | published_patent | granted | sanctioned | ongoing | completed | awarded
    days        = Column(Integer, nullable=True)                        # FDP / STTP duration
    link        = Column(String, nullable=True)                         # DOI / URL of the evidence
    evidence    = Column(String, nullable=True)                         # stored file (private uploads)
    evidence_name = Column(String, nullable=True)
    verified    = Column(Boolean, nullable=False, default=False)
    verified_by = Column(String, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_by  = Column(String, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    pilot_run   = Column(String, nullable=True, index=True)


class DeptActivityModel(Base):
    """A department / college activity: MoU, extension programme, collaboration, IPR / research workshop."""
    __tablename__ = "dept_activities"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    kind         = Column(String, nullable=False, index=True)           # mou | extension | collaboration | ipr_workshop
    department   = Column(String, nullable=True, index=True)            # None = college-wide
    title        = Column(String, nullable=False)
    partner      = Column(String, nullable=True)
    year         = Column(String, nullable=False, index=True)
    on_date      = Column(Date, nullable=True)
    valid_until  = Column(Date, nullable=True)                          # MoUs
    participants = Column(Integer, nullable=True)
    description  = Column(Text, nullable=True)
    link         = Column(String, nullable=True)
    created_by   = Column(String, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    pilot_run    = Column(String, nullable=True, index=True)
