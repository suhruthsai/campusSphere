import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.db.session import get_db
from backend.app.models.campus import UserModel
from backend.app.schemas.campus import UserLogin, UserCreate, UserOut, Token
from backend.app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_admin
)

router = APIRouter()

# ── Register ───────────────────────────────────────────────────────────────────
@router.post("/register", response_model=UserOut, status_code=201, summary="Register a new user")
def register(payload: UserCreate, db: Session = Depends(get_db)):
    # Check duplicate email
    if db.query(UserModel).filter(UserModel.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user = UserModel(
        id=f"u_{uuid.uuid4().hex[:10]}",
        name=payload.name,
        email=payload.email.lower(),
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        department=payload.department,
        roll_no=getattr(payload, 'roll_no', None),
        staff_id=getattr(payload, 'staff_id', None),
        status="active",
        joined_at=datetime.utcnow().strftime("%Y-%m-%d"),
        last_active=datetime.utcnow().strftime("%Y-%m-%d"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

# ── Login ──────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=Token, summary="Login and get JWT")
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account is inactive. Contact admin.")

    # Update last_active
    user.last_active = datetime.utcnow().strftime("%Y-%m-%d")
    db.commit()

    token = create_access_token(
        subject=user.id,
        extra={
            "role":       user.role,
            "name":       user.name,
            "department": user.department,
            "email":      user.email,
        }
    )
    return {"access_token": token, "token_type": "bearer"}

# ── Me (current user profile) ──────────────────────────────────────────────────
@router.get("/me", response_model=UserOut, summary="Get current user profile")
def get_me(current: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user

# ── List users (admin only) ────────────────────────────────────────────────────
@router.get("/users", summary="List all users (admin only)")
def list_users(
    role: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    q = db.query(UserModel)
    if role:       q = q.filter(UserModel.role == role)
    if department: q = q.filter(UserModel.department == department)
    if status:     q = q.filter(UserModel.status == status)
    if search:     q = q.filter(
        UserModel.name.ilike(f"%{search}%") | UserModel.email.ilike(f"%{search}%")
    )
    total = q.count()
    users = q.offset(offset).limit(limit).all()
    return {"total": total, "users": [UserOut.model_validate(u) for u in users]}

# ── Get single user (admin only) ───────────────────────────────────────────────
@router.get("/users/{user_id}", response_model=UserOut, summary="Get user by ID (admin only)")
def get_user(user_id: str, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user

# ── Update user status (admin only) ────────────────────────────────────────────
@router.patch("/users/{user_id}/status", summary="Activate or deactivate a user (admin only)")
def update_user_status(
    user_id: str,
    new_status: str = Query(..., pattern="^(active|inactive|suspended)$"),
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.status = new_status
    db.commit()
    return {"message": f"User {user.name} status set to '{new_status}'"}

# ── Delete user (admin only) ────────────────────────────────────────────────────
@router.delete("/users/{user_id}", summary="Delete a user (admin only)")
def delete_user(user_id: str, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    db.delete(user)
    db.commit()
    return {"message": f"User '{user.name}' deleted."}

# ── Stats (admin only) ─────────────────────────────────────────────────────────
@router.get("/stats", summary="User statistics for admin dashboard")
def user_stats(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    all_users = db.query(UserModel).all()
    return {
        "total":    len(all_users),
        "students": sum(1 for u in all_users if u.role == "student"),
        "faculty":  sum(1 for u in all_users if u.role == "faculty"),
        "staff":    sum(1 for u in all_users if u.role == "staff"),
        "admins":   sum(1 for u in all_users if u.role == "admin"),
        "active":   sum(1 for u in all_users if u.status == "active"),
        "inactive": sum(1 for u in all_users if u.status != "active"),
    }
