import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

from backend.app.db.session import get_db
from backend.app.models.campus import UserModel
from backend.app.schemas.campus import UserLogin, UserCreate, UserOut, Token, PasswordChange
from backend.app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, get_optional_user, require_admin
)
from backend.app.core.rate_limit import SlidingWindowLimiter, client_ip, too_many

router = APIRouter()

# ── Brute-force protection ─────────────────────────────────────────────────────
# Only FAILED logins count, and a successful login clears that account's counter
# for the IP. Limits are checked before the password is verified, so a locked-out
# attacker can't keep testing passwords.
LOCKOUT_WINDOW = 15 * 60
login_fail_ip_email = SlidingWindowLimiter(limit=5,  window=LOCKOUT_WINDOW)  # one account from one IP
login_fail_ip       = SlidingWindowLimiter(limit=20, window=LOCKOUT_WINDOW)  # password spraying from one IP
login_fail_email    = SlidingWindowLimiter(limit=50, window=LOCKOUT_WINDOW)  # distributed attack on one account
register_ip         = SlidingWindowLimiter(limit=10, window=60 * 60)         # sign-up spam
password_change_fail = SlidingWindowLimiter(limit=5, window=LOCKOUT_WINDOW)  # stolen-session guessing

LOCKED_MSG = "Too many failed login attempts."

# Verifying against a dummy hash when the email doesn't exist keeps response times
# the same, so attackers can't discover which emails have accounts.
_DUMMY_HASH = get_password_hash("timing-equaliser-not-a-real-password")

# ── Register ───────────────────────────────────────────────────────────────────
@router.post("/register", response_model=UserOut, status_code=201, summary="Register a new user")
def register(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: Optional[dict] = Depends(get_optional_user),
):
    is_admin = bool(current and current.get("role") == "admin")
    if not is_admin:  # admins creating accounts aren't limited
        register_ip.check_and_hit(client_ip(request), "Too many sign-ups from this network.")

    # Public sign-up can only create students (active) or faculty (pending admin approval).
    # Admin and staff accounts can only be created by an admin.
    if payload.role in ("admin", "staff") and not is_admin:
        raise HTTPException(status_code=403, detail="Only an admin can create admin or staff accounts.")
    account_status = "pending" if payload.role == "faculty" and not is_admin else "active"

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
        status=account_status,
        joined_at=datetime.utcnow().strftime("%Y-%m-%d"),
        last_active=datetime.utcnow().strftime("%Y-%m-%d"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

# ── Login ──────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=Token, summary="Login and get JWT")
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    ip = client_ip(request)
    keys = [
        (login_fail_ip_email, f"{ip}|{email}"),
        (login_fail_ip,       ip),
        (login_fail_email,    email),
    ]
    waits = [w for limiter, key in keys if (w := limiter.retry_after(key)) is not None]
    if waits:
        raise too_many(LOCKED_MSG, max(waits))

    user = db.query(UserModel).filter(UserModel.email == email).first()
    password_ok = verify_password(payload.password, user.hashed_password if user else _DUMMY_HASH)
    if not user or not password_ok:
        for limiter, key in keys:
            limiter.hit(key)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    login_fail_ip_email.reset(f"{ip}|{email}")
    if user.status == "pending":
        raise HTTPException(status_code=403, detail="Account is awaiting admin approval.")
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

# ── Change own password ────────────────────────────────────────────────────────
@router.post("/change-password", summary="Change the current user's password")
def change_password(payload: PasswordChange, current: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    wait = password_change_fail.retry_after(current["sub"])
    if wait is not None:
        raise too_many("Too many incorrect password attempts.", wait)
    user = db.query(UserModel).filter(UserModel.id == current["sub"]).first()
    if not user or not verify_password(payload.current_password, user.hashed_password):
        password_change_fail.hit(current["sub"])
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    password_change_fail.reset(current["sub"])
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password updated."}

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
    # Students' roll numbers live on their academic profile (Student Services)
    from backend.app.models.services import StudentProfileModel
    rolls = {p.user_id: p.roll_no for p in db.query(StudentProfileModel).filter(
        StudentProfileModel.user_id.in_([u.id for u in users])).all()}
    return {"total": total, "users": [
        UserOut.model_validate(u).model_dump() | {"roll_no": rolls.get(u.id) or u.roll_no, "staff_id": u.staff_id}
        for u in users]}

# ── Get single user (admin only) ───────────────────────────────────────────────
@router.get("/users/{user_id}", response_model=UserOut, summary="Get user by ID (admin only)")
def get_user(user_id: str, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user

# ── Update a user's details (admin only) ───────────────────────────────────────
class UserUpdate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    role: Literal["student", "faculty", "staff", "admin"]
    department: str = Field(..., min_length=1, max_length=50)
    status: Literal["active", "pending", "inactive", "suspended"]


@router.put("/users/{user_id}", response_model=UserOut, summary="Update a user's details (admin only)")
def update_user(user_id: str, body: UserUpdate, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user_id == _admin["sub"] and (body.role != "admin" or body.status != "active"):
        raise HTTPException(status_code=400, detail="You cannot remove your own admin access.")
    email = body.email.lower()
    if email != user.email and db.query(UserModel).filter(UserModel.email == email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    user.name, user.email, user.role = body.name.strip(), email, body.role
    user.department, user.status = body.department.strip(), body.status
    db.commit()
    db.refresh(user)
    return user

# ── Reset a user's password (admin only) ───────────────────────────────────────
@router.post("/users/{user_id}/reset-password", summary="Give a user a new temporary password (admin only)")
def reset_password(user_id: str, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    import secrets
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    temp = secrets.token_urlsafe(9)   # 12 characters; the user changes it under My account
    user.hashed_password = get_password_hash(temp)
    db.commit()
    return {"email": user.email, "temporary_password": temp}

# ── Update user status (admin only) ────────────────────────────────────────────
@router.patch("/users/{user_id}/status", summary="Activate or deactivate a user (admin only)")
def update_user_status(
    user_id: str,
    new_status: str = Query(..., pattern="^(active|pending|inactive|suspended)$"),
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    if user_id == _admin["sub"] and new_status != "active":
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.status = new_status
    db.commit()
    return {"message": f"User {user.name} status set to '{new_status}'"}

# ── Delete user (admin only) ────────────────────────────────────────────────────
@router.delete("/users/{user_id}", summary="Delete a user (admin only)")
def delete_user(user_id: str, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    if user_id == _admin["sub"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    from backend.app.models.admissions import AdmissionModel, PaymentModel
    from backend.app.models.leaving import ClearanceOfficerModel, ExitModel
    from backend.app.models.services import ApproverAssignmentModel, DocumentRequestModel, StudentProfileModel
    # Official records (fees, admissions, certificates, clearance) must not lose their owner
    has_records = any(db.query(m).filter(col == user_id).first() for m, col in (
        (PaymentModel, PaymentModel.user_id), (AdmissionModel, AdmissionModel.user_id),
        (DocumentRequestModel, DocumentRequestModel.student_id), (ExitModel, ExitModel.user_id)))
    if has_records:
        raise HTTPException(status_code=400, detail="This account has fee, admission or certificate records, so it can't be deleted. Set its status to inactive instead.")
    # Roles and links that only make sense while the account exists
    db.query(ApproverAssignmentModel).filter(ApproverAssignmentModel.user_id == user_id).delete(synchronize_session=False)
    db.query(ClearanceOfficerModel).filter(ClearanceOfficerModel.user_id == user_id).delete(synchronize_session=False)
    db.query(StudentProfileModel).filter(StudentProfileModel.mentor_id == user_id).update({"mentor_id": None}, synchronize_session=False)
    db.query(StudentProfileModel).filter(StudentProfileModel.user_id == user_id).delete(synchronize_session=False)
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
