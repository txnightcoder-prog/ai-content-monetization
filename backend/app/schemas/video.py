from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, HttpUrl

from app.models.video import VideoStatus


class VideoBase(BaseModel):
    """Base schema for Video with common fields"""
    heygen_video_id: Optional[str] = Field(None, description="HeyGen video ID")
    video_url: Optional[HttpUrl] = Field(None, description="URL to the generated video")
    thumbnail_url: Optional[HttpUrl] = Field(None, description="URL to video thumbnail")
    duration: Optional[int] = Field(None, ge=0, description="Video duration in seconds")


class VideoCreate(BaseModel):
    """Schema for creating a new video"""
    script_id: UUID = Field(..., description="ID of the content script to use")
    heygen_video_id: Optional[str] = None
    status: Optional[VideoStatus] = Field(default=VideoStatus.GENERATING)


class VideoUpdate(BaseModel):
    """Schema for updating an existing video"""
    heygen_video_id: Optional[str] = None
    video_url: Optional[HttpUrl] = None
    thumbnail_url: Optional[HttpUrl] = None
    duration: Optional[int] = Field(None, ge=0)
    status: Optional[VideoStatus] = None


class VideoResponse(VideoBase):
    """Schema for video responses"""
    id: UUID
    script_id: UUID
    status: VideoStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VideoListResponse(BaseModel):
    """Schema for paginated list of videos"""
    items: list[VideoResponse]
    total: int
    page: int
    page_size: int
    pages: int

# Made with Bob
