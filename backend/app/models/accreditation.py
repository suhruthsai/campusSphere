# Accreditation workspace: each metric's value per academic year (with where it came from), the evidence documents
# behind it, and who is responsible (IQAC Coordinator, criterion in-charges, NBA programme coordinators).
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint

from backend.app.db.session import Base


class AccrValueModel(Base):
    """A metric's value for one academic year (and one programme, for NBA). Only fileable when its origin is not
    'generated' and, for anything typed in, when evidence backs it."""
    __tablename__ = "accr_values"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    framework   = Column(String, nullable=False)                 # naac | nba
    code        = Column(String, nullable=False)                 # "2.6.3", "EP2.1", "4.5"
    programme   = Column(String, nullable=False, default="")     # "" = the institution; "IT" for an NBA programme
    year        = Column(String, nullable=False)                 # "2025-26"
    value       = Column(Float, nullable=True)                   # numbers (percent, count, ratio, days, lakh)
    text        = Column(Text, nullable=True)                    # options (A-E), yes/no, or the qualitative write-up
    origin      = Column(String, nullable=False, default="manual")   # live | imported | manual | generated
    note        = Column(Text, nullable=True)
    entered_by  = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    entered_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    locked      = Column(Boolean, nullable=False, default=False) # reviewed and frozen by the IQAC Coordinator
    locked_by   = Column(String, nullable=True)
    locked_at   = Column(DateTime, nullable=True)

    __table_args__ = (UniqueConstraint("framework", "code", "programme", "year", name="uq_accr_value"),)


class AccrEvidenceModel(Base):
    """A document backing a metric for a year: an uploaded file (kept privately, versioned) or a public link
    (the SSR's hyperlinks must open for the peer team)."""
    __tablename__ = "accr_evidence"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    framework   = Column(String, nullable=False, index=True)
    code        = Column(String, nullable=False, index=True)
    programme   = Column(String, nullable=False, default="")
    year        = Column(String, nullable=False)
    title       = Column(String, nullable=False)
    kind        = Column(String, nullable=False, default="file")  # file | link
    filename    = Column(String, nullable=True)                   # stored name under private_uploads/accreditation
    original    = Column(String, nullable=True)                   # the uploader's file name
    mime        = Column(String, nullable=True)
    size        = Column(Integer, nullable=True)
    sha256      = Column(String, nullable=True)
    url         = Column(String, nullable=True)                   # kind = link: where it is published
    signed      = Column(Boolean, nullable=False, default=False)  # signed and sealed by the Principal
    version     = Column(Integer, nullable=False, default=1)
    replaces_id = Column(Integer, ForeignKey("accr_evidence.id", ondelete="SET NULL"), nullable=True)
    removed     = Column(Boolean, nullable=False, default=False)  # superseded or withdrawn; kept for the audit trail
    source      = Column(String, nullable=True)                   # e.g. "college website" when found by the crawler
    uploaded_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    pilot_run   = Column(String, nullable=True, index=True)


class AccrRoleModel(Base):
    """Who is responsible: the IQAC Coordinator (everything), a criterion in-charge (one NAAC criterion), an NBA
    coordinator (one programme), or a metric owner (one metric)."""
    __tablename__ = "accr_roles"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    role      = Column(String, nullable=False)                    # iqac_coordinator | criterion_incharge | nba_coordinator | metric_owner
    user_id   = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    framework = Column(String, nullable=True)
    criterion = Column(String, nullable=True)                     # criterion_incharge: "2"
    programme = Column(String, nullable=True)                     # nba_coordinator: "IT"
    code      = Column(String, nullable=True)                     # metric_owner: "2.6.3"
    created_at = Column(DateTime, default=datetime.utcnow)


class InstitutionFactModel(Base):
    """Facts about the college for the accreditation profile (NAAC grade and cycle, NBA-accredited programmes and
    validity, AISHE / NIRF IDs, IQAC members...), each with where it came from."""
    __tablename__ = "institution_facts"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    key        = Column(String, nullable=False)                   # naac_grade, nba_programmes, iqac_coordinator...
    value      = Column(Text, nullable=False)
    source_url = Column(String, nullable=True)
    verified   = Column(Boolean, nullable=False, default=False)   # confirmed by the IQAC (crawled facts start unverified)
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("key", name="uq_institution_fact"),)
