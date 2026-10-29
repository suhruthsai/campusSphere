# Stakeholder feedback (NAAC 1.4, 2.7 dry run; NBA 7, 9.2, 9.3) and examination results (NAAC 2.5, 2.6; NBA 4).
#
# Feedback is anonymous: a response keeps a one-way key (form salt + account) so nobody answers twice, never who
# answered. Teacher feedback is shown only once a form has closed with enough responses to protect identities.
# Results are the Exam Cell's totals per semester and per admission batch: no student's marks or grades.
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint

from backend.app.db.session import Base


class FeedbackFormModel(Base):
    __tablename__ = "feedback_forms"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    title       = Column(String, nullable=False)
    kind        = Column(String, nullable=False, index=True)
    # curriculum (students on the syllabus) | teaching (students on a course's teacher) | course_exit (students on
    # a course's COs) | facilities | faculty (teachers on the curriculum) | alumni | employer | parent | sss
    audience    = Column(String, nullable=False)                  # students | faculty | public (link, no login)
    programme   = Column(String, nullable=True, index=True)       # "IT"; None = college-wide
    year        = Column(String, nullable=False, index=True)      # academic year, "2025-26"
    study_year  = Column(Integer, nullable=True)                  # students of this year of study only (1-4)
    course_id   = Column(Integer, ForeignKey("obe_courses.id", ondelete="SET NULL"), nullable=True)   # teaching, course_exit
    questions   = Column(JSON, nullable=False)                    # [{"id": "q1", "text": ..., "type": "rating" | "text", "co": "CO1"?}]
    status      = Column(String, nullable=False, default="draft") # draft | open | closed
    opens_at    = Column(DateTime, nullable=True)
    closes_at   = Column(DateTime, nullable=True)
    public_code = Column(String, nullable=True, unique=True)      # audience public: the link's code
    salt        = Column(String, nullable=False)                  # for the one-way respondent key
    created_by  = Column(String, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    pilot_run   = Column(String, nullable=True, index=True)


class FeedbackResponseModel(Base):
    __tablename__ = "feedback_responses"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    form_id      = Column(Integer, ForeignKey("feedback_forms.id", ondelete="CASCADE"), nullable=False, index=True)
    respondent   = Column(String, nullable=True)                  # one-way key; None for public forms
    role         = Column(String, nullable=True)                  # student | faculty | alumni | employer | parent
    answers      = Column(JSON, nullable=False)                   # {"q1": 4, "q7": "comment"}
    submitted_at = Column(DateTime, default=datetime.utcnow)
    pilot_run    = Column(String, nullable=True, index=True)

    __table_args__ = (UniqueConstraint("form_id", "respondent", name="uq_feedback_respondent"),)


class FeedbackATRModel(Base):
    """The action-taken report on a form's feedback: analysed, acted upon, approved by the IQAC, published."""
    __tablename__ = "feedback_atr"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    form_id      = Column(Integer, ForeignKey("feedback_forms.id", ondelete="CASCADE"), nullable=False, unique=True)
    observations = Column(Text, nullable=False)
    actions      = Column(Text, nullable=False)
    status       = Column(String, nullable=False, default="draft")   # draft | approved
    approved_by  = Column(String, nullable=True)
    approved_at  = Column(DateTime, nullable=True)
    published    = Column(Boolean, nullable=False, default=False)    # on the college website (NAAC 1.4.2 option A)
    published_at = Column(DateTime, nullable=True)
    updated_by   = Column(String, nullable=True)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    pilot_run    = Column(String, nullable=True, index=True)


class ResultSummaryModel(Base):
    """One semester examination's results for a programme (Exam Cell totals)."""
    __tablename__ = "result_summaries"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    programme     = Column(String, nullable=False, index=True)
    year          = Column(String, nullable=False)                # academic year of the examination
    semester      = Column(Integer, nullable=False)
    exam          = Column(String, nullable=False, default="regular")   # regular | supplementary
    last_exam_on  = Column(Date, nullable=True)
    declared_on   = Column(Date, nullable=True)
    appeared      = Column(Integer, nullable=False)
    passed        = Column(Integer, nullable=False)               # passed every course
    distinction   = Column(Integer, nullable=True)
    first_class   = Column(Integer, nullable=True)
    mean_sgpa     = Column(Float, nullable=True)
    complaints    = Column(Integer, nullable=True)                # grievances / revaluation requests on evaluation
    entered_by    = Column(String, nullable=True)
    entered_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    pilot_run     = Column(String, nullable=True, index=True)

    __table_args__ = (UniqueConstraint("programme", "year", "semester", "exam", name="uq_result_summary"),)


class BatchOutcomeModel(Base):
    """An admission batch from intake to graduation: NBA 4.1 (enrolment), 4.2 (success rate), 4.3-4.4 (performance)."""
    __tablename__ = "batch_outcomes"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    programme           = Column(String, nullable=False, index=True)
    batch               = Column(Integer, nullable=False)         # year of admission, 2021
    intake              = Column(Integer, nullable=False)         # sanctioned (AICTE)
    admitted            = Column(Integer, nullable=False)         # first year
    lateral             = Column(Integer, nullable=False, default=0)   # second-year lateral entry
    graduated_clean     = Column(Integer, nullable=True)          # in the stipulated period, without backlogs
    graduated_backlog   = Column(Integer, nullable=True)          # in the stipulated period, with backlogs cleared
    cgpa_2nd            = Column(Float, nullable=True)            # mean CGPA of students passing 2nd year
    passed_2nd          = Column(Integer, nullable=True)
    appeared_2nd        = Column(Integer, nullable=True)
    cgpa_3rd            = Column(Float, nullable=True)
    passed_3rd          = Column(Integer, nullable=True)
    appeared_3rd        = Column(Integer, nullable=True)
    entered_by          = Column(String, nullable=True)
    entered_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    pilot_run           = Column(String, nullable=True, index=True)

    __table_args__ = (UniqueConstraint("programme", "batch", name="uq_batch_outcome"),)
