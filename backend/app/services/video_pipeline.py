import logging
import os
from typing import List, Optional
from uuid import UUID

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.video import Video, VideoStatus
from app.models.post import Post, Platform, PostStatus
from app.models.content_script import ContentScript
from app.services.vicsee_service import VicseeService
from app.services.buffer_service import BufferService, get_profile_ids

logger = logging.getLogger(__name__)


def _build_caption(script: ContentScript) -> str:
    """Combine hook + cta into a social-media caption (≤280 chars safe)."""
    parts = [script.hook, script.cta]
    return " ".join(p for p in parts if p).strip()


class VideoPipelineService:
    """
    Orchestrates the full video pipeline:
      1. Submit script to Vicsee → get vicsee_video_id
      2. Poll Vicsee until the video is ready
      3. Write the video_url back to the Video DB row (status=READY)
      4. (Optional) Schedule posts via Buffer for the requested platforms
    
    Designed to be called from a FastAPI BackgroundTask so the HTTP response
    returns immediately and the heavy work runs in the background.
    """

    def __init__(
        self,
        db: Session,
        vicsee_service: Optional[VicseeService] = None,
        buffer_service: Optional[BufferService] = None,
    ):
        self.db = db
        # Services are optional so the pipeline degrades gracefully when
        # API keys are not yet configured (e.g. during local dev).
        self._vicsee = vicsee_service
        self._buffer = buffer_service

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    async def generate(self, video_id: UUID) -> None:
        """
        Background task: submit generation to Vicsee and poll to completion.
        Updates the Video row in-place; never raises (logs errors instead).
        """
        video = self.db.query(Video).filter(Video.id == video_id).first()
        if not video:
            logger.error("VideoPipeline.generate: video %s not found", video_id)
            return

        script = self.db.query(ContentScript).filter(
            ContentScript.id == video.script_id
        ).first()
        if not script:
            logger.error(
                "VideoPipeline.generate: script %s not found for video %s",
                video.script_id, video_id,
            )
            self._set_failed(video)
            return

        if not self._vicsee:
            logger.warning(
                "VideoPipeline.generate: VicseeService not configured "
                "(set VICSEE_API_KEY). Marking video %s as failed.", video_id
            )
            self._set_failed(video)
            return

        # Combine hook + body + cta into the full script text
        script_text = "\n\n".join(
            part for part in [script.hook, script.body, script.cta] if part
        )

        try:
            logger.info("VideoPipeline: submitting script to Vicsee for video %s", video_id)
            result = await self._vicsee.create_video(
                script=script_text,
                aspect_ratio="9:16",
            )
            vicsee_id = result.get("video_id")
            if not vicsee_id:
                raise RuntimeError("Vicsee returned no video_id")

            # Persist the Vicsee job ID immediately so we can poll/cancel later
            video.heygen_video_id = vicsee_id  # column reused for vicsee id
            self.db.commit()

            logger.info(
                "VideoPipeline: polling Vicsee for completion of video %s (vicsee_id=%s)",
                video_id, vicsee_id,
            )
            status_data = await self._vicsee.wait_for_completion(vicsee_id)

            video.video_url = status_data.get("video_url")
            video.thumbnail_url = status_data.get("thumbnail_url")
            video.duration = status_data.get("duration")
            video.status = VideoStatus.READY
            self.db.commit()
            logger.info("VideoPipeline: video %s is READY (url=%s)", video_id, video.video_url)

        except Exception as exc:
            logger.error(
                "VideoPipeline.generate failed for video %s: %s", video_id, exc
            )
            self._set_failed(video)

    async def publish(
        self,
        video_id: UUID,
        platforms: Optional[List[str]] = None,
        caption: Optional[str] = None,
    ) -> List[Post]:
        """
        Schedule the video on social platforms via Buffer.
        Creates Post DB rows for each platform with status SCHEDULED or FAILED.

        Args:
            video_id:  DB UUID of the Video row.
            platforms: e.g. ["tiktok", "instagram"]. None → all configured profiles.
            caption:   Override caption. Defaults to hook + cta from the linked script.

        Returns:
            List of created Post rows.
        """
        video = self.db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise ValueError(f"Video {video_id} not found")
        if video.status != VideoStatus.READY:
            raise ValueError(
                f"Video {video_id} is not READY (status={video.status}). "
                "Wait for generation to complete before publishing."
            )
        if not video.video_url:
            raise ValueError(f"Video {video_id} has no video_url; cannot publish.")

        # Build caption from script if not supplied
        if caption is None:
            script = self.db.query(ContentScript).filter(
                ContentScript.id == video.script_id
            ).first()
            caption = _build_caption(script) if script else ""

        created_posts: List[Post] = []

        if not self._buffer:
            logger.warning(
                "VideoPipeline.publish: BufferService not configured "
                "(set BUFFER_ACCESS_TOKEN). Creating Post rows as FAILED."
            )
            for platform_name in (platforms or ["tiktok", "instagram", "youtube"]):
                try:
                    platform_enum = Platform(platform_name)
                except ValueError:
                    continue
                post = Post(
                    video_id=video_id,
                    platform=platform_enum,
                    status=PostStatus.FAILED,
                )
                self.db.add(post)
            self.db.commit()
            return created_posts

        try:
            self._buffer.post_to_all_platforms(
                text=caption,
                video_url=str(video.video_url),
                thumbnail_url=str(video.thumbnail_url) if video.thumbnail_url else None,
                platforms=platforms,
            )
            logger.info("VideoPipeline: Buffer accepted post for video %s", video_id)
        except Exception as exc:
            logger.error(
                "VideoPipeline.publish: Buffer call failed for video %s: %s", video_id, exc
            )

        # Persist Post records for every requested/configured platform
        profile_map = get_profile_ids()
        target_platforms = platforms or list(profile_map.keys())
        for platform_name in target_platforms:
            if not profile_map.get(platform_name):
                continue  # not configured
            try:
                platform_enum = Platform(platform_name)
            except ValueError:
                continue
            post = Post(
                video_id=video_id,
                platform=platform_enum,
                status=PostStatus.SCHEDULED,
            )
            self.db.add(post)
            created_posts.append(post)

        self.db.commit()
        for p in created_posts:
            self.db.refresh(p)

        return created_posts

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _set_failed(self, video: Video) -> None:
        video.status = VideoStatus.FAILED
        try:
            self.db.commit()
        except Exception:
            self.db.rollback()


# ------------------------------------------------------------------
# FastAPI dependency helpers
# ------------------------------------------------------------------

def get_vicsee_service() -> Optional[VicseeService]:
    """Return a VicseeService if VICSEE_API_KEY is set, else None."""
    if os.getenv("VICSEE_API_KEY"):
        return VicseeService()
    return None


def get_buffer_service() -> Optional[BufferService]:
    """Return a BufferService if BUFFER_ACCESS_TOKEN is set, else None."""
    if os.getenv("BUFFER_ACCESS_TOKEN"):
        return BufferService()
    return None


def get_pipeline(db: Session = Depends(get_db)) -> VideoPipelineService:
    return VideoPipelineService(
        db=db,
        vicsee_service=get_vicsee_service(),
        buffer_service=get_buffer_service(),
    )

# Made with Bob
