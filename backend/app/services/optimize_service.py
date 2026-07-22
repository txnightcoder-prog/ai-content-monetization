"""
Optimize Service — AI Title, Description & Tag generator for YouTube videos.

Given a topic + script, generates:
- 10 title options ranked by click-through potential
- SEO-optimised YouTube description with keywords, timestamps placeholder, hashtags
- 20 keyword tags ordered by relevance
- A content pack summary (topic, niche, target audience, best posting time)
"""

import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def _make_ai_service():
    """Use Gemini by default. Only use OpenAI if key is present and valid (starts with sk-)."""
    import os
    if os.getenv("OPENAI_API_KEY", "").startswith("sk-"):
        from app.services.openai_service import OpenAIService
        return OpenAIService()
    from app.services.gemini_service import GeminiService
    return GeminiService()


class OptimizeService:

    def __init__(self, openai_service=None):
        self.openai = openai_service or _make_ai_service()

    async def optimize(
        self,
        topic: str,
        niche: str = "AI tools",
        hook: Optional[str] = None,
        body: Optional[str] = None,
        cta: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate YouTube SEO optimization pack for a script.

        Args:
            topic:  Video topic / title draft.
            niche:  Content niche.
            hook:   Script hook text (optional — improves title quality).
            body:   Script body text (optional).
            cta:    Script CTA text (optional).

        Returns dict with titles, description, tags, and content_pack.
        """
        script_context = ""
        if hook or body:
            parts = [p for p in [hook, body, cta] if p]
            script_context = f"\n\nSCRIPT PREVIEW:\n{chr(10).join(parts[:3])[:600]}"

        prompt = f"""
You are a YouTube SEO expert and viral content strategist.

TOPIC: {topic}
NICHE: {niche}{script_context}

Generate a complete YouTube SEO optimization pack. Return ONLY valid JSON (no markdown):
{{
  "titles": [
    {{"title": "Option 1", "style": "curiosity/number/how-to/shock/story", "ctr_score": 8.5}},
    ... (10 total, sorted by ctr_score descending)
  ],
  "description": "Full YouTube description (300-500 words). Include:\\n- Hook sentence\\n- 3-5 paragraph body expanding the topic\\n- Timestamps placeholder section (00:00 Intro, etc.)\\n- 3 relevant links placeholder\\n- 15 hashtags at the bottom\\n- Call to action to subscribe",
  "tags": ["tag1", "tag2", ... 20 tags ordered by search relevance],
  "content_pack": {{
    "recommended_title": "The single best title from the list above",
    "target_audience": "Who this video is for",
    "best_posting_time": "e.g. Tuesday-Thursday 2-4pm EST",
    "estimated_cpm": "$X-Y",
    "seo_tips": ["tip1", "tip2", "tip3"]
  }}
}}
"""
        raw = await self.openai.generate_completion(
            prompt=prompt,
            system_message=(
                "You are a YouTube SEO expert who generates high-performing titles, "
                "descriptions and tags. Always return valid JSON only."
            ),
            temperature=0.75,
            max_tokens=2500,
        )

        cleaned = raw.strip()
        for fence in ("```json", "```"):
            if cleaned.startswith(fence):
                cleaned = cleaned[len(fence):]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        try:
            return json.loads(cleaned.strip())
        except json.JSONDecodeError:
            logger.warning("OptimizeService: JSON parse failed")
            return {
                "titles": [{"title": topic, "style": "original", "ctr_score": 7.0}],
                "description": raw[:1000],
                "tags": [topic, niche],
                "content_pack": {
                    "recommended_title": topic,
                    "target_audience": niche,
                    "best_posting_time": "Tuesday-Thursday 2-4pm EST",
                    "estimated_cpm": "$5-15",
                    "seo_tips": [],
                },
            }

# Made with Bob
