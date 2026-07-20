"""
Image Generation Service
========================
Multi-provider image generator with automatic fallback chain:

  1. Imagen 3  — via GOOGLE_API_KEY (same key as Gemini/Veo — free quota)
  2. DALL-E 3  — via OPENAI_API_KEY  (~$0.04/image, 1024x1024)
  3. Placeholder — a solid-colour JPEG so the pipeline never hard-crashes

Used for:
  - Character portraits in personalised kids videos
  - Scene background images
  - Video thumbnails

All methods return a local file path (str) so callers don't need to know
which provider was used.
"""

import base64
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_IMAGEN_BASE = "https://generativelanguage.googleapis.com/v1beta"
_OPENAI_BASE = "https://api.openai.com/v1"


class ImageService:
    """
    Generate images from text prompts.
    Auto-selects the best available provider based on env vars.

    Usage::

        svc = ImageService()
        path = await svc.generate(
            prompt="A cheerful 6-year-old girl with blonde hair and blue eyes, "
                   "cartoon style, bright colours",
            output_path="/tmp/videos/character.jpg",
        )
    """

    def __init__(
        self,
        google_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
    ):
        self._google_key = google_api_key or os.getenv("GOOGLE_API_KEY", "")
        self._openai_key = openai_api_key or os.getenv("OPENAI_API_KEY", "")

    # ------------------------------------------------------------------
    async def generate(
        self,
        prompt: str,
        output_path: str,
        width: int = 1024,
        height: int = 1024,
        style: str = "vivid",          # vivid | natural (DALL-E param, ignored by Imagen)
    ) -> str:
        """
        Generate an image from ``prompt`` and save to ``output_path``.
        Tries Imagen 3 first, then DALL-E 3, then writes a placeholder.
        Returns ``output_path``.
        """
        # ── 1. Imagen 3 ──────────────────────────────────────────────────────
        if self._google_key:
            try:
                result = await self._imagen3(prompt, output_path, width, height)
                logger.info("ImageService: generated via Imagen 3 → %s", output_path)
                return result
            except Exception as exc:
                logger.warning("ImageService: Imagen 3 failed (%s) — trying DALL-E 3", exc)

        # ── 2. DALL-E 3 ──────────────────────────────────────────────────────
        if self._openai_key:
            try:
                result = await self._dalle3(prompt, output_path, style)
                logger.info("ImageService: generated via DALL-E 3 → %s", output_path)
                return result
            except Exception as exc:
                logger.warning("ImageService: DALL-E 3 failed (%s) — using placeholder", exc)

        # ── 3. Placeholder ───────────────────────────────────────────────────
        logger.warning("ImageService: no provider available — writing placeholder image")
        return self._placeholder(output_path, width, height)

    # ------------------------------------------------------------------
    async def generate_character(
        self,
        child_name: str,
        age: Optional[str],
        hair_colour: Optional[str],
        eye_colour: Optional[str],
        extra_features: Optional[str],
        output_path: str,
        style: str = "cartoon",
    ) -> str:
        """
        Convenience method: build a child-character prompt and generate the image.
        Returns ``output_path``.
        """
        hair     = hair_colour    or "brown"
        eyes     = eye_colour     or "brown"
        age_str  = f"{age}-year-old " if age else ""
        features = f", {extra_features.strip()}" if extra_features else ""

        style_desc = {
            "cartoon":    "friendly cartoon illustration, Pixar-style, bright colours, white background",
            "realistic":  "photorealistic portrait, warm studio lighting, shallow depth of field",
            "storybook":  "watercolour storybook illustration, soft pastel colours, white background",
            "anime":      "anime art style, clean linework, bright colours",
        }.get(style, "friendly cartoon illustration, Pixar-style")

        prompt = (
            f"A cheerful {age_str}child named {child_name} "
            f"with {hair} hair and {eyes} eyes{features}. "
            f"{style_desc}. "
            "Child-safe. No text. No watermarks."
        )
        return await self.generate(prompt, output_path)

    # ------------------------------------------------------------------
    async def generate_scene(
        self,
        scene_description: str,
        output_path: str,
        aspect: str = "9:16",
    ) -> str:
        """
        Generate a scene background image (portrait 9:16 or landscape 16:9).
        Returns ``output_path``.
        """
        w, h = (1024, 1792) if aspect == "9:16" else (1792, 1024)
        prompt = (
            f"A vibrant, child-friendly scene: {scene_description}. "
            "Bright colours. Cartoon illustration style. No text. No people faces."
        )
        return await self.generate(prompt, output_path, width=w, height=h)

    # ------------------------------------------------------------------
    # ── Private provider implementations ─────────────────────────────────────

    async def _imagen3(self, prompt: str, output_path: str, width: int, height: int) -> str:
        """Generate image via Google Imagen 3 REST API."""
        # Supported sizes for Imagen 3: 1:1=1024x1024, 9:16=768x1344, 16:9=1344x768
        # Snap to nearest supported aspect ratio
        if height > width:
            img_w, img_h = 768, 1344    # 9:16 portrait
        elif width > height:
            img_w, img_h = 1344, 768   # 16:9 landscape
        else:
            img_w, img_h = 1024, 1024  # square

        url  = f"{_IMAGEN_BASE}/models/imagen-3.0-generate-002:predict?key={self._google_key}"
        body = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": f"{img_w}:{img_h}",
                "safetyFilterLevel": "block_some",
                "personGeneration": "allow_adult",
            },
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=body)
            if resp.status_code == 400 and "not enabled" in resp.text.lower():
                raise RuntimeError("Imagen 3 API not enabled for this key — enable it at aistudio.google.com")
            resp.raise_for_status()

        predictions = resp.json().get("predictions", [])
        if not predictions:
            raise RuntimeError("Imagen 3 returned no predictions")

        img_b64 = predictions[0].get("bytesBase64Encoded", "")
        if not img_b64:
            raise RuntimeError("Imagen 3 prediction missing bytesBase64Encoded field")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(base64.b64decode(img_b64))
        return output_path

    async def _dalle3(self, prompt: str, output_path: str, style: str = "vivid") -> str:
        """Generate image via OpenAI DALL-E 3 and save to output_path."""
        url  = f"{_OPENAI_BASE}/images/generations"
        body = {
            "model":   "dall-e-3",
            "prompt":  prompt[:4000],
            "n":       1,
            "size":    "1024x1024",
            "style":   style,
            "response_format": "b64_json",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                json=body,
                headers={"Authorization": f"Bearer {self._openai_key}"},
            )
            resp.raise_for_status()

        img_b64 = resp.json()["data"][0]["b64_json"]
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(base64.b64decode(img_b64))
        return output_path

    def _placeholder(self, output_path: str, width: int = 1024, height: int = 1024) -> str:
        """
        Write a minimal valid JPEG placeholder so downstream code never crashes.
        Uses FFmpeg to generate a solid blue frame — no Pillow dependency needed.
        """
        import shutil
        import subprocess

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
        subprocess.run(
            [
                ffmpeg, "-y",
                "-f", "lavfi",
                "-i", f"color=c=4a90d9:size={width}x{height}:rate=1",
                "-vframes", "1",
                "-q:v", "5",
                output_path,
            ],
            capture_output=True,
        )
        return output_path


# Made with Bob
