from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.models.campus import UserModel

import bcrypt

bearer_scheme = HTTPBearer(auto_error=False)

# ── Password helpers ───────────────────────────────────────────────────────────
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# ── JWT helpers ────────────────────────────────────────────────────────────────
def create_access_token(subject: Union[str, Any], extra: dict = None, expires_delta: timedelta = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {"exp": expire, "sub": str(subject), **(extra or {})}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

# ── Current user dependency ────────────────────────────────────────────────────
def _resolve_user(token: str, db: Session) -> Optional[dict]:
    """Validate a JWT and re-check the user in the DB, so deactivated users and
    role changes take effect immediately instead of when the token expires."""
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    user = db.query(UserModel).filter(UserModel.id == payload["sub"]).first()
    if not user or user.status != "active":
        return None
    return {
        "sub":        user.id,
        "role":       user.role,
        "name":       user.name,
        "department": user.department,
        "email":      user.email,
    }

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """FastAPI dependency — extracts and validates the JWT bearer token."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    current = _resolve_user(credentials.credentials, db)
    if not current:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return current  # {sub: user_id, role, name, department, email}

def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[dict]:
    """Like get_current_user, but returns None for anonymous requests."""
    if not credentials:
        return None
    return _resolve_user(credentials.credentials, db)

def require_roles(*roles: str):
    """Dependency factory — the logged-in user must have one of `roles`."""
    def checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return checker

def require_admin(current_user: dict = Depends(get_current_user)):
    """Dependency that requires the logged-in user to be an admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

require_staff = require_roles("admin", "faculty")
