import uuid
from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Lead(Base, TimestampMixin):
    """Model for captured leads"""
    
    __tablename__ = "leads"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    source = Column(String(255), nullable=True)  # Where the lead came from
    beehiiv_subscriber_id = Column(String(255), nullable=True)
    tags = Column(Text, default="")  # Store as comma-separated string
    
    # Relationships
    conversions = relationship("Conversion", back_populates="lead", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Lead(id={self.id}, email={self.email}, source={self.source})>"

# Made with Bob
