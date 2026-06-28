from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, HttpUrl

from app.models.post import Platform, PostStatus


class PostBase(BaseModel):
    """Base schema for Post with common fields"""
    platform: Platform = Field(..., description="Social media platform")
    post_url: Optional[HttpUrl] = Field(None, description="URL to the published post")
    scheduled_at: Optional[datetime] = Field(None, description="When the post is scheduled")


class PostCreate(BaseModel):
    """Schema for creating a new post"""
    video_id: UUID = Field(..., description="ID of the video to post")
    platform: Platform = Field(..., description="Target platform")
    scheduled_at: Optional[datetime] = Field(None, description="Schedule time (optional)")
    status: Optional[PostStatus] = Field(default=PostStatus.SCHEDULED)


class PostUpdate(BaseModel):
    """Schema for updating an existing post"""
    post_url: Optional[HttpUrl] = None
    scheduled_at: Optional[datetime] = None
    posted_at: Optional[datetime] = None
    status: Optional[PostStatus] = None


class PostResponse(PostBase):
    """Schema for post responses"""
    id: UUID
    video_id: UUID
    status: PostStatus
    posted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PostListResponse(BaseModel):
    """Schema for paginated list of posts"""
    items: list[PostResponse]
    total: int
    page: int
    page_size: int
    pages: int

# Made with Bob
