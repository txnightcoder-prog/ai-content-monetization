"""
DashboardUser — accounts that can log in to the dashboard.

Roles:
  admin   — full access + can manage other users
  viewer  — read-only access to all pages
"""

import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.models.base import Base


class DashboardUser(Base):
    __tablename__ = "dashboard_users"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email         = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    role          = Column(String, nullable=False, default="viewer")   # "admin" | "viewer"
    is_active     = Column(Boolean, nullable=False, default=True)
    created_at    = Column(DateTime, server_default=func.now())
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<DashboardUser {self.email} role={self.role}>"

# Made with Bob
