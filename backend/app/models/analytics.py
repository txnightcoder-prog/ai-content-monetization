import uuid
from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Analytics(Base, TimestampMixin):
    """Model for tracking post analytics/metrics"""
    
    __tablename__ = "analytics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id"), nullable=False)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id"), nullable=False)
    views = Column(Integer, default=0, nullable=False)
    likes = Column(Integer, default=0, nullable=False)
    comments = Column(Integer, default=0, nullable=False)
    shares = Column(Integer, default=0, nullable=False)
    clicks = Column(Integer, default=0, nullable=False)
    
    # Relationships
    video = relationship("Video", back_populates="analytics")
    
    def __repr__(self):
        return f"<Analytics(id={self.id}, views={self.views}, likes={self.likes})>"

# Made with Bob
