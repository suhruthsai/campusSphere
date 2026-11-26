from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.app.core.config import settings

def normalize_url(url: str) -> str:
    """Postgres URLs as hosts hand them out -> one SQLAlchemy can use with psycopg2 (in requirements.txt).
    Some hosts (Heroku, older Render URLs) say "postgres://", which SQLAlchemy 2 rejects, and SQLAlchemy 2.1
    reads a bare "postgresql://" as psycopg 3, which isn't installed."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


DATABASE_URL = normalize_url(settings.DATABASE_URL)

_is_sqlite = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    connect_args=(
        {"check_same_thread": False} if _is_sqlite
        else {"connect_timeout": 5}   # fail fast if PostgreSQL isn't up yet
    ),
    pool_pre_ping=True,
    # Kept small: free-tier Postgres plans allow very few connections. Serverless Postgres (Neon) closes idle
    # connections and suspends when unused, so connections are replaced after 5 minutes instead of going stale.
    **({} if _is_sqlite else {"pool_size": 5, "max_overflow": 5, "pool_recycle": 300})
)

if _is_sqlite:
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _sqlite_foreign_keys(dbapi_connection, _record):
        """SQLite ignores foreign keys unless each connection asks for them, so ON DELETE CASCADE
        does nothing by default: deleting a document used to leave its chunks behind. Postgres
        enforces them anyway, which is why this only bit the local database."""
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        # The crawler, the document scraper and model training write from background threads while requests
        # run: WAL lets readers carry on during a write, and busy_timeout waits for a lock instead of failing
        # with "database is locked".
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=15000")
        cur.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
