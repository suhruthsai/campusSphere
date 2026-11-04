# CampusLocker: a student's (or staff member's) own document store, with expiring share links and an access log.
# The college's issued certificates and the joining uploads are shown in the locker from their own tables; only
# files added to the locker itself are stored here.
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String

from backend.app.db.session import Base


class LockerFileModel(Base):
    """A file in someone's locker. Files live outside the public /media folder (private_uploads/locker)."""
    __tablename__ = "locker_files"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    user_id       = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title         = Column(String, nullable=False)
    category      = Column(String, default="other")            # id_proof | marksheet | certificate | offer_letter | receipt | other
    source        = Column(String, default="self")             # self (uploaded by the owner) | college (added by the Admin Office)
    stored_name   = Column(String, nullable=False)             # random file name on disk
    original_name = Column(String, nullable=True)
    content_type  = Column(String, nullable=False)
    size_bytes    = Column(Integer, nullable=False)
    verified      = Column(Boolean, default=False)             # true for files the college added itself
    added_by      = Column(String, nullable=True)              # user id of whoever added it
    created_at    = Column(DateTime, default=datetime.utcnow)


class LockerShareModel(Base):
    """An expiring link to one item. item_ref is "file:<id>", "req:<id>" (an issued certificate) or "adm:<id>" (a joining upload)."""
    __tablename__ = "locker_shares"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item_ref   = Column(String, nullable=False, index=True)
    title      = Column(String, nullable=False)                # the item's title when it was shared
    token      = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    views      = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class LockerAccessModel(Base):
    """Who opened or shared what, and when (shown to the owner)."""
    __tablename__ = "locker_access"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)   # the owner
    item_ref   = Column(String, nullable=False)
    title      = Column(String, nullable=False)
    action     = Column(String, nullable=False)                # uploaded | added_by_college | shared | revoked | opened_by_link | deleted
    detail     = Column(String, nullable=True)
    at         = Column(DateTime, default=datetime.utcnow, index=True)
