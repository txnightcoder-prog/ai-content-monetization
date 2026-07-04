"""
Analytics API Routes
====================
POST /api/v1/analytics/sync              — pull fresh stats from all registered platforms
GET  /api/v1/analytics/summary           — aggregated totals across all platforms
GET  /api/v1/analytics/platforms         — list of registered platform names
GET  /api/v1/analytics/platform/{name}   — stats for one specific platform
GET  /api/v1/analytics/top-posts         — top N posts ranked by views
POST /api/v1/analytics/channel-audit     — AI-powered YouTube channel health audit
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from typing import Optional
import logging

from app.core.database import get_db
from app.models.analytics import Analytics
from app.models.post import Post
from app.services import social_analytics_service as svc
from app.services.channel_audit_service import ChannelAuditService
from app.services.openai_service import OpenAIService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


# ── POST /sync ─────────────────────────────────────────────────────────────────

@router.post("/sync")
def sync_analytics(
    platform: Optional[str] = Query(None, description="Sync a single platform only. Omit for all."),
    db: Session = Depends(get_db),
) -> dict:
    """
    Pull latest stats from all registered social platforms (or one specific platform)
    and upsert them into the analytics table.

    Returns a summary of how many records were created/updated per platform.
    """
    if platform:
        if platform not in svc.registered_platforms():
            raise HTTPException(
                status_code=404,
                detail=f"Platform '{platform}' not registered. "
                       f"Available: {svc.registered_platforms()}"
            )
        raw = {platform: svc.fetch_platform(platform)}
    else:
        raw = svc.fetch_all()

    summary = {}
    for plat, posts in raw.items():
        created = updated = 0
        for post in posts:
            # Upsert by (platform, external_id)
            existing = db.query(Analytics).filter(
                Analytics.platform == plat,
                Analytics.external_id == post["external_id"],
            ).first()

            if existing:
                existing.views    = post["views"]
                existing.likes    = post["likes"]
                existing.comments = post["comments"]
                existing.shares   = post["shares"]
                existing.clicks   = post["clicks"]
                existing.title    = post["title"]
                existing.updated_at = datetime.now(timezone.utc)
                updated += 1
            else:
                record = Analytics(
                    platform=plat,
                    external_id=post["external_id"],
                    title=post["title"],
                    views=post["views"],
                    likes=post["likes"],
                    comments=post["comments"],
                    shares=post["shares"],
                    clicks=post["clicks"],
                    posted_at=post["posted_at"],
                )
                db.add(record)
                created += 1

        db.commit()
        summary[plat] = {"created": created, "updated": updated, "total": created + updated}
        logger.info(f"Analytics sync [{plat}]: {created} created, {updated} updated")

    return {
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "platforms": summary,
        "total_records": sum(v["total"] for v in summary.values()),
    }


# ── GET /platforms ─────────────────────────────────────────────────────────────

@router.get("/platforms")
def list_platforms() -> dict:
    """List all platforms that have an analytics fetcher registered."""
    return {"platforms": svc.registered_platforms()}


# ── GET /summary ───────────────────────────────────────────────────────────────

@router.get("/summary")
def get_summary(
    platform: Optional[str] = Query(None, description="Filter to one platform"),
    days: int = Query(30, ge=1, le=365, description="Lookback window in days"),
    db: Session = Depends(get_db),
) -> dict:
    """
    Aggregated analytics totals. Optionally filter by platform or date range.
    """
    query = db.query(Analytics)
    if platform:
        query = query.filter(Analytics.platform == platform)

    rows = query.all()

    # Per-platform aggregation
    by_platform: dict[str, dict] = {}
    for row in rows:
        p = row.platform
        if p not in by_platform:
            by_platform[p] = {
                "platform": p,
                "posts": 0,
                "total_views": 0,
                "total_likes": 0,
                "total_comments": 0,
                "total_shares": 0,
                "total_clicks": 0,
            }
        by_platform[p]["posts"]          += 1
        by_platform[p]["total_views"]    += row.views    or 0
        by_platform[p]["total_likes"]    += row.likes    or 0
        by_platform[p]["total_comments"] += row.comments or 0
        by_platform[p]["total_shares"]   += row.shares   or 0
        by_platform[p]["total_clicks"]   += row.clicks   or 0

    # Overall totals
    totals = {
        "total_posts":    len(rows),
        "total_views":    sum(r.views    or 0 for r in rows),
        "total_likes":    sum(r.likes    or 0 for r in rows),
        "total_comments": sum(r.comments or 0 for r in rows),
        "total_shares":   sum(r.shares   or 0 for r in rows),
        "total_clicks":   sum(r.clicks   or 0 for r in rows),
    }
    if totals["total_views"] > 0:
        totals["avg_engagement_rate"] = round(
            (totals["total_likes"] + totals["total_comments"]) / totals["total_views"] * 100, 2
        )
    else:
        totals["avg_engagement_rate"] = 0.0

    return {
        "totals": totals,
        "by_platform": list(by_platform.values()),
        "last_synced": _last_synced(db),
    }


# ── GET /platform/{name} ───────────────────────────────────────────────────────

@router.get("/platform/{platform_name}")
def get_platform_analytics(
    platform_name: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    """
    All stored analytics records for a specific platform, newest first.
    Works for any platform — including ones added in the future.
    """
    rows = (
        db.query(Analytics)
        .filter(Analytics.platform == platform_name)
        .order_by(Analytics.views.desc())
        .limit(limit)
        .all()
    )

    if not rows and platform_name not in svc.registered_platforms():
        raise HTTPException(
            status_code=404,
            detail=f"Platform '{platform_name}' not found. "
                   f"Registered platforms: {svc.registered_platforms()}"
        )

    return {
        "platform": platform_name,
        "post_count": len(rows),
        "posts": [_row_to_dict(r) for r in rows],
    }


# ── GET /top-posts ─────────────────────────────────────────────────────────────

@router.get("/top-posts")
def get_top_posts(
    limit: int = Query(10, ge=1, le=50),
    metric: str = Query("views", description="Sort metric: views | likes | comments | shares | clicks"),
    platform: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> dict:
    """
    Top N posts across all platforms (or one platform) ranked by a chosen metric.
    """
    allowed = {"views", "likes", "comments", "shares", "clicks"}
    if metric not in allowed:
        raise HTTPException(status_code=400, detail=f"metric must be one of {allowed}")

    order_col = getattr(Analytics, metric)
    query = db.query(Analytics)
    if platform:
        query = query.filter(Analytics.platform == platform)

    rows = query.order_by(order_col.desc()).limit(limit).all()

    return {
        "metric": metric,
        "platform_filter": platform,
        "posts": [_row_to_dict(r) for r in rows],
    }


# ── helpers ────────────────────────────────────────────────────────────────────

def _row_to_dict(row: Analytics) -> dict:
    return {
        "id":          str(row.id),
        "platform":    row.platform,
        "external_id": row.external_id,
        "title":       row.title,
        "views":       row.views    or 0,
        "likes":       row.likes    or 0,
        "comments":    row.comments or 0,
        "shares":      row.shares   or 0,
        "clicks":      row.clicks   or 0,
        "posted_at":   row.posted_at.isoformat() if row.posted_at else None,
        "synced_at":   row.updated_at.isoformat() if row.updated_at else None,
    }


def _last_synced(db: Session) -> Optional[str]:
    latest = db.query(func.max(Analytics.updated_at)).scalar()
    return latest.isoformat() if latest else None


# ── POST /channel-audit ────────────────────────────────────────────────────────

class ChannelAuditRequest(BaseModel):
    channel: str       # channel ID (UC...), handle (@name), or full YouTube URL
    niche: str = "AI tools"


@router.post("/channel-audit")
async def channel_audit(request: ChannelAuditRequest):
    """
    **AI-powered YouTube Channel Audit.**

    Analyses a YouTube channel and returns:
    - Overall score and grade (A-F)
    - Scores across 6 dimensions (consistency, SEO, engagement, content quality, niche focus, growth)
    - Top strengths and prioritised improvement actions
    - Recommended next 5 videos with target keywords
    - Monetization readiness assessment

    Requires YOUTUBE_DATA_API_KEY env var.
    """
    try:
        service = ChannelAuditService(OpenAIService())
        return await service.audit(channel_input=request.channel, niche=request.niche)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Channel audit failed")
        raise HTTPException(status_code=500, detail=f"Channel audit failed: {exc}")
