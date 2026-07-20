"""
Order Processing Pipeline
=========================
Background task that drives an Order through every step after the
Gumroad webhook has been received:

  received → queued → generating → storing → delivering → delivered

Each step is isolated; if one fails the order is marked `failed` and
the error is recorded for manual retry.

Media sources used per step:
  - Character image : ImageService (Imagen 3 → DALL-E 3)
  - Voiceover       : TTSService   (ElevenLabs → Google TTS → OpenAI TTS)
  - Video clips     : ClipService  (Veo 3 → Kling → Pexels → Pixabay)
  - Storage         : StorageService (Azure Blob → S3 → local)
  - Email           : EmailService   (SendGrid → Mailgun → SMTP)
"""

import logging
import os
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.order import Order, OrderStatus, ChildProfile
from app.services.prompt_builder import PromptBuilderService
from app.services.storage_service import StorageService
from app.services.email_service import EmailService
from app.services.image_service import ImageService

logger = logging.getLogger(__name__)


def _set_status(db: Session, order: Order, status: OrderStatus, error: Optional[str] = None):
    order.status        = status
    order.error_message = error
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise


async def process_order(order_id: UUID, db: Session) -> None:
    """
    Full pipeline background task.
    Called from the Gumroad webhook handler after the Order row is persisted.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        logger.error("OrderPipeline: order %s not found", order_id)
        return

    profile: Optional[ChildProfile] = order.child_profile
    logger.info("OrderPipeline: starting for order %s (sale=%s)", order.id, order.gumroad_sale_id)

    # ── Step 1: Mark queued ──────────────────────────────────────────────────
    _set_status(db, order, OrderStatus.QUEUED)

    # ── Step 2: Build AI prompt ──────────────────────────────────────────────
    try:
        builder = PromptBuilderService()
        prompt  = builder.build(
            child_name     = profile.child_name     if profile else None,
            age            = profile.age            if profile else None,
            hair_colour    = profile.hair_colour    if profile else None,
            eye_colour     = profile.eye_colour     if profile else None,
            extra_features = profile.features       if profile else None,
            story_type     = "default",
        )
        order.generated_prompt = prompt
        db.commit()
        logger.info("OrderPipeline: prompt built for order %s", order.id)
    except Exception as exc:
        _set_status(db, order, OrderStatus.FAILED, f"Prompt build failed: {exc}")
        logger.error("OrderPipeline: prompt build failed for %s: %s", order.id, exc)
        return

    # ── Step 3a: Generate character image ────────────────────────────────────
    character_image_path: Optional[str] = None
    if profile:
        try:
            img_svc = ImageService()
            img_output = f"/tmp/videos/char_{order.id}.jpg"
            os.makedirs("/tmp/videos", exist_ok=True)
            character_image_path = await img_svc.generate_character(
                child_name     = profile.child_name or "the child",
                age            = profile.age,
                hair_colour    = profile.hair_colour,
                eye_colour     = profile.eye_colour,
                extra_features = profile.features,
                output_path    = img_output,
                style          = "cartoon",
            )
            logger.info(
                "OrderPipeline: character image generated for order %s → %s",
                order.id, character_image_path,
            )
        except Exception as exc:
            # Non-fatal: video can still be generated without the image
            logger.warning("OrderPipeline: character image failed for %s: %s (continuing)", order.id, exc)

    # ── Step 3b: Generate video ──────────────────────────────────────────────
    _set_status(db, order, OrderStatus.GENERATING)

    video_path: Optional[str] = None
    try:
        from app.services.video_pipeline import get_video_service   # noqa: PLC0415
        video_svc = get_video_service()

        if video_svc is None:
            raise RuntimeError(
                "No video provider configured. "
                "Set GOOGLE_API_KEY or ELEVENLABS_API_KEY + PEXELS_API_KEY."
            )

        result = await video_svc.create_video(script=prompt, aspect_ratio="9:16")
        job_id = result.get("video_id")
        if not job_id:
            raise RuntimeError("Video provider returned no job id")

        status_data = await video_svc.wait_for_completion(
            job_id,
            script=prompt,
            **({"character_image_path": character_image_path} if character_image_path and hasattr(video_svc, '_veo') else {}),
        )
        if status_data.get("status") == "failed":
            raise RuntimeError(status_data.get("error") or "Video generation failed")

        video_path = status_data.get("video_url")
        if not video_path:
            raise RuntimeError("Video provider returned no video_url")

        order.video_local_path = str(video_path)
        db.commit()
        logger.info("OrderPipeline: video generated for order %s → %s", order.id, video_path)

    except Exception as exc:
        _set_status(db, order, OrderStatus.FAILED, f"Video generation failed: {exc}")
        logger.error("OrderPipeline: video generation failed for %s: %s", order.id, exc)
        return

    # ── Step 4: Upload to storage ────────────────────────────────────────────
    _set_status(db, order, OrderStatus.STORING)

    public_url: Optional[str] = None
    try:
        storage   = StorageService()
        filename  = f"order-{order.id}.mp4"
        public_url = await storage.upload(str(video_path), filename=filename)
        order.video_storage_url = public_url
        db.commit()
        logger.info("OrderPipeline: video stored for order %s → %s", order.id, public_url)
    except Exception as exc:
        _set_status(db, order, OrderStatus.FAILED, f"Storage upload failed: {exc}")
        logger.error("OrderPipeline: storage upload failed for %s: %s", order.id, exc)
        return

    # ── Step 5: Send delivery email ──────────────────────────────────────────
    _set_status(db, order, OrderStatus.DELIVERING)

    try:
        emailer  = EmailService()
        msg_id   = await emailer.send_delivery(
            to_email   = order.customer_email,
            to_name    = order.customer_name or "",
            child_name = profile.child_name if profile else None,
            video_url  = public_url,
        )
        order.email_message_id = msg_id
        _set_status(db, order, OrderStatus.DELIVERED)
        logger.info(
            "OrderPipeline: delivery complete for order %s (msg_id=%s)",
            order.id, msg_id,
        )
    except Exception as exc:
        _set_status(db, order, OrderStatus.FAILED, f"Email delivery failed: {exc}")
        logger.error("OrderPipeline: email delivery failed for %s: %s", order.id, exc)

# Made with Bob
