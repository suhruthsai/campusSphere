# Outcome-based education (NBA criteria 2, 3, 7; NAAC 2.6): each programme's PEOs, POs and PSOs; each course
# offering's COs and CO-PO/PSO mapping; assessments with per-question CO tags; course-exit surveys; the attainment
# rules; and the actions taken when a PO falls short.
#
# Marks: a marks sheet is read when it is imported, and only each question's totals are kept (students who attempted
# it, how many reached the target, the average). CampusSphere never stores an individual student's marks.
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint

from backend.app.db.session import Base


class ObeOutcomeModel(Base):
    """A programme's PEO, PO or PSO."""
    __tablename__ = "obe_outcomes"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    programme = Column(String, nullable=False, index=True)        # "IT"
    kind      = Column(String, nullable=False)                    # PEO | PO | PSO
    code      = Column(String, nullable=False)                    # "PO1", "PSO2", "PEO3"
    title     = Column(String, nullable=True)                     # "Engineering knowledge"
    text      = Column(Text, nullable=False)
    ord       = Column(Integer, nullable=False, default=0)
    pilot_run = Column(String, nullable=True, index=True)

    __table_args__ = (UniqueConstraint("programme", "code", name="uq_obe_outcome"),)


class ObeCourseModel(Base):
    """One offering of a course: a subject in an academic year, with its course coordinator."""
    __tablename__ = "obe_courses"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    programme     = Column(String, nullable=False, index=True)
    code          = Column(String, nullable=False)                # subject code, "U21PC501IT"
    name          = Column(String, nullable=False)
    semester      = Column(Integer, nullable=True)
    year          = Column(String, nullable=False, index=True)    # academic year offered, "2025-26"
    kind          = Column(String, nullable=False, default="theory")   # theory | lab | project
    credits       = Column(Float, nullable=True)
    coordinator   = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    students      = Column(Integer, nullable=True)                # registered students
    pilot_run     = Column(String, nullable=True, index=True)

    __table_args__ = (UniqueConstraint("programme", "code", "year", name="uq_obe_course"),)


class ObeCOModel(Base):
    __tablename__ = "obe_cos"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("obe_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    code      = Column(String, nullable=False)                    # "CO1"
    text      = Column(Text, nullable=False)
    bloom     = Column(String, nullable=True)                     # K1 Remember ... K6 Create

    __table_args__ = (UniqueConstraint("course_id", "code", name="uq_obe_co"),)


class ObeMappingModel(Base):
    """How strongly a CO addresses a PO / PSO: 1 low, 2 medium, 3 high."""
    __tablename__ = "obe_mapping"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("obe_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    co_code   = Column(String, nullable=False)
    outcome   = Column(String, nullable=False)                    # "PO3", "PSO1"
    strength  = Column(Integer, nullable=False)

    __table_args__ = (UniqueConstraint("course_id", "co_code", "outcome", name="uq_obe_mapping"),)


class ObeAssessmentModel(Base):
    __tablename__ = "obe_assessments"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    course_id   = Column(Integer, ForeignKey("obe_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String, nullable=False)                  # "CIE-1", "Assignment 1", "SEE"
    kind        = Column(String, nullable=False, default="internal")   # internal (CIE) | external (SEE)
    held_on     = Column(Date, nullable=True)
    students    = Column(Integer, nullable=False, default=0)      # rows in the imported sheet
    source      = Column(String, nullable=True)                   # file name imported
    imported_by = Column(String, nullable=True)
    imported_at = Column(DateTime, default=datetime.utcnow)
    pilot_run   = Column(String, nullable=True, index=True)


class ObeQuestionModel(Base):
    """One question's totals (never per-student marks)."""
    __tablename__ = "obe_questions"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    assessment_id = Column(Integer, ForeignKey("obe_assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    label         = Column(String, nullable=False)                # "Q1a"
    co_code       = Column(String, nullable=False)
    max_marks     = Column(Float, nullable=False)
    attempted     = Column(Integer, nullable=False, default=0)
    reached       = Column(Integer, nullable=False, default=0)    # scored at least the target % of max_marks
    mean          = Column(Float, nullable=True)


class ObeSurveyModel(Base):
    """Course-exit survey (indirect attainment): students rate each CO 1-5."""
    __tablename__ = "obe_surveys"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("obe_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    co_code   = Column(String, nullable=False)
    responses = Column(Integer, nullable=False, default=0)
    mean      = Column(Float, nullable=True)                      # 1-5

    __table_args__ = (UniqueConstraint("course_id", "co_code", name="uq_obe_survey"),)


class ObeSettingsModel(Base):
    """The programme's attainment rules (the DAB / PAC decides them; NBA asks that they be stated)."""
    __tablename__ = "obe_settings"

    programme      = Column(String, primary_key=True)
    target_pct     = Column(Float, nullable=False, default=60)    # a student 'reaches' a question at this % of its marks
    level1_pct     = Column(Float, nullable=False, default=50)    # share of students reaching it -> level 1 / 2 / 3
    level2_pct     = Column(Float, nullable=False, default=60)
    level3_pct     = Column(Float, nullable=False, default=70)
    internal_weight = Column(Float, nullable=False, default=0.4)  # CIE share of direct attainment (SEE: the rest)
    direct_weight  = Column(Float, nullable=False, default=0.8)   # direct share of CO attainment (survey: the rest)
    po_target      = Column(Float, nullable=False, default=2.0)   # PO / PSO attainment target (on the 0-3 scale)
    updated_by     = Column(String, nullable=True)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ObeActionModel(Base):
    """Closing the loop (NBA 7.1): what was done about a PO / PSO below target, and what happened next year."""
    __tablename__ = "obe_actions"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    programme   = Column(String, nullable=False, index=True)
    year        = Column(String, nullable=False)                  # the year whose attainment fell short
    outcome     = Column(String, nullable=False)                  # "PO5"
    attained    = Column(Float, nullable=True)
    target      = Column(Float, nullable=True)
    observation = Column(Text, nullable=False)
    action      = Column(Text, nullable=False)
    responsible = Column(String, nullable=True)
    due         = Column(Date, nullable=True)
    status      = Column(String, nullable=False, default="planned")   # planned | in_progress | done
    result      = Column(Text, nullable=True)                     # the effect seen the next year
    created_by  = Column(String, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    pilot_run   = Column(String, nullable=True, index=True)
