# Student Services V2: joining the college after TGEAPCET (EAMCET) counselling, college fee
# payments and the register of original certificates the college holds.
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, String, Text

from backend.app.db.session import Base


class AdmissionModel(Base):
    """One joining application per student account.

    status: draft -> submitted -> verified -> enrolled  (needs_changes sends it back to the student)
    Fees and originals are tracked separately (payments / originals tables), and enrolment
    needs: verified documents + joining fees paid + originals received.
    """
    __tablename__ = "admissions"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    user_id          = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    status           = Column(String, default="draft", index=True)
    academic_year    = Column(String, nullable=False)                 # "2026-27"

    # TGEAPCET allotment (from the counselling portal)
    hall_ticket_no   = Column(String, nullable=True)
    eapcet_rank      = Column(Integer, nullable=True)
    allotment_no     = Column(String, nullable=True)                  # allotment order number
    counselling_phase = Column(String, nullable=True)                 # "Phase 1", "Final phase", ...
    branch           = Column(String, nullable=True)                  # "CSE", "ECE", ...
    category         = Column(String, nullable=True)                  # OC, BC-A..E, SC, ST, EWS
    quota            = Column(String, default="Convener")
    tuition_paid_on_portal = Column(Integer, nullable=True)           # rupees, as on the portal receipt
    fee_reimbursement = Column(Boolean, default=False)                # applying for TS ePASS / fee reimbursement
    other_board      = Column(Boolean, default=False)                 # Intermediate outside the Telangana board

    # Personal (as in the SSC memo)
    full_name        = Column(String, nullable=True)
    date_of_birth    = Column(Date, nullable=True)
    gender           = Column(String, nullable=True)
    father_name      = Column(String, nullable=True)
    mother_name      = Column(String, nullable=True)
    phone            = Column(String, nullable=True)
    address          = Column(Text, nullable=True)
    ssc_board_year   = Column(String, nullable=True)                  # "BSE Telangana, 2024"
    inter_board_year = Column(String, nullable=True)                  # "TSBIE, 2026"

    # Office
    office_remarks   = Column(Text, nullable=True)
    verified_by      = Column(String, nullable=True)
    verified_at      = Column(DateTime, nullable=True)
    roll_no          = Column(String, nullable=True)
    section          = Column(String, nullable=True)
    enrolled_by      = Column(String, nullable=True)
    enrolled_at      = Column(DateTime, nullable=True)
    submitted_at     = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdmissionDocumentModel(Base):
    """An uploaded copy of a joining document. Files live outside the public /media folder."""
    __tablename__ = "admission_documents"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    admission_id  = Column(Integer, ForeignKey("admissions.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_key       = Column(String, nullable=False)                    # "ssc_memo", "tc", ...
    stored_name   = Column(String, nullable=False)                    # random file name on disk
    original_name = Column(String, nullable=True)
    content_type  = Column(String, nullable=True)
    size_bytes    = Column(Integer, nullable=True)
    status        = Column(String, default="pending")                 # pending | accepted | rejected
    remarks       = Column(Text, nullable=True)
    reviewed_by   = Column(String, nullable=True)
    reviewed_at   = Column(DateTime, nullable=True)
    uploaded_at   = Column(DateTime, default=datetime.utcnow)


class FeeHeadModel(Base):
    """A college fee collected at joining (special fee, CRT fee, university fee, bus fee...)."""
    __tablename__ = "fee_heads"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    amount      = Column(Integer, nullable=False)                     # rupees
    optional    = Column(Boolean, default=False)                      # e.g. bus fee: only if the student opts in
    active      = Column(Boolean, default=True)
    sort_order  = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow)


class PaymentModel(Base):
    """A payment for joining fees. provider 'test' simulates the gateway (no real money)."""
    __tablename__ = "payments"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    user_id             = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    admission_id        = Column(Integer, ForeignKey("admissions.id", ondelete="SET NULL"), nullable=True, index=True)
    purpose             = Column(String, default="joining_fees")
    items               = Column(JSON, default=list)                  # [{fee_head_id, name, amount}]
    amount              = Column(Integer, nullable=False)             # rupees
    currency            = Column(String, default="INR")
    status              = Column(String, default="created", index=True)  # created | paid | failed
    provider            = Column(String, default="test")
    provider_order_id   = Column(String, nullable=True)
    provider_payment_id = Column(String, nullable=True)
    receipt_no          = Column(String, unique=True, nullable=True)  # MVSR/RCPT/2026/00001 once paid
    details             = Column(JSON, default=dict)                  # e.g. {"bus_boarding_point": "..."}
    created_at          = Column(DateTime, default=datetime.utcnow)
    paid_at             = Column(DateTime, nullable=True)


class OriginalCertificateModel(Base):
    """An original certificate physically held by the college, with every hand-over logged.

    status: held | out (temporarily returned, due back) | returned (given back for good)
    movements: [{action: received|lent|redeposited|returned, at, by, note, due_back}]
    """
    __tablename__ = "original_certificates"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    user_id       = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    admission_id  = Column(Integer, ForeignKey("admissions.id", ondelete="SET NULL"), nullable=True)
    doc_key       = Column(String, nullable=False)
    label         = Column(String, nullable=False)
    status        = Column(String, default="held", index=True)
    due_back      = Column(Date, nullable=True)
    movements     = Column(JSON, default=list)
    ack_no        = Column(String, nullable=True, index=True)          # acknowledgement slip it was received on
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
