# College knowledge base for Mitra (RAG): pages and documents crawled from the official website
# (mvsrec.edu.in), split into searchable chunks, plus the crawl history and the questions people ask.
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from backend.app.db.session import Base


class KbDocumentModel(Base):
    """One crawled page or file. content_hash decides whether a re-crawl re-indexes it."""
    __tablename__ = "kb_documents"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    url          = Column(String, unique=True, nullable=False, index=True)   # canonical URL
    title        = Column(String, nullable=False)
    kind         = Column(String, nullable=False)        # html | pdf | link (known by name and link only)
    source       = Column(String, default="site", index=True)   # site | drive | upload (admin; kept by crawls)
    content_hash = Column(String, nullable=False)
    text         = Column(Text, nullable=False)
    fetched_at   = Column(DateTime, default=datetime.utcnow)   # when the content last changed
    checked_at   = Column(DateTime, default=datetime.utcnow)   # when the crawler last saw it


class KbChunkModel(Base):
    """A passage of a document, the unit the search engine ranks and Mitra quotes from."""
    __tablename__ = "kb_chunks"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("kb_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    ord         = Column(Integer, nullable=False)        # position in the document
    heading     = Column(String, nullable=True)          # nearest heading above the passage
    text        = Column(Text, nullable=False)


class KbCrawlModel(Base):
    """One crawl run (weekly, or an admin's Refresh)."""
    __tablename__ = "kb_crawls"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    trigger     = Column(String, nullable=False)          # weekly | admin | first-run
    status      = Column(String, default="running")       # running | done | failed
    started_at  = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    pages       = Column(Integer, default=0)              # documents fetched
    changed     = Column(Integer, default=0)              # new or changed documents re-indexed
    removed     = Column(Integer, default=0)              # documents that disappeared from the site
    errors      = Column(Integer, default=0)
    note        = Column(Text, nullable=True)


class KbAskedModel(Base):
    """A question someone asked Mitra (text only, no user), to see what people ask and what's missing."""
    __tablename__ = "kb_asked"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    question   = Column(Text, nullable=False)              # the search query Mitra made (English)
    lang       = Column(String, nullable=True)
    top_score  = Column(Float, nullable=True)              # best search score: low = the site has no answer
    answered   = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
