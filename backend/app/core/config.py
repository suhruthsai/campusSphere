import os
import secrets
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List, Optional

# Root directory of the repository
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_DB_PATH = ROOT_DIR / "campussphere.db"

class Settings(BaseSettings):
    PROJECT_NAME: str = "CampusSphere API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # "development" or "production". Production refuses to start without a real SECRET_KEY.
    ENVIRONMENT: str = "development"

    # Must be set via environment / .env. Empty means "generate an ephemeral key" in development.
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours

    # Always resolve to the same absolute SQLite database file
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

    # Comma-separated list of allowed frontend origins
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Bootstrap admin account (created only if it doesn't exist yet)
    ADMIN_EMAIL: str = "admin@suhruth.edu"
    ADMIN_PASSWORD: Optional[str] = None

    # Server-side only — never expose this to the frontend bundle
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()

if not settings.SECRET_KEY:
    if settings.ENVIRONMENT == "production":
        raise RuntimeError("SECRET_KEY must be set in production.")
    # Ephemeral key: tokens stop working when the server restarts. Set SECRET_KEY in .env to persist sessions.
    settings.SECRET_KEY = secrets.token_urlsafe(48)
    print("⚠️  SECRET_KEY not set — using a random per-process key (logins reset on restart).")
