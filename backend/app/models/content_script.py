import uuid
from sqlalchemy import Column, String, Text, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base, TimestampMixin


class ScriptStatus(str, enum.Enum):
    """Status of a content script"""
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"


class ContentScript(Base, TimestampMixin):
    """Model for AI-generated content scripts"""
    
    __tablename__ = "content_scripts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    topic = Column(Text, nullable=False)
    hook = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    cta = Column(Text, nullable=False)
    status = Column(SQLEnum(ScriptStatus), default=ScriptStatus.DRAFT, nullable=False)
    script_metadata = Column(JSON, default=dict)
    
    # Relationships
    videos = relationship("Video", back_populates="script", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<ContentScript(id={self.id}, topic={self.topic[:30]}..., status={self.status})>"

# Made with Bob
