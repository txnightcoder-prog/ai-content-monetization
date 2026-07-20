"""
Authentication helpers — multi-user, role-based.

Users are stored in the dashboard_users table.
On first startup, an admin user is seeded from env vars:
  DASHBOARD_USERNAME  (email, default: txnightcoder@gmail.com)
  DASHBOARD_PASSWORD  (plaintext at seed time only — stored as bcrypt hash)

Roles:
  admin   — full access + user management
  viewer  — read-only

JWT claims: { sub: email, role: "admin"|"viewer", exp, iat }
"""

import os
import time
import hmac
import hashlib
import base64
import struct
import logging
import json
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# ── Password hashing (bcrypt via passlib if available, fallback PBKDF2) ───────

def _hash_password(password: str) -> str:
    try:
        from passlib.context import CryptContext
        return CryptContext(schemes=["bcrypt"], deprecated="auto").hash(password)
    except ImportError:
        # Fallback: PBKDF2-HMAC-SHA256 — no external dep needed
        salt = os.urandom(16).hex()
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return f"pbkdf2:{salt}:{dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        from passlib.context import CryptContext
        return CryptContext(schemes=["bcrypt"], deprecated="auto").verify(password, stored)
    except ImportError:
        if not stored.startswith("pbkdf2:"):
            return False
        _, salt, dk_hex = stored.split(":", 2)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return hmac.compare_digest(dk.hex(), dk_hex)


# ── JWT (HS256, hand-rolled — no python-jose dependency) ──────────────────────

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (pad % 4))

def create_token(subject: str, role: str = "viewer", expires_hours: int = 12) -> str:
    secret = os.getenv("DASHBOARD_SECRET", "")
    if not secret:
        raise RuntimeError("DASHBOARD_SECRET env var is not set")
    header  = _b64url(b'{"alg":"HS256","typ":"JWT"}')
    now     = int(time.time())
    payload = _b64url(json.dumps({"sub": subject, "role": role, "exp": now + expires_hours * 3600, "iat": now}).encode())
    signing_input = f"{header}.{payload}".encode()
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url(sig)}"


def verify_token(token: str) -> Optional[dict]:
    """Returns claims dict {sub, role} if valid, None otherwise."""
    secret = os.getenv("DASHBOARD_SECRET", "")
    if not secret:
        return None
    try:
        header, payload, sig = token.split(".")
        signing_input = f"{header}.{payload}".encode()
        expected_sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url(expected_sig), sig):
            return None
        claims = json.loads(_b64url_decode(payload))
        if claims.get("exp", 0) < time.time():
            return None
        return {"sub": claims.get("sub"), "role": claims.get("role", "viewer")}
    except Exception:
        return None


# ── TOTP (RFC 6238 — Google Authenticator compatible) ─────────────────────────

def _hotp(key_bytes: bytes, counter: int) -> int:
    msg = struct.pack(">Q", counter)
    h   = hmac.new(key_bytes, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code = struct.unpack(">I", h[offset:offset+4])[0] & 0x7FFFFFFF
    return code % 1_000_000

def verify_totp(user_code: str) -> bool:
    """Verify a 6-digit TOTP code. Accepts current ±1 window (90 sec tolerance)."""
    secret_b32 = os.getenv("DASHBOARD_TOTP_SECRET", "")
    if not secret_b32:
        logger.warning("DASHBOARD_TOTP_SECRET not set — 2FA is disabled")
        return True
    try:
        key = base64.b32decode(secret_b32.upper().replace(" ", ""))
    except Exception:
        logger.error("DASHBOARD_TOTP_SECRET is not valid base32")
        return False
    counter = int(time.time()) // 30
    for delta in (-1, 0, 1):
        if _hotp(key, counter + delta) == int(user_code or "0"):
            return True
    return False


# ── DB login check ─────────────────────────────────────────────────────────────

def check_password(email: str, password: str) -> Optional[str]:
    """
    Returns the user's role string if credentials are valid, None otherwise.
    Looks up the email in dashboard_users table.
    """
    from app.core.database import SessionLocal
    from app.models.dashboard_user import DashboardUser
    db = SessionLocal()
    try:
        user = db.query(DashboardUser).filter(
            DashboardUser.email == email.lower().strip(),
            DashboardUser.is_active == True,
        ).first()
        if user is None:
            return None
        if not _verify_password(password, user.password_hash):
            return None
        return user.role
    finally:
        db.close()


# ── Seed admin on startup ──────────────────────────────────────────────────────

def seed_admin() -> None:
    """
    Called once at startup. Creates the admin user from env vars if no users exist.
    DASHBOARD_USERNAME — admin email (default: txnightcoder@gmail.com)
    DASHBOARD_PASSWORD — plain password (required)
    """
    from app.core.database import SessionLocal
    from app.models.dashboard_user import DashboardUser

    email    = os.getenv("DASHBOARD_USERNAME", "txnightcoder@gmail.com").lower().strip()
    password = os.getenv("DASHBOARD_PASSWORD", "")
    if not password:
        logger.error("DASHBOARD_PASSWORD not set — admin account will not be seeded")
        return

    db = SessionLocal()
    try:
        existing = db.query(DashboardUser).filter(DashboardUser.email == email).first()
        if existing:
            # Ensure this user is always admin (in case role was accidentally changed)
            if existing.role != "admin":
                existing.role = "admin"
                db.commit()
            return
        user = DashboardUser(
            email=email,
            password_hash=_hash_password(password),
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        logger.info("Admin user seeded: %s", email)
    except Exception as exc:
        logger.error("Failed to seed admin user: %s", exc)
        db.rollback()
    finally:
        db.close()


# ── FastAPI dependency ─────────────────────────────────────────────────────────

def require_auth(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """Returns {sub, role} dict. Raises 401 if token missing/invalid."""
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    claims = verify_token(creds.credentials)
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return claims


def require_admin(claims: dict = Depends(require_auth)) -> dict:
    """Raises 403 unless the token carries role=admin."""
    if claims.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return claims

# Made with Bob
