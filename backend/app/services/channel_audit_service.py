"""
Channel Audit Service — AI-powered YouTube channel health analysis.

Uses:
1. YouTube Data API v3 — channels.list + search.list to get real channel stats.
2. OpenAI — scores the channel and generates actionable recommendations.

Returns a scored audit report with grades across 6 dimensions:
  consistency, seo, engagement, content_quality, niche_focus, growth_rate
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

from app.services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

_YT_API_BASE = "https://www.googleapis.com/youtube/v3"


async def _fetch_channel_stats(channel_input: str, api_key: str) -> Dict[str, Any]:
    """
    Fetch channel statistics from YouTube Data API.
    channel_input can be a channel ID (UC...), handle (@name), or channel URL.
    """
    # Extract channel identifier
    if "youtube.com/" in channel_input:
        # Parse URL — handle /channel/ID, /@handle, /c/name formats
        import re
        m = re.search(r"youtube\.com/(?:channel/|@|c/)([\w@-]+)", channel_input)
        channel_input = m.group(1) if m else channel_input.split("/")[-1]

    # Try as channel ID first (starts with UC)
    params: Dict[str, Any] = {
        "part": "snippet,statistics,contentDetails,brandingSettings",
        "key": api_key,
    }
    if channel_input.startswith("UC"):
        params["id"] = channel_input
    else:
        # Try as handle/forUsername
        handle = channel_input.lstrip("@")
        params["forHandle"] = f"@{handle}" if not handle.startswith("@") else handle

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{_YT_API_BASE}/channels", params=params)
        r.raise_for_status()
        data = r.json()

    items = data.get("items", [])
    if not items:
        raise ValueError(
            f"Channel '{channel_input}' not found. "
            "Try using the channel ID (starts with UC) from the YouTube URL."
        )

    item = items[0]
    snippet = item.get("snippet", {})
    stats   = item.get("statistics", {})

    return {
        "channel_id":    item.get("id", ""),
        "title":         snippet.get("title", ""),
        "description":   (snippet.get("description", "") or "")[:500],
        "country":       snippet.get("country", ""),
        "created_at":    snippet.get("publishedAt", ""),
        "subscribers":   stats.get("subscriberCount", "0"),
        "total_views":   stats.get("viewCount", "0"),
        "video_count":   stats.get("videoCount", "0"),
        "hidden_subs":   stats.get("hiddenSubscriberCount", False),
    }


async def _fetch_recent_videos(channel_id: str, api_key: str, count: int = 10) -> List[Dict]:
    """Fetch the most recent videos from a channel for content analysis."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Search for recent uploads
            r = await client.get(
                f"{_YT_API_BASE}/search",
                params={
                    "part": "snippet",
                    "channelId": channel_id,
                    "order": "date",
                    "type": "video",
                    "maxResults": count,
                    "key": api_key,
                },
            )
            r.raise_for_status()
            items = r.json().get("items", [])

        video_ids = [i["id"]["videoId"] for i in items if "videoId" in i.get("id", {})]
        if not video_ids:
            return []

        # Get stats for those videos
        r2 = await (httpx.AsyncClient(timeout=15.0)).__aenter__()
        try:
            resp = await r2.get(
                f"{_YT_API_BASE}/videos",
                params={
                    "part": "snippet,statistics",
                    "id": ",".join(video_ids),
                    "key": api_key,
                },
            )
            resp.raise_for_status()
            videos = resp.json().get("items", [])
        finally:
            await r2.__aexit__(None, None, None)

        return [
            {
                "title":    v.get("snippet", {}).get("title", ""),
                "views":    int(v.get("statistics", {}).get("viewCount", 0) or 0),
                "likes":    int(v.get("statistics", {}).get("likeCount", 0) or 0),
                "comments": int(v.get("statistics", {}).get("commentCount", 0) or 0),
                "published": v.get("snippet", {}).get("publishedAt", ""),
            }
            for v in videos
        ]
    except Exception as exc:
        logger.warning("Could not fetch recent videos for %s: %s", channel_id, exc)
        return []


class ChannelAuditService:

    def __init__(self, openai_service: OpenAIService):
        self.openai = openai_service
        self._yt_key = os.getenv("YOUTUBE_DATA_API_KEY")

    async def audit(
        self,
        channel_input: str,
        niche: str = "AI tools",
    ) -> Dict[str, Any]:
        """
        Run a full channel audit.

        Args:
            channel_input: Channel ID (UC...), handle (@name), or channel URL.
            niche:         Expected content niche for focused recommendations.

        Returns a scored audit report.
        """
        if not self._yt_key:
            raise ValueError(
                "YOUTUBE_DATA_API_KEY is required for channel audits. "
                "Set it in Azure environment variables."
            )

        # 1. Fetch channel stats
        channel = await _fetch_channel_stats(channel_input, self._yt_key)
        recent  = await _fetch_recent_videos(channel["channel_id"], self._yt_key)

        # 2. Build context block for OpenAI
        recent_block = ""
        if recent:
            top    = sorted(recent, key=lambda v: v["views"], reverse=True)[:5]
            bottom = sorted(recent, key=lambda v: v["views"])[:3]
            recent_block = (
                f"\nRecent videos (newest first): "
                + ", ".join(f'"{v["title"]}" ({v["views"]:,} views)' for v in recent[:8])
                + f"\nTop performers: " + ", ".join(f'"{v["title"]}"' for v in top)
                + f"\nUnderperformers: " + ", ".join(f'"{v["title"]}"' for v in bottom)
            )

        subs   = int(channel["subscribers"] or 0)
        views  = int(channel["total_views"] or 0)
        videos = int(channel["video_count"] or 0)
        avg_views = round(views / max(videos, 1))

        prompt = f"""
You are an expert YouTube channel coach analyzing a creator's channel.

CHANNEL DATA:
- Name: {channel["title"]}
- Subscribers: {subs:,}
- Total views: {views:,}
- Videos: {videos}
- Average views per video: {avg_views:,}
- Channel description: {channel["description"] or "(none)"}
- Expected niche: {niche}
{recent_block}

Provide a comprehensive channel audit. Return ONLY valid JSON (no markdown):
{{
  "overall_score": 7.5,
  "grade": "B+",
  "summary": "2-3 sentence overall assessment",
  "scores": {{
    "consistency": {{"score": 8, "label": "Good", "detail": "Posting frequency assessment"}},
    "seo": {{"score": 6, "label": "Needs Work", "detail": "Title/description/tag assessment"}},
    "engagement": {{"score": 7, "label": "Good", "detail": "Likes/comments ratio vs views"}},
    "content_quality": {{"score": 8, "label": "Strong", "detail": "Topic relevance and depth"}},
    "niche_focus": {{"score": 5, "label": "Scattered", "detail": "How focused the channel is"}},
    "growth_rate": {{"score": 6, "label": "Steady", "detail": "Subscriber/view trajectory"}}
  }},
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": [
    {{"priority": "High", "action": "Specific actionable improvement", "impact": "Expected result"}},
    {{"priority": "High", "action": "...", "impact": "..."}},
    {{"priority": "Medium", "action": "...", "impact": "..."}},
    {{"priority": "Medium", "action": "...", "impact": "..."}},
    {{"priority": "Low", "action": "...", "impact": "..."}}
  ],
  "next_5_videos": [
    {{"title": "Recommended video title", "why": "Why this will perform well", "keyword": "Target keyword"}}
  ],
  "monetization_readiness": {{
    "adsense_eligible": true,
    "estimated_monthly_revenue": "$X-Y",
    "recommendation": "What to focus on for monetization"
  }}
}}
"""
        raw = await self.openai.generate_completion(
            prompt=prompt,
            system_message=(
                "You are an expert YouTube channel growth coach. "
                "Give honest, specific, actionable feedback. Return valid JSON only."
            ),
            temperature=0.65,
            max_tokens=2500,
        )

        cleaned = raw.strip()
        for fence in ("```json", "```"):
            if cleaned.startswith(fence):
                cleaned = cleaned[len(fence):]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        try:
            audit = json.loads(cleaned.strip())
        except json.JSONDecodeError:
            logger.warning("ChannelAuditService: JSON parse failed")
            audit = {
                "overall_score": 5.0,
                "grade": "C",
                "summary": "Audit completed but response could not be parsed.",
                "scores": {},
                "strengths": [],
                "improvements": [],
                "next_5_videos": [],
                "monetization_readiness": {},
            }

        # Attach raw channel stats to response
        audit["channel"] = {
            "title":       channel["title"],
            "subscribers": subs,
            "total_views": views,
            "video_count": videos,
            "avg_views":   avg_views,
            "channel_id":  channel["channel_id"],
        }
        return audit

# Made with Bob
