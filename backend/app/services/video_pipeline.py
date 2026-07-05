"""
Video Pipeline Service
======================
Orchestrates:
  1. Video generation — Veo (Google AI) or Local (ElevenLabs+Pexels+FFmpeg)
  2. YouTube direct upload via OAuth (publish / schedule)

Provider precedence (checked at request time):
  1. Veo  — if GOOGLE_API_KEY is set  (AI-generated video clips)
  2. Local — if ELEVENLABS_API_KEY + PEXELS_API_KEY are set  (stock footage)

Publishing uses the YouTube Data API v3 resumable upload endpoint.
Requires env vars: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
"""

import logging
import os
import tempfile
from pathlib import Path
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


def _is_local_path(video_url: str) -> bool:
    """Return True if video_url is a local filesystem path (Fix Bug #3)."""
    return video_url.startswith("/") or (len(video_url) >= 2 and video_url[1] == ":")


async def _upload_to_youtube(
    video_url: str,
    title: str,
    description: str,
    tags: Optional[List[str]] = None,
    privacy: str = "public",
) -> str:
    """
    Upload a video to YouTube.
    video_url can be a local file path (/tmp/videos/…) or an HTTP/HTTPS URL.
    Returns the YouTube video ID.
    """
    import json
    access_token = _get_yt_access_token()

    # ── Resolve to a local file path ────────────────────────────────────────
    tmp_download: Optional[str] = None

    if _is_local_path(video_url):
        safe_dir   = Path(os.getenv("VIDEO_OUTPUT_DIR", "/tmp/videos")).resolve()
        video_path = Path(video_url).resolve()
        if not str(video_path).startswith(str(safe_dir)):
            raise ValueError(f"Video path is outside allowed directory: {video_url}")
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found on disk: {video_url}")
        local_video_path = str(video_path)
    else:
        # Remote URL — stream to a temp file instead of reading entirely into RAM
        # (Fix Warn #13: avoids OOM on large video files)
        logger.info("Downloading video for YouTube upload: %s", video_url[:80])
        tmp_fd, tmp_download = tempfile.mkstemp(suffix=".mp4")
        os.close(tmp_fd)
        try:
            async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
                async with client.stream("GET", video_url) as resp:
                    resp.raise_for_status()
                    with open(tmp_download, "wb") as f:
                        async for chunk in resp.aiter_bytes(65536):
                            f.write(chunk)
            logger.info("Downloaded video to temp file: %s", tmp_download)
            local_video_path = tmp_download
        except Exception:
            if os.path.exists(tmp_download):
                os.unlink(tmp_download)
            raise

    try:
        if os.path.getsize(local_video_path) == 0:
            raise ValueError("Video file is empty — cannot upload to YouTube")

        # Append #Shorts only if not already present (Fix Warn #14)
        if "#Shorts" not in description:
            description += "\n\n#Shorts"
        if tags is None:
            tags = []

        # ── Build metadata ────────────────────────────────────────────────
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

        file_size = os.path.getsize(local_video_path)
        logger.info("Uploading %d bytes to YouTube (title: %s)", file_size, title[:60])

        # ── Multipart upload — stream the file, don't buffer into RAM ─────
        async with httpx.AsyncClient(timeout=300) as client:
            with open(local_video_path, "rb") as video_file:
                r = await client.post(
                    YOUTUBE_UPLOAD_URL,
                    params={"part": "snippet,status", "uploadType": "multipart"},
                    headers={"Authorization": f"Bearer {access_token}"},
                    files={
                        "metadata": (None, metadata_json, "application/json"),
                        "media":    ("video.mp4", video_file, "video/mp4"),
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

    finally:
        # Clean up the temp download file if we created one
        if tmp_download and os.path.exists(tmp_download):
            os.unlink(tmp_download)


class VideoPipelineService:
    """
    Background pipeline: Veo or Local video generation → YouTube upload.

    Provider precedence:
      1. Veo  (GOOGLE_API_KEY set)        — AI-generated video clips
      2. Local (ELEVENLABS + PEXELS set)  — ElevenLabs voiceover + Pexels stock footage
    """

    def __init__(
        self,
        db: Session,
        video_service=None,   # LocalVideoService | VeoVideoService | None
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

        # Build full script text from the DB record (Fix Bug #6: don't rely on stale dict key)
        script_text = "\n\n".join(p for p in [script.hook, script.body, script.cta] if p)
        caption = script.hook or script_text[:100]

        if self._video:
            await self._generate_with_provider(video, script_text, caption)
        else:
            logger.warning("No video provider configured — marking video %s failed", video_id)
            self._set_failed(video, error="No video provider configured. Set GOOGLE_API_KEY (Veo) or ELEVENLABS_API_KEY + PEXELS_API_KEY (local).")

    async def _generate_with_provider(self, video: Video, script_text: str, caption: str) -> None:
        """Generate video using whichever provider is active (Veo or Local)."""
        try:
            # create_video() just returns a job token — script is passed directly to
            # wait_for_completion() so there is no stale-data path (Fix Bug #6)
            result = await self._video.create_video(script=script_text, aspect_ratio="9:16")
            job_id = result.get("video_id")
            if not job_id:
                raise RuntimeError("LocalVideoService returned no job id")

            video.job_id = job_id
            self.db.commit()

            status_data = await self._video.wait_for_completion(
                job_id, script=script_text, caption_text=caption
            )

            if status_data.get("status") == "failed":
                raise RuntimeError(status_data.get("error") or "Video assembly failed")

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
def get_video_service():
    """
    Return the best available video provider.

    Priority:
      1. Veo  — if GOOGLE_API_KEY is set
      2. Local — if ELEVENLABS_API_KEY + PEXELS_API_KEY are set
      3. None  — no provider; generate endpoint returns 503
    """
    if os.getenv("GOOGLE_API_KEY"):
        try:
            from app.services.veo_service import VeoVideoService   # noqa: PLC0415
            return VeoVideoService()
        except Exception as exc:
            logger.warning("Veo provider init failed (%s) — falling back to local", exc)

    if os.getenv("ELEVENLABS_API_KEY") and os.getenv("PEXELS_API_KEY"):
        return LocalVideoService()

    return None


def get_pipeline(db: Session = Depends(get_db)) -> VideoPipelineService:
    return VideoPipelineService(db=db, video_service=get_video_service())

# Made with Bob
