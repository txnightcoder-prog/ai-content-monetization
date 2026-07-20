"""
Video Clip Service (Unified)
=============================
Multi-provider video clip generator with automatic fallback chain:

  1. Veo 3       — Google AI-generated clips   (GOOGLE_API_KEY)
  2. Kling 2.0   — fal.ai AI-generated clips   (FAL_API_KEY, ~$0.05/clip)
  3. Pexels      — royalty-free stock footage   (PEXELS_API_KEY, free)
  4. Pixabay     — royalty-free stock footage   (PIXABAY_API_KEY, free)

Returns a list of local MP4 clip paths regardless of provider.

Usage::

    svc = ClipService()
    paths = await svc.get_clips(prompt="magical forest adventure", count=4)
"""

import asyncio
import logging
import os
import tempfile
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

_PEXELS_BASE  = "https://api.pexels.com/videos"
_PIXABAY_BASE = "https://pixabay.com/api/videos/"
_FAL_BASE     = "https://queue.fal.run"

# Kling 2.0 model on fal.ai
_KLING_MODEL = "fal-ai/kling-video/v2/standard/text-to-video"


class ClipService:
    """
    Unified video clip source: AI-generated or stock footage, whichever is available.

    All clips are downloaded to local temp files and returned as a list of paths.
    The video assembler then concatenates them with the voiceover.
    """

    def __init__(
        self,
        google_key:  Optional[str] = None,
        fal_key:     Optional[str] = None,
        pexels_key:  Optional[str] = None,
        pixabay_key: Optional[str] = None,
        output_dir:  Optional[str] = None,
    ):
        self._google_key  = google_key  or os.getenv("GOOGLE_API_KEY", "")
        self._fal_key     = fal_key     or os.getenv("FAL_API_KEY", "")
        self._pexels_key  = pexels_key  or os.getenv("PEXELS_API_KEY", "")
        self._pixabay_key = pixabay_key or os.getenv("PIXABAY_API_KEY", "")
        self._output_dir  = output_dir  or os.getenv("VIDEO_OUTPUT_DIR", "/tmp/videos")
        os.makedirs(self._output_dir, exist_ok=True)

    # ------------------------------------------------------------------
    async def get_clips(
        self,
        prompt: str,
        count: int = 4,
        aspect_ratio: str = "9:16",
        duration_seconds: int = 5,
        niche: str = "kids",
    ) -> List[str]:
        """
        Return a list of up to ``count`` local MP4 clip paths for the given ``prompt``.
        Tries AI-generated first, falls back to stock footage.
        """
        # ── 1. Veo 3 ─────────────────────────────────────────────────────────
        if self._google_key:
            try:
                paths = await self._veo_clips(prompt, count, aspect_ratio)
                if paths:
                    logger.info("ClipService: %d clips from Veo 3", len(paths))
                    return paths
            except Exception as exc:
                logger.warning("ClipService: Veo 3 failed (%s) — trying Kling", exc)

        # ── 2. Kling 2.0 (fal.ai) ────────────────────────────────────────────
        if self._fal_key:
            try:
                paths = await self._kling_clips(prompt, count, aspect_ratio, duration_seconds)
                if paths:
                    logger.info("ClipService: %d clips from Kling 2.0", len(paths))
                    return paths
            except Exception as exc:
                logger.warning("ClipService: Kling failed (%s) — trying Pexels", exc)

        # ── 3. Pexels stock ───────────────────────────────────────────────────
        if self._pexels_key:
            try:
                paths = await self._pexels_clips(prompt, count)
                if paths:
                    logger.info("ClipService: %d clips from Pexels", len(paths))
                    return paths
            except Exception as exc:
                logger.warning("ClipService: Pexels failed (%s) — trying Pixabay", exc)

        # ── 4. Pixabay stock ──────────────────────────────────────────────────
        if self._pixabay_key:
            try:
                paths = await self._pixabay_clips(prompt, count)
                if paths:
                    logger.info("ClipService: %d clips from Pixabay", len(paths))
                    return paths
            except Exception as exc:
                logger.warning("ClipService: Pixabay failed (%s)", exc)

        logger.error("ClipService: all providers failed for prompt '%s'", prompt[:60])
        return []

    # ------------------------------------------------------------------
    # ── Private provider implementations ─────────────────────────────────────

    async def _veo_clips(self, prompt: str, count: int, aspect_ratio: str) -> List[str]:
        """Delegate to VeoVideoService and return list of clip paths."""
        from app.services.veo_service import VeoVideoService, _split_into_scenes, _build_visual_prompt
        svc = VeoVideoService(api_key=self._google_key)
        scenes = _split_into_scenes(prompt, max_scenes=count)
        paths  = await svc._generate_clips(
            scenes=scenes,
            niche="kids" if "child" in prompt.lower() else "technology",
            job_id="clipservice",
            max_wait=180,
        )
        return paths or []

    async def _kling_clips(
        self, prompt: str, count: int, aspect_ratio: str, duration: int
    ) -> List[str]:
        """Generate clips via Kling 2.0 on fal.ai."""
        ratio_map = {"9:16": "9:16", "16:9": "16:9", "1:1": "1:1"}
        ratio = ratio_map.get(aspect_ratio, "9:16")

        visual_prompt = (
            f"Cinematic {ratio} video. {prompt[:200]}. "
            "Smooth camera motion. No text. Professional quality."
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{_FAL_BASE}/{_KLING_MODEL}",
                headers={"Authorization": f"Key {self._fal_key}", "Content-Type": "application/json"},
                json={
                    "prompt":       visual_prompt,
                    "aspect_ratio": ratio,
                    "duration":     f"{min(duration, 10)}",
                },
            )
            resp.raise_for_status()
            job = resp.json()

        request_id = job.get("request_id")
        if not request_id:
            raise RuntimeError(f"Kling returned no request_id: {job}")

        # Poll for result
        result_url = f"{_FAL_BASE}/{_KLING_MODEL}/requests/{request_id}"
        for _ in range(60):   # up to 5 minutes
            await asyncio.sleep(5)
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.get(result_url, headers={"Authorization": f"Key {self._fal_key}"})
                r.raise_for_status()
                data = r.json()

            status = data.get("status")
            if status == "COMPLETED":
                video_url = data.get("video", {}).get("url", "")
                if video_url:
                    path = await self._download_clip(video_url, f"kling_{request_id[:8]}.mp4")
                    return [path]
                break
            if status in ("FAILED", "CANCELLED"):
                raise RuntimeError(f"Kling job {request_id} {status}")

        raise RuntimeError("Kling clip generation timed out")

    async def _pexels_clips(self, prompt: str, count: int) -> List[str]:
        """Search Pexels for stock clips and download them locally."""
        headers = {"Authorization": self._pexels_key}
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{_PEXELS_BASE}/search",
                params={"query": prompt[:100], "per_page": count * 2, "orientation": "portrait"},
                headers=headers,
            )
            resp.raise_for_status()
            videos = resp.json().get("videos", [])

        if not videos:
            return []

        urls: List[str] = []
        for v in videos:
            files = sorted(
                [f for f in v.get("video_files", []) if f.get("quality") in ("hd", "sd")],
                key=lambda f: f.get("height", 0), reverse=True,
            )
            if files:
                urls.append(files[0]["link"])
            if len(urls) >= count:
                break

        tasks = [self._download_clip(u, f"pexels_{i}.mp4") for i, u in enumerate(urls)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, str)]

    async def _pixabay_clips(self, prompt: str, count: int) -> List[str]:
        """Search Pixabay video API for stock clips."""
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                _PIXABAY_BASE,
                params={
                    "key":           self._pixabay_key,
                    "q":             prompt[:100],
                    "per_page":      count * 2,
                    "video_type":    "all",
                    "safesearch":    "true",
                },
            )
            resp.raise_for_status()
            hits = resp.json().get("hits", [])

        if not hits:
            return []

        urls: List[str] = []
        for h in hits:
            vids = h.get("videos", {})
            url = (vids.get("large") or vids.get("medium") or vids.get("small") or {}).get("url", "")
            if url:
                urls.append(url)
            if len(urls) >= count:
                break

        tasks = [self._download_clip(u, f"pixabay_{i}.mp4") for i, u in enumerate(urls)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, str)]

    async def _download_clip(self, url: str, filename: str) -> str:
        """Stream-download a video URL to a local temp file. Returns local path."""
        dest = os.path.join(self._output_dir, f"clip_{filename}")
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            async with client.stream("GET", url) as resp:
                resp.raise_for_status()
                with open(dest, "wb") as f:
                    async for chunk in resp.aiter_bytes(65536):
                        f.write(chunk)
        return dest


# Made with Bob
