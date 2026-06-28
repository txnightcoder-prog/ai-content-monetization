from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.models.post import Post, Platform, PostStatus
from app.schemas.post import (
    PostCreate,
    PostUpdate,
    PostResponse,
    PostListResponse,
)

router = APIRouter(prefix="/api/v1/posts", tags=["posts"])


@router.post("/", response_model=PostResponse, status_code=201)
def create_post(
    post: PostCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new post (schedule a video for publishing).
    """
    try:
        db_post = Post(**post.model_dump())
        db.add(db_post)
        db.commit()
        db.refresh(db_post)
        return db_post
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create post: {str(e)}")


@router.get("/", response_model=PostListResponse)
def list_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[PostStatus] = Query(None, description="Filter by status"),
    platform: Optional[Platform] = Query(None, description="Filter by platform"),
    video_id: Optional[UUID] = Query(None, description="Filter by video ID"),
    db: Session = Depends(get_db)
):
    """
    List all posts with pagination and filtering.
    """
    query = db.query(Post)
    
    if status:
        query = query.filter(Post.status == status)
    if platform:
        query = query.filter(Post.platform == platform)
    if video_id:
        query = query.filter(Post.video_id == video_id)
    
    total = query.count()
    posts = query.offset(skip).limit(limit).all()
    
    return {
        "items": posts,
        "total": total,
        "page": skip // limit + 1,
        "page_size": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get a specific post by ID.
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.put("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: UUID,
    post_update: PostUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing post.
    """
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    update_data = post_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_post, field, value)
    
    try:
        db.commit()
        db.refresh(db_post)
        return db_post
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update post: {str(e)}")


@router.delete("/{post_id}", status_code=204)
def delete_post(
    post_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Delete a post.
    """
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    try:
        db.delete(db_post)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete post: {str(e)}")


@router.post("/{post_id}/mark-posted", response_model=PostResponse)
def mark_post_posted(
    post_id: UUID,
    post_url: str = Query(..., description="URL of the published post"),
    db: Session = Depends(get_db)
):
    """
    Mark a post as posted (successfully published).
    """
    from datetime import datetime, timezone

    db_post = db.query(Post).filter(Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")

    db_post.status = PostStatus.POSTED
    db_post.post_url = post_url
    db_post.posted_at = datetime.now(timezone.utc)
    
    try:
        db.commit()
        db.refresh(db_post)
        return db_post
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update post: {str(e)}")


@router.post("/{post_id}/mark-failed", response_model=PostResponse)
def mark_post_failed(
    post_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Mark a post as failed (publishing error).
    """
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    db_post.status = PostStatus.FAILED
    
    try:
        db.commit()
        db.refresh(db_post)
        return db_post
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update post: {str(e)}")

# Made with Bob
