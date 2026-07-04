"""
AI Image Generation Routes (DALL·E 3)
======================================
Endpoints for thumbnail generation, social media packs, and AI avatars.

Powered by DALL·E 3 via your existing OPENAI_API_KEY — no extra key needed.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.services.openart_service import OpenArtService, get_openart_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/openart", tags=["openart"])


# ── Request/Response models ───────────────────────────────────────────────────

class ThumbnailRequest(BaseModel):
    topic: str
    niche: str = "AI tools"
    style: str = "youtube_thumbnail"      # see STYLE_PRESETS in openart_service
    aspect_ratio: str = "16:9"


class ImageRequest(BaseModel):
    prompt: str
    style_preset: Optional[str] = None
    aspect_ratio: str = "16:9"
    n: int = 1


class SocialPackRequest(BaseModel):
    topic: str
    niche: str = "AI tools"


class AvatarRequest(BaseModel):
    description: str = "professional AI content creator, neutral background"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def openart_status(
    service: OpenArtService = Depends(get_openart_service),
):
    """
    Check which image-generation provider is active.
    Returns: { provider, model, status }
    """
    info = await service.get_account_info()
    return info


@router.post("/thumbnail")
async def generate_thumbnail(
    request: ThumbnailRequest,
    service: OpenArtService = Depends(get_openart_service),
):
    """
    **Generate 2 YouTube thumbnail options** for a video topic.

    - Uses OpenArt.ai if OPENART_API_KEY is set.
    - Falls back to DALL·E 3 (hd quality) via OPENAI_API_KEY.

    Returns a list of `{ url, revised_prompt, provider }` objects.
    """
    try:
        images = await service.generate_thumbnail(
            video_topic=request.topic,
            niche=request.niche,
            style=request.style,
            aspect_ratio=request.aspect_ratio,
        )
        return {"images": images, "provider": service.provider}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Thumbnail generation failed")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {exc}")


@router.post("/image")
async def generate_image(
    request: ImageRequest,
    service: OpenArtService = Depends(get_openart_service),
):
    """
    **Generate AI image(s)** from a free-form text prompt.

    Optional `style_preset` values:
    - youtube_thumbnail
    - youtube_shorts_thumbnail
    - social_square
    - ai_avatar
    - tech_diagram
    - motivational
    """
    try:
        images = await service.generate_image(
            prompt=request.prompt,
            style_preset=request.style_preset,
            aspect_ratio=request.aspect_ratio,
            n=min(max(request.n, 1), 4),
        )
        return {"images": images, "provider": service.provider}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Image generation failed")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {exc}")


@router.post("/social-pack")
async def generate_social_pack(
    request: SocialPackRequest,
    service: OpenArtService = Depends(get_openart_service),
):
    """
    **Generate a 3-image social media pack** in parallel:

    1. YouTube thumbnail (16:9 / 1792×1024)
    2. YouTube Shorts / TikTok thumbnail (9:16 / 1024×1792)
    3. Instagram square post (1:1 / 1024×1024)

    Perfect for batch-publishing the same video across all platforms.
    """
    try:
        pack = await service.generate_social_pack(
            video_topic=request.topic,
            niche=request.niche,
        )
        return pack
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Social pack generation failed")
        raise HTTPException(status_code=500, detail=f"Social pack failed: {exc}")


@router.post("/avatar")
async def generate_avatar(
    request: AvatarRequest,
    service: OpenArtService = Depends(get_openart_service),
):
    """
    **Generate a consistent AI presenter avatar**.

    Creates 2 variations of the same character description so you can
    pick the best one to use across all your content.
    """
    try:
        images = await service.generate_avatar(description=request.description)
        return {"images": images, "provider": service.provider}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Avatar generation failed")
        raise HTTPException(status_code=500, detail=f"Avatar generation failed: {exc}")


# Made with Bob
