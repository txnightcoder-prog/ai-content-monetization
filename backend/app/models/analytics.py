import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Analytics(Base, TimestampMixin):
    """Model for tracking post analytics/metrics from social platforms"""

    __tablename__ = "analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Social platform fields (populated by analytics sync)
    platform    = Column(String(50),  nullable=True, index=True)   # "instagram" | "youtube" | ...
    external_id = Column(String(255), nullable=True, index=True)   # platform-native post ID
    title       = Column(String(255), nullable=True)               # post caption/title snippet
    posted_at   = Column(DateTime,    nullable=True)               # when posted on the platform

    # Optional FK back to internal post/video (nullable — synced posts may not match)
    post_id  = Column(UUID(as_uuid=True), ForeignKey("posts.id"),  nullable=True)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id"), nullable=True)

    # Engagement counters
    views    = Column(Integer, default=0, nullable=False)
    likes    = Column(Integer, default=0, nullable=False)
    comments = Column(Integer, default=0, nullable=False)
    shares   = Column(Integer, default=0, nullable=False)
    clicks   = Column(Integer, default=0, nullable=False)

    # Relationships
    video = relationship("Video", back_populates="analytics")

    def __repr__(self):
        return f"<Analytics(platform={self.platform}, external_id={self.external_id}, views={self.views})>"

# Made with Bob
