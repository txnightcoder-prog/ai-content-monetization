"""
Trending Service — fetch what's trending on YouTube, TikTok and Instagram.

Sources:
- YouTube  : YouTube Data API v3 "mostPopular" videos endpoint (free, no OAuth).
             Falls back to AI-generated trends if YOUTUBE_DATA_API_KEY is not set.
- TikTok   : OpenAI generates real-time-aware trending topic analysis
             (no unofficial scraping — stable and free via existing OpenAI key).
- Instagram: Same AI approach as TikTok.

All three platforms return a list of TrendingItem dicts:
  {
    "rank":        int,
    "title":       str,   # video/reel/post title or topic
    "creator":     str,   # channel / account name (or "" if AI-generated)
    "views":       str,   # "12.3M" or "estimated" for AI items
    "tags":        list[str],
    "why_trending": str,  # 1-sentence reason
    "use_for_niche": str  # suggested hook/angle for the user's niche
  }
"""

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

import httpx

from app.services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

_YT_API_BASE = "https://www.googleapis.com/youtube/v3"

# YouTube search keywords — used for the search/list endpoint which actually
# respects niche filtering (the mostPopular+categoryId combo is unreliable).
_YT_SEARCH_QUERIES = {
    "AI tools":     "AI tools automation ChatGPT productivity",
    "technology":   "tech review gadgets 2025",
    "education":    "how to learn tutorial skills",
    "finance":      "investing personal finance money 2025",
    "side hustles": "side hustle make money online 2025",
    "health":       "fitness workout health tips",
    "gaming":       "gaming highlights gameplay 2025",
    "music":        "new music release 2025",
    "beauty":       "makeup tutorial skincare routine",
    "food":         "recipe cooking food challenge",
    "travel":       "travel vlog destination tips",
    "sports":       "sports highlights training fitness",
    "comedy":       "funny comedy sketch viral",
    "kids":         "kids educational family friendly",
    "motivation":   "motivation mindset self improvement",
    "news":         "news current events 2025",
    "pets":         "cute pets dogs cats animals viral",
    "diy":          "DIY home improvement crafts",
    "cars":         "car review automotive EV 2025",
    "paranormal":   "true crime paranormal mystery unsolved",
    "default":      "trending viral videos 2025",
}

# Human-readable niche descriptions used to sharpen the AI trending prompt
_NICHE_DESCRIPTIONS = {
    "AI tools":     "AI tools, automation, ChatGPT, online business, passive income with AI",
    "technology":   "tech reviews, gadgets, software, consumer electronics",
    "education":    "tutorials, how-to guides, skills, courses, learning",
    "finance":      "investing, personal finance, stocks, crypto, budgeting, wealth building",
    "side hustles": "side hustles, freelancing, remote work, productivity, making money online",
    "health":       "health, fitness, workout, diet, mental wellness, biohacking",
    "gaming":       "gaming, game reviews, walkthroughs, esports, streamers",
    "music":        "music, new releases, artists, covers, music production",
    "beauty":       "makeup, skincare, fashion, haul videos, beauty tutorials",
    "food":         "cooking, recipes, restaurant reviews, food challenges, baking",
    "travel":       "travel vlogs, destinations, budget travel, travel tips",
    "sports":       "sports highlights, athlete news, fitness training, match recaps",
    "comedy":       "comedy sketches, stand-up, funny videos, reaction content",
    "kids":         "kids content, family vlogs, educational cartoons, toy reviews",
    "motivation":   "motivation, self-help, mindset, productivity, personal development",
    "news":         "current events, breaking news, commentary, political analysis",
    "pets":         "pets, animals, dog training, cat videos, wildlife",
    "diy":          "DIY projects, home improvement, crafts, repairs, woodworking",
    "cars":         "cars, automotive reviews, road tests, car mods, EV news",
    "paranormal":   "true crime, paranormal, horror stories, mysteries, unsolved cases",
}


def _fmt_count(n: Optional[str]) -> str:
    if not n:
        return "unknown"
    try:
        v = int(n)
        if v >= 1_000_000:
            return f"{v/1_000_000:.1f}M"
        if v >= 1_000:
            return f"{v/1_000:.1f}K"
        return str(v)
    except ValueError:
        return n


class TrendingService:

    def __init__(self, openai_service: OpenAIService):
        self.openai = openai_service
        self._yt_key = os.getenv("YOUTUBE_DATA_API_KEY")

    # ── Public entry point ────────────────────────────────────────────────────

    async def get_trending(
        self,
        niche: str = "AI tools",
        count: int = 8,
    ) -> Dict[str, Any]:
        """
        Return trending content for YouTube, TikTok and Instagram.

        Returns:
            {
              "youtube":   [ TrendingItem, ... ],
              "tiktok":    [ TrendingItem, ... ],
              "instagram": [ TrendingItem, ... ],
            }
        """
        import asyncio
        yt, tt, ig = await asyncio.gather(
            self._youtube_trending(niche, count),
            self._ai_trending("TikTok", niche, count),
            self._ai_trending("Instagram Reels", niche, count),
        )
        return {"youtube": yt, "tiktok": tt, "instagram": ig}

    # ── YouTube ───────────────────────────────────────────────────────────────

    async def _youtube_trending(self, niche: str, count: int) -> List[Dict[str, Any]]:
        if not self._yt_key:
            logger.info("Trending/YouTube: no API key — using AI")
            return await self._ai_trending("YouTube", niche, count)

        query = _YT_SEARCH_QUERIES.get(niche, _YT_SEARCH_QUERIES["default"])

        # Step 1: search for niche-relevant video IDs sorted by view count
        search_params = {
            "part":       "snippet",
            "q":          query,
            "type":       "video",
            "order":      "viewCount",
            "regionCode": "US",
            "maxResults": count,
            "key":        self._yt_key,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                search_resp = await client.get(f"{_YT_API_BASE}/search", params=search_params)
                search_resp.raise_for_status()
                search_data = search_resp.json()

                # Step 2: fetch statistics for those video IDs
                vid_ids = ",".join(
                    item["id"]["videoId"]
                    for item in search_data.get("items", [])
                    if item.get("id", {}).get("videoId")
                )
                if not vid_ids:
                    raise ValueError("No video IDs returned from search")

                stats_resp = await client.get(f"{_YT_API_BASE}/videos", params={
                    "part": "statistics",
                    "id":   vid_ids,
                    "key":  self._yt_key,
                })
                stats_resp.raise_for_status()
                stats_by_id = {
                    v["id"]: v.get("statistics", {})
                    for v in stats_resp.json().get("items", [])
                }

        except Exception as exc:
            logger.warning("Trending/YouTube API error: %s — falling back to AI", exc)
            return await self._ai_trending("YouTube", niche, count)

        items = []
        for rank, item in enumerate(search_data.get("items", []), 1):
            s      = item.get("snippet", {})
            vid_id = item["id"]["videoId"]
            st     = stats_by_id.get(vid_id, {})
            items.append({
                "rank":          rank,
                "title":         s.get("title", ""),
                "creator":       s.get("channelTitle", ""),
                "views":         _fmt_count(st.get("viewCount")),
                "tags":          [],
                "why_trending":  f"Top viewed {niche} video on YouTube",
                "use_for_niche": await self._suggest_angle(s.get("title", ""), niche),
                "url":           f"https://www.youtube.com/watch?v={vid_id}",
            })

        return items

    # ── AI-generated trending (TikTok / Instagram / fallback YouTube) ─────────

    async def _ai_trending(self, platform: str, niche: str, count: int) -> List[Dict[str, Any]]:
        niche_desc = _NICHE_DESCRIPTIONS.get(niche, niche)
        prompt = f"""
You are a social media trends analyst with deep, specific knowledge of current viral content.

Niche: "{niche}" — specifically: {niche_desc}

List the {count} most trending video topics/formats RIGHT NOW on {platform}
that are DIRECTLY relevant to this exact niche. Do NOT give generic or off-topic trends.
Every item must be something a creator in the "{niche}" space would actually make.

Return ONLY a valid JSON array (no markdown fences) of exactly {count} objects:
[
  {{
    "rank": 1,
    "title": "Specific trending topic or viral video title format for this niche",
    "creator": "Example creator name or account type in this niche (or empty string)",
    "views": "Estimated reach e.g. 50M or 'Viral'",
    "tags": ["niche-specific-tag1", "niche-specific-tag2", "niche-specific-tag3"],
    "why_trending": "One sentence: why THIS specific topic is blowing up in the {niche} space right now",
    "use_for_niche": "A specific, actionable video idea for a {niche} creator to make TODAY using this trend",
    "url": ""
  }}
]
"""
        try:
            raw = await self.openai.generate_completion(
                prompt=prompt,
                system_message="You are an expert social media trends analyst.",
                temperature=0.8,
                max_tokens=1800,
            )
            cleaned = raw.strip()
            for fence in ("```json", "```"):
                if cleaned.startswith(fence):
                    cleaned = cleaned[len(fence):]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            items = json.loads(cleaned.strip())
            if isinstance(items, list):
                return items[:count]
        except Exception as exc:
            logger.error("Trending/AI failed for %s: %s", platform, exc)

        return []

    # ── Helper: suggest how to use a trending title in user's niche ───────────

    async def _suggest_angle(self, title: str, niche: str) -> str:
        if not title:
            return ""
        try:
            prompt = (
                f'The YouTube video "{title}" is trending. '
                f'In one sentence, suggest how a "{niche}" content creator '
                f"could make a video inspired by this trend."
            )
            return await self.openai.generate_completion(
                prompt=prompt, temperature=0.7, max_tokens=80
            )
        except Exception:
            return ""

# Made with Bob
