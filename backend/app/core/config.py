from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "CampusSphere API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str = "campussphere_super_secret_jwt_key_2026_suhruth_university"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Database — defaults to SQLite (works immediately).
    # Switch to PostgreSQL by setting DATABASE_URL env variable:
    #   export DATABASE_URL="postgresql://campussphere_user:campussphere123@localhost/campussphere"
    DATABASE_URL: str = "sqlite:///./campussphere.db"
    
    CORS_ORIGINS: List[str] = ["*"]

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"   # ignore VITE_* and other non-Settings keys in .env

settings = Settings()
