"""
Pexels Stock Video Service
===========================
Fetches royalty-free stock video clips by keyword from the Pexels API.

API docs: https://www.pexels.com/api/documentation/
Get free key: https://www.pexels.com/api/ (free, unlimited requests)

Required env vars:
  PEXELS_API_KEY — your Pexels API key
"""

import os
import random
from typing import List, Optional

import httpx

PEXELS_BASE = "https://api.pexels.com/videos"


class PexelsService:
    """Fetch royalty-free stock video clips from Pexels."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("PEXELS_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Pexels API key not set. "
                "Add PEXELS_API_KEY to your .env file. "
                "Get a free key at pexels.com/api."
            )

    def _headers(self) -> dict:
        return {"Authorization": self.api_key}

    # ------------------------------------------------------------------
    async def search_clips(
        self,
        query: str,
        count: int = 5,
        orientation: str = "portrait",   # portrait = 9:16 for Shorts/Reels
        min_duration: int = 3,
        max_duration: int = 15,
    ) -> List[str]:
        """
        Search Pexels for stock video clips matching ``query``.

        Returns a list of up to ``count`` direct MP4 download URLs.
        Clips are filtered to ``orientation`` and duration range.
        """
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{PEXELS_BASE}/search",
                params={
                    "query": query,
                    "per_page": min(count * 3, 30),   # fetch extras to filter
                    "orientation": orientation,
                    "size": "medium",
                },
                headers=self._headers(),
            )
            if r.status_code == 401:
                raise ValueError("Invalid Pexels API key (401).")
            r.raise_for_status()
            data = r.json()

        urls: List[str] = []
        for video in data.get("videos", []):
            duration = video.get("duration", 0)
            if not (min_duration <= duration <= max_duration):
                continue
            # Pick the HD or SD file — prefer portrait, fall back to any
            files = video.get("video_files", [])
            mp4 = next(
                (f["link"] for f in files if f.get("file_type") == "video/mp4"
                 and f.get("quality") in ("hd", "sd")),
                None,
            )
            if mp4:
                urls.append(mp4)
            if len(urls) >= count:
                break

        # Shuffle so repeated calls for the same topic vary
        random.shuffle(urls)
        return urls[:count]

    # ------------------------------------------------------------------
    async def verify_key(self) -> str:
        """Ping a lightweight endpoint to confirm the key is valid."""
        clips = await self.search_clips("nature", count=1)
        if not clips:
            raise RuntimeError("Pexels key valid but returned no results.")
        return "Pexels API key is valid"
