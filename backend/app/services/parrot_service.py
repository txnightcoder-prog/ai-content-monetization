"""
Parrot Service — analyse a YouTube video and generate a Blueprint in your niche.

How it works:
1. Extract the video ID from any YouTube URL format.
2. Fetch title, description, tags, category and view/like counts via the
   YouTube Data API v3 (public data, no OAuth needed).
   Falls back to OpenAI-only mode if YOUTUBE_DATA_API_KEY is not set.
3. Feed that metadata into OpenAI and ask it to generate a full Blueprint
   that matches the video's *structure and style* but uses your niche/topic.
"""

import json
import logging
import os
import re
from typing import Any, Dict, Optional

import httpx

from app.services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

_YT_API_BASE = "https://www.googleapis.com/youtube/v3"


def _extract_video_id(url: str) -> str:
    """Pull the 11-char video ID out of any YouTube URL format."""
    patterns = [
        r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})",
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    raise ValueError(f"Could not extract a YouTube video ID from: {url!r}")


async def _fetch_yt_metadata(video_id: str, api_key: str) -> Dict[str, Any]:
    """Fetch public video metadata from YouTube Data API v3."""
    params = {
        "part": "snippet,statistics,contentDetails",
        "id": video_id,
        "key": api_key,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{_YT_API_BASE}/videos", params=params)
        resp.raise_for_status()
        data = resp.json()

    items = data.get("items", [])
    if not items:
        raise ValueError(f"YouTube returned no data for video ID {video_id!r}. "
                         "The video may be private or deleted.")
    item = items[0]
    snippet = item.get("snippet", {})
    stats   = item.get("statistics", {})
    content = item.get("contentDetails", {})

    return {
        "video_id":    video_id,
        "title":       snippet.get("title", ""),
        "description": (snippet.get("description", "") or "")[:1000],
        "tags":        snippet.get("tags", [])[:20],
        "category_id": snippet.get("categoryId", ""),
        "duration":    content.get("duration", ""),      # ISO 8601 e.g. PT3M42S
        "views":       stats.get("viewCount", "unknown"),
        "likes":       stats.get("likeCount", "unknown"),
        "channel":     snippet.get("channelTitle", ""),
    }


class ParrotService:
    """
    Analyse a YouTube video and produce a Blueprint that mirrors its
    structure / style but targets your own niche and topic.
    """

    def __init__(self, openai_service: OpenAIService):
        self.openai = openai_service
        self._yt_api_key = os.getenv("YOUTUBE_DATA_API_KEY")

    async def parrot(
        self,
        youtube_url: str,
        niche: str = "AI tools",
        your_topic: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyse a YouTube video and generate a Blueprint.

        Args:
            youtube_url:  Any valid YouTube URL.
            niche:        Your content niche (used for the generated Blueprint).
            your_topic:   Optional override topic. If omitted, OpenAI picks a
                          fitting topic within the niche based on the source video.

        Returns:
            {
              "source_video": { title, views, likes, channel, url },
              "blueprint":    { ... same shape as /scripts/blueprint ... }
            }
        """
        video_id = _extract_video_id(youtube_url)

        # ── 1. Get source video metadata ─────────────────────────────────────
        if self._yt_api_key:
            logger.info("Parrot: fetching YouTube metadata for %s", video_id)
            try:
                meta = await _fetch_yt_metadata(video_id, self._yt_api_key)
            except Exception as exc:
                logger.warning("Parrot: YouTube API failed (%s) — using URL only", exc)
                meta = {"video_id": video_id, "title": "", "description": "",
                        "tags": [], "views": "unknown", "likes": "unknown",
                        "channel": "", "duration": ""}
        else:
            logger.info("Parrot: no YOUTUBE_DATA_API_KEY — AI will infer from URL")
            meta = {"video_id": video_id, "title": "", "description": "",
                    "tags": [], "views": "unknown", "likes": "unknown",
                    "channel": "", "duration": ""}

        yt_url = f"https://www.youtube.com/watch?v={video_id}"

        # ── 2. Ask OpenAI to analyse + generate Blueprint ────────────────────
        topic_instruction = (
            f"The creator's target topic is: {your_topic}"
            if your_topic
            else f"Choose a high-CPM topic that fits the '{niche}' niche and mirrors the source video's theme."
        )

        meta_block = (
            f"Title: {meta['title'] or '(not available)'}\n"
            f"Channel: {meta['channel'] or '(not available)'}\n"
            f"Views: {meta['views']}  |  Likes: {meta['likes']}\n"
            f"Duration: {meta['duration'] or '(not available)'}\n"
            f"Description (first 1000 chars): {meta['description'] or '(not available)'}\n"
            f"Tags: {', '.join(meta['tags']) or '(none)'}\n"
            f"URL: {yt_url}"
        )

        prompt = f"""
You are a viral content strategist. Analyse the following YouTube video and then
create a complete Video Blueprint for a creator in the "{niche}" niche.

=== SOURCE VIDEO ===
{meta_block}

=== YOUR TASK ===
1. Identify what makes this video successful:
   - Hook style (question / shock / story / number)
   - Content structure (how many sections, transitions)
   - Tone (educational / entertaining / motivational)
   - Thumbnail / title strategy
   - CTA approach

2. {topic_instruction}

3. Generate a Blueprint that MIRRORS THE STRUCTURE AND STYLE of the source
   video but uses YOUR OWN original topic, niche, and wording (no copying).

Return ONLY valid JSON (no markdown fences) with this exact shape:
{{
  "source_analysis": {{
    "hook_style": "...",
    "structure": "...",
    "tone": "...",
    "why_it_works": "..."
  }},
  "title": "Your compelling video title",
  "topic": "Main topic/theme",
  "niche": "{niche}",
  "structure": {{
    "hook": "Attention-grabbing hook (first 5-10 seconds)",
    "intro": "Brief introduction",
    "sections": [
      {{"title": "Section title", "content": "Detailed content", "tips": ["tip1", "tip2"]}}
    ],
    "outro": "Call to action and closing"
  }},
  "thumbnail_ideas": ["idea 1", "idea 2", "idea 3"],
  "metadata": {{
    "target_audience": "Who this is for",
    "estimated_length": "X-Y minutes",
    "cpm_potential": "High/Medium/Low — reason"
  }}
}}
"""

        raw = await self.openai.generate_completion(
            prompt=prompt,
            system_message=(
                "You are an expert content strategist who reverse-engineers "
                "successful YouTube videos and recreates their structure for new niches."
            ),
            temperature=0.75,
            max_tokens=2500,
        )

        # Strip markdown fences if present
        cleaned = raw.strip()
        for fence in ("```json", "```"):
            if cleaned.startswith(fence):
                cleaned = cleaned[len(fence):]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            blueprint = json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("Parrot: JSON parse failed, wrapping raw response")
            blueprint = {
                "title": meta["title"] or "Parrot Blueprint",
                "topic": your_topic or niche,
                "niche": niche,
                "structure": {
                    "hook": "",
                    "intro": "",
                    "sections": [{"title": "Content", "content": cleaned[:800], "tips": []}],
                    "outro": "",
                },
                "thumbnail_ideas": [],
                "metadata": {
                    "target_audience": "General",
                    "estimated_length": "5-10 minutes",
                    "cpm_potential": "Medium",
                },
            }

        return {
            "source_video": {
                "url":     yt_url,
                "title":   meta["title"],
                "channel": meta["channel"],
                "views":   meta["views"],
                "likes":   meta["likes"],
            },
            "blueprint": blueprint,
        }

# Made with Bob
