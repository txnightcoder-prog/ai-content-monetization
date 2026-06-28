from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr


class LeadBase(BaseModel):
    """Base schema for Lead with common fields"""
    email: EmailStr = Field(..., description="Lead email address")
    name: Optional[str] = Field(None, max_length=255, description="Lead name")
    source: Optional[str] = Field(None, max_length=255, description="Lead source (e.g., 'tiktok', 'instagram')")
    tags: list[str] = Field(default_factory=list, description="Tags for segmentation")


class LeadCreate(LeadBase):
    """Schema for creating a new lead"""
    beehiiv_subscriber_id: Optional[str] = Field(None, description="Beehiiv subscriber ID")


class LeadUpdate(BaseModel):
    """Schema for updating an existing lead"""
    name: Optional[str] = Field(None, max_length=255)
    source: Optional[str] = Field(None, max_length=255)
    beehiiv_subscriber_id: Optional[str] = None
    tags: Optional[list[str]] = None


class LeadResponse(LeadBase):
    """Schema for lead responses"""
    id: UUID
    beehiiv_subscriber_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeadListResponse(BaseModel):
    """Schema for paginated list of leads"""
    items: list[LeadResponse]
    total: int
    page: int
    page_size: int
    pages: int

# Made with Bob
