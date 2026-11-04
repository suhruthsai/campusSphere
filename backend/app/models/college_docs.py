# The college's published documents (syllabi, calendars, fee structure, admission lists, exam notices...), found by
# reading the official website. Shown to everyone in CampusLocker under "College documents".
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from backend.app.db.session import Base


class CollegeDocumentModel(Base):
    """One document the college website links to.

    kind "file": a PDF hosted on mvsrec.edu.in, downloaded and kept (private_uploads/college) so it opens in the app.
    kind "link": a document we only know by name and link (Google Drive forbids automated downloads, and files
                 that are not PDFs or are too big); students open it at its source.
    """
    __tablename__ = "college_documents"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    url          = Column(String, unique=True, nullable=False, index=True)   # the document's own address (Drive links: the /view address)
    title        = Column(String, nullable=False)
    category     = Column(String, nullable=False, index=True)
    kind         = Column(String, nullable=False)                           # file | link
    host         = Column(String, nullable=False)                           # site | drive
    page_title   = Column(String, nullable=True)                            # the website page that links it
    page_url     = Column(String, nullable=True)
    published_on = Column(String, nullable=True)                            # "2026-06-05" when the link text starts with a date
    stored_name  = Column(String, nullable=True)                            # file on disk (kind "file")
    content_type = Column(String, nullable=True)
    size_bytes   = Column(Integer, nullable=True)
    sha256       = Column(String, nullable=True)
    active       = Column(Boolean, default=True, index=True)                # false once the website no longer links it
    first_seen   = Column(DateTime, default=datetime.utcnow)
    last_seen    = Column(DateTime, default=datetime.utcnow)
