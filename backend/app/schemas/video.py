from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.video import VideoStatus


class VideoBase(BaseModel):
    """Base schema for Video with common fields"""
    job_id: Optional[str] = Field(None, description="Video generation job ID")
    video_url: Optional[str] = Field(None, description="URL to the generated video")
    thumbnail_url: Optional[str] = Field(None, description="URL to video thumbnail")
    duration: Optional[int] = Field(None, ge=0, description="Video duration in seconds")

    class Config:
        populate_by_name = True


class VideoCreate(BaseModel):
    """Schema for creating a new video record (without triggering generation)."""
    script_id: UUID = Field(..., description="ID of the content script to use")
    status: Optional[VideoStatus] = Field(default=VideoStatus.GENERATING)


class GenerateVideoRequest(BaseModel):
    """
    Request body for POST /api/v1/videos/generate.
    Creates a Video record and immediately fires off local video generation in the background.
    """
    script_id: UUID = Field(..., description="ID of the approved content script to generate from")


class PublishVideoRequest(BaseModel):
    """
    Request body for POST /api/v1/videos/{video_id}/publish.
    Schedules the ready video on one or more social platforms via Buffer.
    """
    platforms: Optional[List[str]] = Field(
        None,
        description=(
            "Platforms to publish to: tiktok, instagram, facebook, youtube, twitter, linkedin. "
            "Omit to post to all configured Buffer profiles."
        ),
    )
    caption: Optional[str] = Field(
        None,
        description="Override caption. Defaults to hook + cta from the linked script.",
    )


class VideoUpdate(BaseModel):
    """Schema for updating an existing video"""
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = Field(None, ge=0)
    status: Optional[VideoStatus] = None


class VideoResponse(VideoBase):
    """Schema for video responses"""
    id: UUID
    script_id: Optional[UUID] = None   # None for manually-uploaded videos
    status: VideoStatus
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class VideoListResponse(BaseModel):
    """Schema for paginated list of videos"""
    items: list[VideoResponse]
    total: int
    page: int
    page_size: int
    pages: int

# Made with Bob
