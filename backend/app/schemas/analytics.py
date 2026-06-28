from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class AnalyticsBase(BaseModel):
    """Base schema for Analytics with common fields"""
    views: int = Field(default=0, ge=0, description="Number of views")
    likes: int = Field(default=0, ge=0, description="Number of likes")
    comments: int = Field(default=0, ge=0, description="Number of comments")
    shares: int = Field(default=0, ge=0, description="Number of shares")
    clicks: int = Field(default=0, ge=0, description="Number of clicks")


class AnalyticsCreate(AnalyticsBase):
    """Schema for creating new analytics record"""
    post_id: UUID = Field(..., description="ID of the post")
    video_id: UUID = Field(..., description="ID of the video")


class AnalyticsUpdate(BaseModel):
    """Schema for updating analytics"""
    views: Optional[int] = Field(None, ge=0)
    likes: Optional[int] = Field(None, ge=0)
    comments: Optional[int] = Field(None, ge=0)
    shares: Optional[int] = Field(None, ge=0)
    clicks: Optional[int] = Field(None, ge=0)


class AnalyticsResponse(AnalyticsBase):
    """Schema for analytics responses"""
    id: UUID
    post_id: UUID
    video_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnalyticsListResponse(BaseModel):
    """Schema for paginated list of analytics"""
    items: list[AnalyticsResponse]
    total: int
    page: int
    page_size: int
    pages: int


class AnalyticsSummary(BaseModel):
    """Schema for analytics summary/dashboard"""
    total_views: int
    total_likes: int
    total_comments: int
    total_shares: int
    total_clicks: int
    engagement_rate: float
    average_views_per_post: float
    best_performing_post_id: Optional[UUID]
    period_start: datetime
    period_end: datetime

# Made with Bob
