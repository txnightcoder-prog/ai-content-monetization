import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base, TimestampMixin


class VideoStatus(str, enum.Enum):
    """Status of a video"""
    GENERATING = "generating"
    READY = "ready"
    POSTED = "posted"
    FAILED = "failed"


class Video(Base, TimestampMixin):
    """Model for generated videos"""
    
    __tablename__ = "videos"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    script_id = Column(UUID(as_uuid=True), ForeignKey("content_scripts.id"), nullable=True)
    heygen_video_id = Column(String(255), nullable=True)
    video_url = Column(String(500), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    duration = Column(Integer, nullable=True)  # Duration in seconds
    status = Column(SQLEnum(VideoStatus), default=VideoStatus.GENERATING, nullable=False)
    error_message = Column(String(1000), nullable=True)  # Human-readable failure reason
    
    # Relationships
    script = relationship("ContentScript", back_populates="videos")
    posts = relationship("Post", back_populates="video", cascade="all, delete-orphan")
    analytics = relationship("Analytics", back_populates="video", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Video(id={self.id}, status={self.status}, script_id={self.script_id})>"

# Made with Bob
