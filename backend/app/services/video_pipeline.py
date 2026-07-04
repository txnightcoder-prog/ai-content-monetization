"""
Video Pipeline Service
======================
Orchestrates:
  1. Video generation — Local ElevenLabs+Pexels+FFmpeg faceless video
  2. YouTube direct upload via OAuth (publish / schedule)

Publishing uses the YouTube Data API v3 resumable upload endpoint.
Requires env vars: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
"""

import logging
import os
import tempfile
from typing import List, Optional
from uuid import UUID

import httpx
from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.video import Video, VideoStatus
from app.models.post import Post, Platform, PostStatus
from app.models.content_script import ContentScript
from app.services.local_video_service import LocalVideoService

logger = logging.getLogger(__name__)

YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
YOUTUBE_TOKEN_URL  = "https://oauth2.googleapis.com/token"


def _build_caption(script: ContentScript) -> str:
    parts = [script.hook, script.cta]
    return " ".join(p for p in parts if p).strip()


def _get_yt_access_token() -> str:
    """Exchange refresh token for a short-lived access token."""
    client_id     = os.getenv("YOUTUBE_CLIENT_ID", "")
    client_secret = os.getenv("YOUTUBE_CLIENT_SECRET", "")
    refresh_token = os.getenv("YOUTUBE_REFRESH_TOKEN", "")
    if not all([client_id, client_secret, refresh_token]):
        raise RuntimeError(
            "YouTube OAuth credentials not set. "
            "Need YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN."
        )
    r = httpx.post(YOUTUBE_TOKEN_URL, data={
        "client_id":     client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type":    "refresh_token",
    }, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


async def _upload_to_youtube(
    video_url: str,
    title: str,
    description: str,
    tags: Optional[List[str]] = None,
    privacy: str = "public",
) -> str:
    """
    Upload a video to YouTube.
    video_url can be a local file path (/tmp/videos/…) or an HTTP/HTTPS URL (e.g. D-ID S3 link).
    Returns the YouTube video ID.
    """
    import json
    import os as _os
    access_token = _get_yt_access_token()

    # ── Read video bytes — local file or remote URL ──────────────────────────
    if video_url.startswith("/") or (len(video_url) > 1 and video_url[1] == ":"):
        from pathlib import Path
        safe_dir = Path(_os.getenv("VIDEO_OUTPUT_DIR", "/tmp/videos")).resolve()
        video_path = Path(video_url).resolve()
        if not str(video_path).startswith(str(safe_dir)):
            raise ValueError(f"Video path is outside allowed directory: {video_url}")
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found on disk: {video_url}")
        with open(video_path, "rb") as f:
            video_bytes = f.read()
    else:
        # Remote URL (D-ID S3 pre-signed URL, etc.)
        logger.info("Downloading video for YouTube upload: %s", video_url[:80])
        async with httpx.AsyncClient(timeout=180, follow_redirects=True) as client:
            dl = await client.get(video_url)
            dl.raise_for_status()
            video_bytes = dl.content
        logger.info("Downloaded %d bytes for YouTube upload", len(video_bytes))

    if not video_bytes:
        raise ValueError("Video file is empty — cannot upload to YouTube")

    if "#Shorts" not in description:
        description += "\n\n#Shorts"
    if tags is None:
        tags = []

    # ── Build metadata as proper JSON ────────────────────────────────────────
    metadata_json = json.dumps({
        "snippet": {
            "title":       title[:100],
            "description": description[:5000],
            "tags":        tags,
            "categoryId":  "22",   # People & Blogs
        },
        "status": {
            "privacyStatus":          privacy,
            "selfDeclaredMadeForKids": False,
        },
    })

    # ── Multipart upload ─────────────────────────────────────────────────────
    logger.info("Uploading %d bytes to YouTube (title: %s)", len(video_bytes), title[:60])
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(
            YOUTUBE_UPLOAD_URL,
            params={"part": "snippet,status", "uploadType": "multipart"},
            headers={"Authorization": f"Bearer {access_token}"},
            files={
                "metadata": (None, metadata_json, "application/json"),
                "media":    ("video.mp4", video_bytes, "video/mp4"),
            },
        )
        if not r.is_success:
            logger.error("YouTube upload failed: %s %s", r.status_code, r.text[:500])
            r.raise_for_status()
        yt_id = r.json().get("id", "")

    if not yt_id:
        raise RuntimeError(f"YouTube returned no video ID. Response: {r.text[:300]}")

    logger.info("YouTube upload complete: video_id=%s", yt_id)
    return yt_id


class VideoPipelineService:
    """
    Background pipeline: D-ID or local video generation → YouTube upload.

    Provider precedence:
      1. D-ID  — if DID_API_KEY env var is set (talking avatar, highest quality)
      2. Local — ElevenLabs + Pexels + FFmpeg faceless video (free tier friendly)
    """

    def __init__(
        self,
        db: Session,
        video_service: Optional[LocalVideoService] = None,
    ):
        self.db = db
        self._video = video_service

    # ------------------------------------------------------------------
    async def generate(self, video_id: UUID) -> None:
        """Background task: generate video via local ElevenLabs+Pexels+FFmpeg pipeline."""
        video = self.db.query(Video).filter(Video.id == video_id).first()
        if not video:
            logger.error("VideoPipeline.generate: video %s not found", video_id)
            return

        script = self.db.query(ContentScript).filter(
            ContentScript.id == video.script_id
        ).first()
        if not script:
            logger.error("VideoPipeline.generate: script not found for video %s", video_id)
            self._set_failed(video)
            return

        script_text = "\n\n".join(p for p in [script.hook, script.body, script.cta] if p)
        caption = script.hook or script_text[:100]

        if self._video:
            await self._generate_local(video, script_text, caption)
        else:
            logger.warning("No video provider configured — marking video %s failed", video_id)
            self._set_failed(video, error="Video provider not configured. Set ELEVENLABS_API_KEY and PEXELS_API_KEY.")

    async def _generate_local(self, video: Video, script_text: str, caption: str) -> None:
        """Generate via local ElevenLabs + Pexels + FFmpeg pipeline."""
        try:
            result = await self._video.create_video(script=script_text, aspect_ratio="9:16")
            job_id = result.get("video_id")
            if not job_id:
                raise RuntimeError("LocalVideoService returned no job id")

            video.heygen_video_id = job_id
            self.db.commit()

            status_data = await self._video.wait_for_completion(
                job_id, script=script_text, caption_text=caption
            )
            video.video_url     = status_data.get("video_url")
            video.thumbnail_url = status_data.get("thumbnail_url")
            video.duration      = status_data.get("duration")
            video.status        = VideoStatus.READY
            video.error_message = None
            self.db.commit()
            logger.info("Video %s READY via local pipeline: %s", video.id, video.video_url)

        except Exception as exc:
            logger.error("Local video pipeline failed for %s: %s", video.id, exc)
            self._set_failed(video, error=str(exc))

    # ------------------------------------------------------------------
    async def publish(
        self,
        video_id: UUID,
        platforms: Optional[List[str]] = None,
        caption: Optional[str] = None,
    ) -> List[Post]:
        """Upload video to YouTube and create a Post DB record."""
        video = self.db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise ValueError(f"Video {video_id} not found")
        if video.status != VideoStatus.READY:
            raise ValueError(f"Video {video_id} is not READY (status={video.status})")
        if not video.video_url:
            raise ValueError(f"Video {video_id} has no video_url")

        if caption is None:
            script = self.db.query(ContentScript).filter(
                ContentScript.id == video.script_id
            ).first()
            caption = _build_caption(script) if script else ""

        post = Post(
            video_id=video_id,
            platform=Platform.youtube,
            status=PostStatus.SCHEDULED,
        )
        self.db.add(post)

        try:
            yt_id = await _upload_to_youtube(
                video_url=str(video.video_url),
                title=caption[:100] or "AI Generated Video",
                description=caption,
            )
            post.external_id = yt_id
            post.status      = PostStatus.POSTED
            video.status     = VideoStatus.POSTED
            logger.info("Video %s posted to YouTube as %s", video_id, yt_id)
        except Exception as exc:
            logger.error("YouTube upload failed for video %s: %s", video_id, exc)
            post.status = PostStatus.FAILED

        self.db.commit()
        self.db.refresh(post)
        return [post]

    # ------------------------------------------------------------------
    def _set_failed(self, video: Video, error: str = "Unknown error") -> None:
        video.status = VideoStatus.FAILED
        video.error_message = error[:1000]
        try:
            self.db.commit()
        except Exception:
            self.db.rollback()


# ------------------------------------------------------------------
def get_video_service() -> Optional[LocalVideoService]:
    """Return a LocalVideoService if ElevenLabs + Pexels keys are set."""
    if os.getenv("ELEVENLABS_API_KEY") and os.getenv("PEXELS_API_KEY"):
        return LocalVideoService()
    return None


def get_pipeline(db: Session = Depends(get_db)) -> VideoPipelineService:
    return VideoPipelineService(db=db, video_service=get_video_service())

# Made with Bob
