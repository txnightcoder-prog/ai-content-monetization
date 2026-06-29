import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base, TimestampMixin


class Platform(str, enum.Enum):
    """Social media platforms"""
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"


class PostStatus(str, enum.Enum):
    """Status of a post"""
    SCHEDULED = "scheduled"
    POSTED = "posted"
    FAILED = "failed"


class Post(Base, TimestampMixin):
    """Model for social media posts"""
    
    __tablename__ = "posts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id"), nullable=False)
    platform = Column(SQLEnum(Platform), nullable=False)
    post_url = Column(String(500), nullable=True)
    scheduled_at = Column(DateTime, nullable=True)
    posted_at = Column(DateTime, nullable=True)
    status = Column(SQLEnum(PostStatus), default=PostStatus.SCHEDULED, nullable=False)
    
    # Relationships
    video = relationship("Video", back_populates="posts")
    
    def __repr__(self):
        return f"<Post(id={self.id}, platform={self.platform}, status={self.status})>"

# Made with Bob
