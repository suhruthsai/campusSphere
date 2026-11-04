from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.app.core.config import settings

DATABASE_URL = settings.DATABASE_URL
# Some hosts (Heroku, older Render URLs) hand out "postgres://", which SQLAlchemy 2 rejects
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]

_is_sqlite = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    connect_args=(
        {"check_same_thread": False} if _is_sqlite
        else {"connect_timeout": 5}   # fail fast if PostgreSQL isn't up yet
    ),
    pool_pre_ping=True,
    # Kept small: free-tier Postgres plans allow very few connections
    **({} if _is_sqlite else {"pool_size": 5, "max_overflow": 5})
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
        cur.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
