from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

from app.models.content_script import ScriptStatus


class ContentScriptBase(BaseModel):
    """Base schema for ContentScript with common fields"""
    topic: str = Field(..., min_length=1, max_length=500, description="Video topic")
    hook: str = Field(..., min_length=1, description="Attention-grabbing hook (3-5 seconds)")
    body: str = Field(..., min_length=1, description="Main content body (10-20 seconds)")
    cta: str = Field(..., min_length=1, max_length=200, description="Call to action (3-5 seconds)")
    script_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")


class ContentScriptCreate(ContentScriptBase):
    """Schema for creating a new content script"""
    status: Optional[ScriptStatus] = Field(default=ScriptStatus.DRAFT, description="Script status")


class ContentScriptUpdate(BaseModel):
    """Schema for updating an existing content script"""
    topic: Optional[str] = Field(None, min_length=1, max_length=500)
    hook: Optional[str] = Field(None, min_length=1)
    body: Optional[str] = Field(None, min_length=1)
    cta: Optional[str] = Field(None, min_length=1, max_length=200)
    status: Optional[ScriptStatus] = None
    script_metadata: Optional[Dict[str, Any]] = None


class ContentScriptResponse(ContentScriptBase):
    """Schema for content script responses"""
    id: str
    status: ScriptStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2 (was orm_mode in v1)


class ContentScriptListResponse(BaseModel):
    """Schema for paginated list of content scripts"""
    items: list[ContentScriptResponse]
    total: int
    page: int
    page_size: int
    pages: int

# Made with Bob
