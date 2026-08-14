import os
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
    
    SECRET_KEY: str = "campussphere_super_secret_jwt_key_2026_suhruth_university"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Always resolve to the same absolute SQLite database file
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")
    
    CORS_ORIGINS: List[str] = ["*"]

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
