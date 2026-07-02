import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.video import Video, VideoStatus
from app.models.post import Post, Platform, PostStatus
from app.schemas.video import (
    GenerateVideoRequest,
    PublishVideoRequest,
    VideoCreate,
    VideoUpdate,
    VideoResponse,
    VideoListResponse,
)
from app.schemas.post import PostResponse
from app.services.video_pipeline import VideoPipelineService, get_pipeline


class ScheduleVideoRequest(BaseModel):
    platforms: List[str]
    scheduled_at: datetime          # ISO-8601 e.g. "2026-07-04T09:00:00Z"
    caption: Optional[str] = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/videos", tags=["videos"])


# ---------------------------------------------------------------------------
# Pipeline endpoints
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=VideoResponse, status_code=202)
async def generate_video(
    request: GenerateVideoRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    pipeline: VideoPipelineService = Depends(get_pipeline),
):
    """
    **Full pipeline endpoint.**

    1. Creates a Video DB record in status `generating`.
    2. Fires off local video generation (ElevenLabs + Pexels + FFmpeg) as a background task.
    3. When generation completes, the video row is updated to `ready` with the video path.

    Poll `GET /api/v1/videos/{video_id}` to track progress.
    Once `status == ready`, call `POST /api/v1/videos/{video_id}/publish`.
    """
    # Verify the script exists before creating the video row
    from app.models.content_script import ContentScript
    script = db.query(ContentScript).filter(
        ContentScript.id == request.script_id
    ).first()
    if not script:
        raise HTTPException(status_code=404, detail=f"Script {request.script_id} not found")

    # Create the DB record
    db_video = Video(script_id=request.script_id, status=VideoStatus.GENERATING)
    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    # Kick off generation in the background so the response is instant
    background_tasks.add_task(pipeline.generate, db_video.id)
    logger.info("Queued local video generation for video %s (script %s)", db_video.id, request.script_id)

    return db_video


@router.post("/{video_id}/publish", response_model=list[PostResponse], status_code=201)
async def publish_video(
    video_id: UUID,
    request: PublishVideoRequest,
    db: Session = Depends(get_db),
    pipeline: VideoPipelineService = Depends(get_pipeline),
):
    """
    **Distribute a ready video via Buffer.**

    Schedules the video on the requested social platforms.
    Returns a list of Post records (one per platform).

    The video must be in `ready` status (generation complete).
    """
    try:
        posts = await pipeline.publish(
            video_id=video_id,
            platforms=request.platforms,
            caption=request.caption,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return posts


# ---------------------------------------------------------------------------
# Standard CRUD endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=VideoResponse, status_code=201)
def create_video(
    video: VideoCreate,
    db: Session = Depends(get_db),
):
    """
    Create a bare video record without triggering generation.
    Use `POST /generate` to create *and* generate in one step.
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
    db: Session = Depends(get_db),
):
    """List all videos with pagination and optional filtering."""
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
        "pages": (total + limit - 1) // limit,
    }


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(
    video_id: UUID,
    db: Session = Depends(get_db),
):
    """Get a specific video by ID."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.put("/{video_id}", response_model=VideoResponse)
def update_video(
    video_id: UUID,
    video_update: VideoUpdate,
    db: Session = Depends(get_db),
):
    """Update video metadata (URL, status, duration, etc.)."""
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
    db: Session = Depends(get_db),
):
    """Delete a video."""
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
    db: Session = Depends(get_db),
):
    """Manually mark a video as ready (useful for externally-generated videos)."""
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
    db: Session = Depends(get_db),
):
    """Manually mark a video as failed."""
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

@router.post("/{video_id}/schedule", response_model=list[PostResponse], status_code=201)
async def schedule_video(
    video_id: UUID,
    request: ScheduleVideoRequest,
    db: Session = Depends(get_db),
):
    """
    Record a scheduled YouTube upload.
    Stores the scheduled_at time in the DB; the actual upload fires when
    you call POST /{video_id}/publish (or a future cron job).
    """
    from app.models.content_script import ContentScript

    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.status != VideoStatus.READY:
        raise HTTPException(
            status_code=400,
            detail=f"Video must be READY before scheduling (current status: {video.status})"
        )
    if not video.video_url:
        raise HTTPException(status_code=400, detail="Video has no URL yet")

    caption = request.caption
    if not caption:
        script = db.query(ContentScript).filter(ContentScript.id == video.script_id).first()
        if script:
            caption = f"{script.hook} {script.cta}".strip()

    created: List[Post] = []
    for platform_name in request.platforms:
        try:
            platform_enum = Platform(platform_name)
        except ValueError:
            continue
        post = Post(
            video_id=video_id,
            platform=platform_enum,
            scheduled_at=request.scheduled_at,
            status=PostStatus.SCHEDULED,
        )
        db.add(post)
        created.append(post)

    db.commit()
    for p in created:
        db.refresh(p)
    return created


# Made with Bob
