from sqlalchemy import Column, String, Boolean, JSON, DateTime, Enum as SQLEnum
from sqlalchemy.sql import func
from app.models.base import Base
import enum
import uuid


class IntegrationType(str, enum.Enum):
    """Types of integrations"""
    # Video Generation
    HEYGEN = "heygen"
    SYNTHESIA = "synthesia"
    
    # Social Media
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"
    FACEBOOK = "facebook"
    TWITTER = "twitter"
    
    # Automation/Scheduling
    BUFFER = "buffer"
    HOOTSUITE = "hootsuite"
    N8N = "n8n"
    ZAPIER = "zapier"
    
    # AI Services
    OPENAI = "openai"
    ELEVENLABS = "elevenlabs"  # For voice generation
    
    # Analytics
    GOOGLE_ANALYTICS = "google_analytics"


class Integration(Base):
    """Store API credentials and configuration for external services"""
    __tablename__ = "integrations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)  # User-friendly name
    type = Column(SQLEnum(IntegrationType), nullable=False)
    
    # Credentials (encrypted in production)
    api_key = Column(String, nullable=True)
    api_secret = Column(String, nullable=True)
    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    
    # Additional configuration
    config = Column(JSON, default={})  # Store extra settings like webhook URLs, account IDs, etc.
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)  # Whether credentials have been tested
    last_verified_at = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Integration {self.name} ({self.type})>"

# Made with Bob
