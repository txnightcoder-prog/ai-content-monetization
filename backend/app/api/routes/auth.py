"""
Auth + user-management endpoints.

Public:
  POST /api/v1/auth/login        — returns JWT
  GET  /api/v1/auth/me           — returns current user info (requires token)

Admin-only:
  GET    /api/v1/auth/users          — list all users
  POST   /api/v1/auth/users          — create a user
  DELETE /api/v1/auth/users/{id}     — delete a user (cannot delete yourself)
  PATCH  /api/v1/auth/users/{id}     — update role or active status
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List

from app.core.auth import (
    check_password, verify_totp, create_token,
    require_auth, require_admin,
    _hash_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str          # accepts email
    password: str
    totp_code: str = ""

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 43200
    role: str

class UserOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    created_at: str

class CreateUserRequest(BaseModel):
    email: str
    password: str
    role: str = "viewer"   # "admin" | "viewer"

class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    role = check_password(body.username, body.password)
    if role is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_totp(body.totp_code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA code")

    token = create_token(subject=body.username.lower().strip(), role=role)
    return LoginResponse(access_token=token, role=role)


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me")
def me(claims: dict = Depends(require_auth)):
    return {"email": claims["sub"], "role": claims["role"]}


# ── User management (admin only) ─────────────────────────────────────────────

def _user_to_out(u) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else "",
    }


@router.get("/users", response_model=List[UserOut])
def list_users(claims: dict = Depends(require_admin)):
    from app.core.database import SessionLocal
    from app.models.dashboard_user import DashboardUser
    db = SessionLocal()
    try:
        return [_user_to_out(u) for u in db.query(DashboardUser).order_by(DashboardUser.created_at).all()]
    finally:
        db.close()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(body: CreateUserRequest, claims: dict = Depends(require_admin)):
    from app.core.database import SessionLocal
    from app.models.dashboard_user import DashboardUser

    if body.role not in ("admin", "viewer"):
        raise HTTPException(status_code=400, detail="role must be 'admin' or 'viewer'")

    db = SessionLocal()
    try:
        existing = db.query(DashboardUser).filter(DashboardUser.email == body.email.lower().strip()).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        user = DashboardUser(
            email=body.email.lower().strip(),
            password_hash=_hash_password(body.password),
            role=body.role,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return _user_to_out(user)
    finally:
        db.close()


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, body: UpdateUserRequest, claims: dict = Depends(require_admin)):
    from app.core.database import SessionLocal
    from app.models.dashboard_user import DashboardUser

    db = SessionLocal()
    try:
        user = db.query(DashboardUser).filter(DashboardUser.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if body.role is not None:
            if body.role not in ("admin", "viewer"):
                raise HTTPException(status_code=400, detail="role must be 'admin' or 'viewer'")
            user.role = body.role
        if body.is_active is not None:
            user.is_active = body.is_active
        if body.password is not None and body.password.strip():
            user.password_hash = _hash_password(body.password)
        db.commit()
        db.refresh(user)
        return _user_to_out(user)
    finally:
        db.close()


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str, claims: dict = Depends(require_admin)):
    from app.core.database import SessionLocal
    from app.models.dashboard_user import DashboardUser
    import os

    db = SessionLocal()
    try:
        user = db.query(DashboardUser).filter(DashboardUser.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        # Prevent deleting yourself
        if user.email == claims["sub"]:
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        # Prevent deleting the seeded admin
        seed_email = os.getenv("DASHBOARD_USERNAME", "txnightcoder@gmail.com").lower().strip()
        if user.email == seed_email:
            raise HTTPException(status_code=400, detail="Cannot delete the primary admin account")
        db.delete(user)
        db.commit()
    finally:
        db.close()

# Made with Bob
