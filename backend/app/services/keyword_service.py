"""
Keyword Research Service — YouTube SEO keyword analysis.

For each seed keyword:
1. Uses YouTube Data API search.list to estimate search demand (result count).
2. Uses OpenAI to score competition, suggest long-tail variants, and rank by opportunity.

Returns a scored keyword list with search volume estimate, competition level,
and an opportunity score so creators can target the best terms.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

from app.services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

_YT_API_BASE = "https://www.googleapis.com/youtube/v3"


async def _yt_result_count(keyword: str, api_key: str) -> int:
    """Estimate search demand by counting YouTube search results for a keyword."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{_YT_API_BASE}/search",
                params={
                    "part": "id",
                    "q": keyword,
                    "type": "video",
                    "maxResults": 1,
                    "key": api_key,
                },
            )
            r.raise_for_status()
            data = r.json()
            # pageInfo.totalResults is an estimate from YouTube
            return data.get("pageInfo", {}).get("totalResults", 0)
    except Exception as exc:
        logger.warning("YT search count failed for '%s': %s", keyword, exc)
        return 0


class KeywordService:

    def __init__(self, openai_service: OpenAIService):
        self.openai = openai_service
        self._yt_key = os.getenv("YOUTUBE_DATA_API_KEY")

    async def research(
        self,
        topic: str,
        niche: str = "AI tools",
        count: int = 10,
    ) -> Dict[str, Any]:
        """
        Research keywords for a topic.

        Returns:
          {
            "seed_keyword": topic,
            "keywords": [
              {
                "keyword": str,
                "search_volume": "High/Medium/Low",
                "result_count": int,
                "competition": "High/Medium/Low",
                "opportunity_score": float (1-10),
                "intent": "informational/commercial/tutorial",
                "suggested_title": str,
              }
            ],
            "long_tail": [ str, ... ],
            "recommended_primary": str,
          }
        """
        # Step 1 — Ask OpenAI for keyword variants + analysis
        prompt = f"""
You are a YouTube SEO keyword research expert.

SEED TOPIC: {topic}
NICHE: {niche}

Generate a keyword research report. Return ONLY valid JSON (no markdown):
{{
  "keywords": [
    {{
      "keyword": "exact keyword phrase",
      "search_volume": "High/Medium/Low",
      "competition": "High/Medium/Low",
      "opportunity_score": 8.5,
      "intent": "informational/commercial/tutorial/entertainment",
      "suggested_title": "A YouTube title using this keyword",
      "why": "One sentence: why this keyword is worth targeting"
    }}
  ],
  "long_tail": ["long tail variant 1", "long tail variant 2", ...],
  "recommended_primary": "The single best keyword to target",
  "niche_tips": ["SEO tip specific to {niche} creators", ...]
}}

Include {count} keywords total, sorted by opportunity_score descending.
Mix high-volume competitive terms with lower-competition long-tail gems.
"""
        raw = await self.openai.generate_completion(
            prompt=prompt,
            system_message="You are a YouTube SEO expert. Return valid JSON only.",
            temperature=0.6,
            max_tokens=2000,
        )

        cleaned = raw.strip()
        for fence in ("```json", "```"):
            if cleaned.startswith(fence):
                cleaned = cleaned[len(fence):]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        try:
            result = json.loads(cleaned.strip())
        except json.JSONDecodeError:
            logger.warning("KeywordService: JSON parse failed")
            result = {
                "keywords": [{"keyword": topic, "search_volume": "Unknown",
                               "competition": "Unknown", "opportunity_score": 5.0,
                               "intent": "informational", "suggested_title": topic, "why": ""}],
                "long_tail": [],
                "recommended_primary": topic,
                "niche_tips": [],
            }

        # Step 2 — Optionally enrich top 5 keywords with real YouTube result counts
        if self._yt_key:
            keywords = result.get("keywords", [])[:5]
            import asyncio
            counts = await asyncio.gather(*[
                _yt_result_count(kw["keyword"], self._yt_key)
                for kw in keywords
            ])
            for kw, count_val in zip(keywords, counts):
                kw["result_count"] = count_val

        result["seed_keyword"] = topic
        return result

# Made with Bob
