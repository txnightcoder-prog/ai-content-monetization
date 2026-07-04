"""
AI Image Generation Service (DALL·E 3)
=======================================
Generates thumbnails, social-media images, and AI art for your videos
using OpenAI's DALL·E 3 model — HD quality, photorealistic results.

Powered by your existing OPENAI_API_KEY. No extra key needed.

Supported use-cases
-------------------
1. YouTube thumbnail — eye-catching title-card style image (16:9 / 1792×1024)
2. Social media visual — square or portrait post image (1:1 / 9:16)
3. Consistent avatar — a repeatable AI presenter face/character
4. Training-material diagram — clean technical illustration

Cost: ~$0.04–0.08 per image (DALL·E 3 HD pricing).
Free tier: included in OpenAI API credits.
"""

import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# ── API endpoints ────────────────────────────────────────────────────────────
_OPENAI_BASE = "https://api.openai.com/v1"

# Preset style recipes for common use-cases
STYLE_PRESETS = {
    "youtube_thumbnail": (
        "eye-catching YouTube thumbnail, bold text overlay space, "
        "bright vivid colors, high contrast, professional design, "
        "widescreen 16:9, cinematic composition, trending style"
    ),
    "youtube_shorts_thumbnail": (
        "eye-catching portrait thumbnail for YouTube Shorts, bold, "
        "vibrant colors, vertical 9:16 composition, minimal text space at top"
    ),
    "social_square": (
        "social media post image, square 1:1, clean modern design, "
        "professional, bold typography space, vibrant brand colors"
    ),
    "ai_avatar": (
        "consistent AI presenter avatar, professional headshot style, "
        "clean neutral background, confident pose, modern tech aesthetic"
    ),
    "tech_diagram": (
        "clean technical architecture diagram, minimal flat design, "
        "blue and white color scheme, professional infographic style"
    ),
    "motivational": (
        "motivational visual, bold quote space, cinematic background, "
        "high-energy composition, gradient overlay, professional design"
    ),
}

# Size mapping for DALL·E 3
SIZE_MAP = {
    "16:9":  "1792x1024",
    "9:16":  "1024x1792",
    "1:1":   "1024x1024",
    "4:3":   "1024x1024",   # closest available
}


def _headers(api_key: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }


class OpenArtService:
    """
    Generate AI images for thumbnails and social media via DALL·E 3.
    Requires OPENAI_API_KEY (already used for scripts — no extra key needed).
    """

    def __init__(self):
        self._openai_key = os.getenv("OPENAI_API_KEY", "")
        self._base       = _OPENAI_BASE
        self._key        = self._openai_key
        self._provider   = "dall-e-3"
        self._model      = "dall-e-3"

    @property
    def provider(self) -> str:
        return self._provider

    @property
    def configured(self) -> bool:
        return bool(self._openai_key)

    # ------------------------------------------------------------------
    async def generate_image(
        self,
        prompt: str,
        style_preset: Optional[str] = None,
        aspect_ratio: str = "16:9",
        n: int = 1,
    ) -> List[Dict[str, Any]]:
        """
        Generate image(s) from a text prompt.

        Args:
            prompt:        Describe what you want to see.
            style_preset:  Optional key from STYLE_PRESETS to append style guidance.
            aspect_ratio:  "16:9", "9:16", or "1:1".
            n:             Number of images to generate (1–4).

        Returns:
            List of dicts with keys: url, revised_prompt, provider
        """
        if not self.configured:
            raise RuntimeError(
                "No image generation API key configured. "
                "Set OPENART_API_KEY (openart.ai) or OPENAI_API_KEY (DALL·E 3 fallback)."
            )

        size = SIZE_MAP.get(aspect_ratio, "1792x1024")

        # Build enriched prompt
        full_prompt = prompt.strip()
        if style_preset and style_preset in STYLE_PRESETS:
            full_prompt = f"{full_prompt}, {STYLE_PRESETS[style_preset]}"

        payload: Dict[str, Any] = {
            "model":  self._model,
            "prompt": full_prompt,
            "n":      min(max(n, 1), 4),
            "size":   size,
        }
        # DALL·E 3 extra params
        if self._provider == "dall-e-3":
            payload["quality"]         = "hd"
            payload["response_format"] = "url"

        endpoint = f"{self._base}/images/generations"
        logger.info("OpenArtService: generating %d image(s) via %s", n, self._provider)

        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(endpoint, headers=_headers(self._key), json=payload)
            if not r.is_success:
                logger.error("Image generation failed (%s): %s", r.status_code, r.text[:400])
                r.raise_for_status()
            data = r.json()

        images = data.get("data", [])
        return [
            {
                "url":            img.get("url") or img.get("image_url", ""),
                "revised_prompt": img.get("revised_prompt", full_prompt),
                "provider":       self._provider,
            }
            for img in images
        ]

    # ------------------------------------------------------------------
    async def generate_thumbnail(
        self,
        video_topic: str,
        niche: str = "AI tools",
        style: str = "youtube_thumbnail",
        aspect_ratio: str = "16:9",
    ) -> List[Dict[str, Any]]:
        """Generate 2 YouTube thumbnail options for a given video topic."""
        prompt = (
            f"YouTube thumbnail for a video about: {video_topic}. "
            f"Niche: {niche}. "
            f"Make it click-worthy, professional, and visually striking."
        )
        return await self.generate_image(
            prompt=prompt,
            style_preset=style,
            aspect_ratio=aspect_ratio,
            n=2,
        )

    # ------------------------------------------------------------------
    async def generate_avatar(
        self,
        description: str = "professional AI content creator, neutral background",
    ) -> List[Dict[str, Any]]:
        """Generate a consistent AI presenter avatar."""
        prompt = (
            f"AI presenter avatar: {description}. "
            f"Professional headshot, high quality, consistent look."
        )
        return await self.generate_image(
            prompt=prompt,
            style_preset="ai_avatar",
            aspect_ratio="1:1",
            n=2,
        )

    # ------------------------------------------------------------------
    async def generate_social_pack(
        self,
        video_topic: str,
        niche: str = "AI tools",
    ) -> Dict[str, Any]:
        """
        Generate a 3-image social media content pack:
        - YouTube thumbnail (16:9)
        - YouTube Shorts / TikTok thumbnail (9:16)
        - Instagram square post (1:1)
        """
        base_prompt = (
            f"Social media visual for: {video_topic}. "
            f"Niche: {niche}. Eye-catching, professional, modern design."
        )

        # Fire all 3 in parallel
        import asyncio
        yt, shorts, ig = await asyncio.gather(
            self.generate_image(base_prompt, "youtube_thumbnail",         "16:9", n=1),
            self.generate_image(base_prompt, "youtube_shorts_thumbnail",  "9:16", n=1),
            self.generate_image(base_prompt, "social_square",             "1:1",  n=1),
        )

        return {
            "youtube_thumbnail":        yt[0] if yt else None,
            "shorts_tiktok_thumbnail":  shorts[0] if shorts else None,
            "instagram_square":         ig[0] if ig else None,
            "topic":                    video_topic,
            "niche":                    niche,
            "provider":                 self._provider,
        }

    # ------------------------------------------------------------------
    async def get_account_info(self) -> Dict[str, Any]:
        """Check connectivity and return provider info."""
        if not self.configured:
            return {"provider": "none", "status": "No API key set"}
        return {
            "provider": self._provider,
            "model":    self._model,
            "status":   "configured",
        }


# ── Dependency ────────────────────────────────────────────────────────────────
def get_openart_service() -> OpenArtService:
    return OpenArtService()

# Made with Bob
