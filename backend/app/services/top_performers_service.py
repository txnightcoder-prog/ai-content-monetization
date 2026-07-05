"""
Top Performers Service — AI Feedback Loop
==========================================
Reads the analytics table to find which video topics perform best,
then feeds those insights back into idea and script generation so the
AI produces more content similar to what's already working.

Endpoints (added to scripts router):
  POST /api/v1/scripts/generate-from-top-performers
    → queries top N analytics rows, extracts topics, generates new ideas
       biased toward the winning subjects, returns a list of topic strings

  GET  /api/v1/scripts/top-performers
    → returns the raw top-performing analytics records (for the frontend
       to display before generating)

Design:
  - No new dependencies — uses the existing Analytics model + OpenAIService
  - Metric used for ranking: weighted score = views + (likes * 10) + (comments * 5)
    (likes and comments signal intent more strongly than passive views)
  - Works with zero analytics data — returns normal ideas if the table is empty
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.models.analytics import Analytics
from app.services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

# How many top records to pull for the feedback prompt
_TOP_N = 10


def _engagement_score(a: Analytics) -> int:
    """Weighted engagement score used for ranking."""
    return (a.views or 0) + (a.likes or 0) * 10 + (a.comments or 0) * 5


def get_top_performers(db: Session, limit: int = _TOP_N) -> List[Dict[str, Any]]:
    """
    Query the analytics table and return the top ``limit`` records
    ranked by weighted engagement score.

    Returns a list of dicts safe to serialise as JSON.
    """
    rows = db.query(Analytics).all()
    if not rows:
        return []

    ranked = sorted(rows, key=_engagement_score, reverse=True)[:limit]

    return [
        {
            "title":          r.title or "",
            "platform":       r.platform or "",
            "views":          r.views,
            "likes":          r.likes,
            "comments":       r.comments,
            "shares":         r.shares,
            "engagement_score": _engagement_score(r),
            "posted_at":      r.posted_at.isoformat() if r.posted_at else None,
        }
        for r in ranked
    ]


async def generate_ideas_from_top_performers(
    db: Session,
    openai: OpenAIService,
    niche: str = "AI tools",
    count: int = 10,
) -> Dict[str, Any]:
    """
    Pull top-performing analytics records, inject them into the idea-generation
    prompt, and return a list of topic ideas biased toward what's working.

    If there is no analytics data yet, falls back to standard idea generation
    with a notice so the caller knows why.
    """
    top = get_top_performers(db, limit=_TOP_N)

    if not top:
        # No performance data yet — standard generation with a note
        logger.info("TopPerformers: no analytics data, falling back to standard generation")
        from app.services.script_generator import ScriptGenerator  # noqa: PLC0415
        generator = ScriptGenerator(openai)
        ideas = await generator.generate_topic_ideas(niche=niche, count=count)
        return {
            "ideas":          ideas,
            "top_performers": [],
            "data_available": False,
            "note": (
                "No analytics data yet. Sync your social analytics first to enable "
                "performance-based idea generation."
            ),
        }

    # Build a concise summary of what's working
    top_titles = [t["title"] for t in top if t["title"]][:8]
    top_summary = "\n".join(
        f"  • \"{t['title']}\" — {t['views']:,} views, {t['likes']} likes "
        f"(score {t['engagement_score']:,})"
        for t in top[:6]
    )

    prompt = f"""
You are an expert content strategist for the "{niche}" niche.

These videos performed BEST on this channel (ranked by views + likes + comments):
{top_summary}

Analyse what makes these top performers successful — their topic angle, emotional hook,
specificity, or format — then generate {count} NEW video topic ideas that:
1. Build on the same proven patterns and themes
2. Cover adjacent subjects the audience clearly cares about
3. Are fresh (do NOT repeat the exact titles above)
4. Are specific, curiosity-driven, and optimised for short-form video (30–60 sec)

Return ONLY a JSON array of {count} topic strings, nothing else.
Example: ["Topic 1", "Topic 2"]
"""

    import json  # noqa: PLC0415
    raw = await openai.generate_completion(
        prompt=prompt,
        system_message=(
            "You are an expert viral video content strategist. "
            "Return only valid JSON."
        ),
        temperature=0.85,
        max_tokens=400,
    )

    ideas: List[str] = []
    try:
        cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            ideas = [str(i) for i in parsed][:count]
    except (json.JSONDecodeError, TypeError):
        # Fallback: split by newlines
        ideas = [
            line.strip().strip('"').strip("'").strip("-").strip()
            for line in raw.splitlines()
            if line.strip() and not line.strip().startswith("[")
        ][:count]

    logger.info(
        "TopPerformers: generated %d ideas from %d top performers", len(ideas), len(top)
    )

    return {
        "ideas":          ideas,
        "top_performers": top[:6],
        "data_available": True,
        "note":           f"Generated from your top {len(top)} performing videos.",
    }

# Made with Bob
