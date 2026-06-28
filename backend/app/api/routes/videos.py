from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.models.video import Video, VideoStatus
from app.schemas.video import (
    VideoCreate,
    VideoUpdate,
    VideoResponse,
    VideoListResponse,
)

router = APIRouter(prefix="/api/v1/videos", tags=["videos"])


@router.post("/", response_model=VideoResponse, status_code=201)
def create_video(
    video: VideoCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new video record.
    
    This creates a video entry linked to a script. The actual video generation
    (via HeyGen) would be triggered separately.
    """
    try:
        db_video = Video(**video.model_dump())
        db.add(db_video)
        db.commit()
        db.refresh(db_video)
        return db_video
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create video: {str(e)}")


@router.get("/", response_model=VideoListResponse)
def list_videos(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(10, ge=1, le=100, description="Number of records to return"),
    status: Optional[VideoStatus] = Query(None, description="Filter by status"),
    script_id: Optional[UUID] = Query(None, description="Filter by script ID"),
    db: Session = Depends(get_db)
):
    """
    List all videos with pagination and optional filtering.
    """
    query = db.query(Video)
    
    if status:
        query = query.filter(Video.status == status)
    if script_id:
        query = query.filter(Video.script_id == script_id)
    
    total = query.count()
    videos = query.offset(skip).limit(limit).all()
    
    return {
        "items": videos,
        "total": total,
        "page": skip // limit + 1,
        "page_size": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(
    video_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get a specific video by ID.
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.put("/{video_id}", response_model=VideoResponse)
def update_video(
    video_id: UUID,
    video_update: VideoUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing video.
    
    Use this to update video URLs, status, duration, etc. after generation.
    """
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    update_data = video_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_video, field, value)
    
    try:
        db.commit()
        db.refresh(db_video)
        return db_video
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update video: {str(e)}")


@router.delete("/{video_id}", status_code=204)
def delete_video(
    video_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Delete a video.
    """
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    try:
        db.delete(db_video)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete video: {str(e)}")


@router.post("/{video_id}/mark-ready", response_model=VideoResponse)
def mark_video_ready(
    video_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Mark a video as ready (generation complete).
    """
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    db_video.status = VideoStatus.READY
    
    try:
        db.commit()
        db.refresh(db_video)
        return db_video
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update video status: {str(e)}")


@router.post("/{video_id}/mark-failed", response_model=VideoResponse)
def mark_video_failed(
    video_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Mark a video as failed (generation error).
    """
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    db_video.status = VideoStatus.FAILED
    
    try:
        db.commit()
        db.refresh(db_video)
        return db_video
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update video status: {str(e)}")

# Made with Bob
