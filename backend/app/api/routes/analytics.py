"""
Analytics API Routes
====================
POST /api/v1/analytics/sync              — pull fresh stats from all registered platforms
GET  /api/v1/analytics/summary           — aggregated totals across all platforms
GET  /api/v1/analytics/platforms         — list of registered platform names
GET  /api/v1/analytics/platform/{name}   — stats for one specific platform
GET  /api/v1/analytics/top-posts         — top N posts ranked by views
POST /api/v1/analytics/channel-audit     — AI-powered YouTube channel health audit
POST /api/v1/analytics/improve-suggestions — AI tips for low-performing posts
GET  /api/v1/analytics/performance-monitor — combined revenue+engagement monitor data
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


# ── POST /improve-suggestions ─────────────────────────────────────────────────

class ImproveSuggestionsRequest(BaseModel):
    threshold_views: int  = 500   # posts with fewer views than this are "low performing"
    limit:           int  = 10    # max low-performing posts to analyse
    platform: Optional[str] = None


@router.post("/improve-suggestions")
async def improve_suggestions(
    request: ImproveSuggestionsRequest,
    db: Session = Depends(get_db),
):
    """
    **AI Improvement Coach.**

    Identifies low-performing posts (below `threshold_views`) and asks GPT-4
    to produce concrete, platform-specific improvement tactics for each one.

    Returns:
    - `low_performers`: the posts that triggered analysis
    - `suggestions`: one AI-generated improvement block per post
    - `general_tips`: 5 overarching recommendations based on the full dataset
    """
    import json as _json

    query = db.query(Analytics)
    if request.platform:
        query = query.filter(Analytics.platform == request.platform)

    low = (
        query
        .filter(Analytics.views < request.threshold_views)
        .order_by(Analytics.views.asc())
        .limit(request.limit)
        .all()
    )

    all_rows = db.query(Analytics).all()
    avg_views = (sum(r.views or 0 for r in all_rows) / len(all_rows)) if all_rows else 0

    low_dicts = [_row_to_dict(r) for r in low]

    # ── Build AI prompt ────────────────────────────────────────────────────────
    low_summary = "\n".join(
        f'  {i+1}. [{p["platform"]}] "{p["title"] or "(untitled)"}" — '
        f'{p["views"]} views, {p["likes"]} likes, {p["comments"]} comments'
        for i, p in enumerate(low_dicts)
    ) or "  (no low-performing posts)"

    prompt = f"""
You are an expert social-media growth strategist.

Average views across this creator's posts: {avg_views:.0f}

These posts are **underperforming** (below {request.threshold_views} views):
{low_summary}

For EACH underperforming post above, provide exactly 3 specific improvement tactics.
Then provide 5 general channel-wide improvements.

Respond in this exact JSON shape (no markdown, no extra text):
{{
  "per_post": [
    {{
      "title": "<post title>",
      "platform": "<platform>",
      "tactics": ["tactic 1", "tactic 2", "tactic 3"]
    }}
  ],
  "general_tips": ["tip 1", "tip 2", "tip 3", "tip 4", "tip 5"]
}}
"""

    suggestions: list = []
    general_tips: list = []

    try:
        from app.services.gemini_service import GeminiService
        import os as _os
        if _os.getenv("OPENAI_API_KEY"):
            from app.services.openai_service import OpenAIService
            _ai = OpenAIService()
        else:
            _ai = GeminiService()
        raw = await _ai.generate_completion(
            prompt=prompt,
            system_message=(
                "You are an expert viral content strategist. "
                "Return only valid JSON. No markdown fences."
            ),
            temperature=0.75,
            max_tokens=1200,
        )
        cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        parsed = _json.loads(cleaned)
        suggestions  = parsed.get("per_post", [])
        general_tips = parsed.get("general_tips", [])
    except Exception as exc:
        logger.warning("improve-suggestions AI call failed: %s", exc)
        general_tips = [
            "Post consistently — aim for at least 3 videos per week.",
            "Add a strong hook in the first 3 seconds.",
            "Use trending audio or sounds on TikTok and Reels.",
            "Engage with comments within the first hour of posting.",
            "A/B test thumbnail styles — face thumbnails typically get 30% more clicks.",
        ]

    return {
        "threshold_views": request.threshold_views,
        "avg_views":        round(avg_views, 1),
        "low_performer_count": len(low_dicts),
        "low_performers":  low_dicts,
        "suggestions":     suggestions,
        "general_tips":    general_tips,
    }


# ── GET /performance-monitor ───────────────────────────────────────────────────

@router.get("/performance-monitor")
def performance_monitor(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
) -> dict:
    """
    **Performance Monitor** — single endpoint that aggregates everything the
    custom dashboard needs:

    - Social engagement totals and per-platform breakdown
    - Revenue & conversion data for the chosen window
    - Video pipeline status counts
    - Affiliate revenue opportunities (static catalogue)
    - Low-performer count for the badge
    """
    from datetime import timedelta
    from app.models.conversion import Conversion
    from app.models.video import Video, VideoStatus
    from app.models.post import Post, PostStatus
    from sqlalchemy import func as _func

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # ── Social engagement ────────────────────────────────────────────────────
    rows = db.query(Analytics).all()
    total_views    = sum(r.views    or 0 for r in rows)
    total_likes    = sum(r.likes    or 0 for r in rows)
    total_comments = sum(r.comments or 0 for r in rows)
    total_shares   = sum(r.shares   or 0 for r in rows)
    total_clicks   = sum(r.clicks   or 0 for r in rows)
    avg_eng = round(
        (total_likes + total_comments) / total_views * 100, 2
    ) if total_views else 0.0

    by_platform: dict = {}
    for r in rows:
        p = r.platform or "unknown"
        if p not in by_platform:
            by_platform[p] = {"platform": p, "posts": 0, "views": 0, "likes": 0,
                               "comments": 0, "shares": 0, "engagement_rate": 0.0}
        by_platform[p]["posts"]    += 1
        by_platform[p]["views"]    += r.views    or 0
        by_platform[p]["likes"]    += r.likes    or 0
        by_platform[p]["comments"] += r.comments or 0
        by_platform[p]["shares"]   += r.shares   or 0

    for p_data in by_platform.values():
        if p_data["views"]:
            p_data["engagement_rate"] = round(
                (p_data["likes"] + p_data["comments"]) / p_data["views"] * 100, 2
            )

    # ── Revenue ──────────────────────────────────────────────────────────────
    revenue = float(
        db.query(_func.sum(Conversion.amount))
          .filter(Conversion.created_at >= cutoff)
          .scalar() or 0
    )
    conversions = db.query(Conversion).filter(Conversion.created_at >= cutoff).count()

    # ── Pipeline health ───────────────────────────────────────────────────────
    vid_by_status = {
        str(s): c for s, c in
        db.query(Video.status, _func.count(Video.id)).group_by(Video.status).all()
    }
    posts_published = db.query(Post).filter(Post.status == PostStatus.POSTED).count()

    # ── Low-performer count ───────────────────────────────────────────────────
    avg_views_val = total_views / len(rows) if rows else 0
    threshold = max(100, int(avg_views_val * 0.3))   # 30% of average
    low_performer_count = sum(1 for r in rows if (r.views or 0) < threshold)

    # ── Top 10 posts by views ─────────────────────────────────────────────────
    top_posts = sorted(rows, key=lambda r: r.views or 0, reverse=True)[:10]

    # ── Affiliate opportunities catalogue ────────────────────────────────────
    affiliates = [
        {
            "name":       "ElevenLabs",
            "category":   "AI Voice",
            "commission": "22% recurring",
            "est_monthly": "$50–800",
            "link":       "https://elevenlabs.io/affiliate",
            "why":        "Every video you make uses it — natural recommendation",
        },
        {
            "name":       "ClickBank AI Tools",
            "category":   "Marketplace",
            "commission": "50–75% per sale",
            "est_monthly": "$200–2000",
            "link":       "https://www.clickbank.com",
            "why":        "Thousands of high-commission AI/software offers",
        },
        {
            "name":       "PartnerStack (SaaS tools)",
            "category":   "B2B SaaS",
            "commission": "15–30% recurring",
            "est_monthly": "$100–1500",
            "link":       "https://partnerstack.com",
            "why":        "Recurring commissions from tools your audience uses",
        },
        {
            "name":       "Gumroad Creator Program",
            "category":   "Digital Products",
            "commission": "Sell your own products",
            "est_monthly": "$500–5000",
            "link":       "https://gumroad.com",
            "why":        "Sell blueprints, templates, courses directly",
        },
        {
            "name":       "Pexels / Storyblocks",
            "category":   "Stock Media",
            "commission": "$20–50 per signup",
            "est_monthly": "$50–400",
            "link":       "https://www.storyblocks.com/affiliate",
            "why":        "Creators always need stock footage",
        },
        {
            "name":       "Impact.com AI Niche",
            "category":   "Performance Network",
            "commission": "Varies by offer",
            "est_monthly": "$300–3000",
            "link":       "https://impact.com",
            "why":        "Huge AI/tech brand catalogue with tracked payouts",
        },
    ]

    return {
        "period_days":   days,
        "last_synced":   _last_synced(db),
        "social": {
            "total_posts":   len(rows),
            "total_views":   total_views,
            "total_likes":   total_likes,
            "total_comments":total_comments,
            "total_shares":  total_shares,
            "total_clicks":  total_clicks,
            "avg_engagement_rate": avg_eng,
            "by_platform":   list(by_platform.values()),
        },
        "revenue": {
            "total":       revenue,
            "conversions": conversions,
            "avg_order":   round(revenue / conversions, 2) if conversions else 0,
        },
        "pipeline": {
            "videos_by_status": vid_by_status,
            "posts_published":  posts_published,
        },
        "low_performer_count": low_performer_count,
        "top_posts": [_row_to_dict(r) for r in top_posts],
        "affiliates": affiliates,
    }


# ── GET /platform-status ──────────────────────────────────────────────────────

@router.get("/platform-status")
def platform_status() -> dict:
    """
    **Platform connection status.**

    Returns which platforms are configured (env vars present) and which
    are missing credentials — so the dashboard can show a clear setup checklist.

    Does NOT make any live API calls — purely checks env vars.
    """
    import os as _os

    def _check(keys: list[str]) -> bool:
        return all(bool(_os.getenv(k, "").strip()) for k in keys)

    platforms = [
        {
            "platform":    "tiktok",
            "label":       "TikTok",
            "connected":   _check(["TIKTOK_ACCESS_TOKEN"]),
            "auto_refresh": _check(["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN"]),
            "missing": [k for k in ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET",
                                    "TIKTOK_ACCESS_TOKEN", "TIKTOK_REFRESH_TOKEN"]
                        if not _os.getenv(k, "").strip()],
            "setup_url":   "https://developers.tiktok.com/apps",
            "scope_needed": "video.list",
            "notes":       "Access token expires every 24 h. Set all four vars for auto-refresh.",
        },
        {
            "platform":    "instagram",
            "label":       "Instagram (via Buffer)",
            "connected":   _check(["BUFFER_ACCESS_TOKEN", "BUFFER_INSTAGRAM_PROFILE_ID"]),
            "auto_refresh": True,   # Buffer handles token lifecycle
            "missing": [k for k in ["BUFFER_ACCESS_TOKEN", "BUFFER_INSTAGRAM_PROFILE_ID"]
                        if not _os.getenv(k, "").strip()],
            "setup_url":   "https://publish.buffer.com/settings/api",
            "scope_needed": "Buffer channel connected",
            "notes":       "Only shows posts scheduled through Buffer.",
        },
        {
            "platform":    "facebook",
            "label":       "Facebook (via Buffer)",
            "connected":   _check(["BUFFER_ACCESS_TOKEN", "BUFFER_FACEBOOK_PROFILE_ID"]),
            "auto_refresh": True,
            "missing": [k for k in ["BUFFER_ACCESS_TOKEN", "BUFFER_FACEBOOK_PROFILE_ID"]
                        if not _os.getenv(k, "").strip()],
            "setup_url":   "https://publish.buffer.com/settings/api",
            "scope_needed": "Buffer channel connected",
            "notes":       "Only shows posts scheduled through Buffer.",
        },
        {
            "platform":    "youtube",
            "label":       "YouTube (via Buffer)",
            "connected":   _check(["BUFFER_ACCESS_TOKEN", "BUFFER_YOUTUBE_PROFILE_ID"]),
            "auto_refresh": True,
            "missing": [k for k in ["BUFFER_ACCESS_TOKEN", "BUFFER_YOUTUBE_PROFILE_ID"]
                        if not _os.getenv(k, "").strip()],
            "setup_url":   "https://publish.buffer.com/settings/api",
            "scope_needed": "Buffer channel connected",
            "notes":       "Shows YouTube posts sent through Buffer.",
        },
    ]

    connected_count = sum(1 for p in platforms if p["connected"])
    return {
        "platforms":        platforms,
        "connected_count":  connected_count,
        "total":            len(platforms),
        "all_connected":    connected_count == len(platforms),
    }


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
        service = ChannelAuditService()
        return await service.audit(channel_input=request.channel, niche=request.niche)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Channel audit failed")
        raise HTTPException(status_code=500, detail=f"Channel audit failed: {exc}")
