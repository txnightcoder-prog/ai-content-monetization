import logging
import os
import shutil
import uuid as _uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.video import Video, VideoStatus
from app.models.post import Post, Platform, PostStatus
from app.schemas.video import (
    GenerateVideoRequest,
    PublishVideoRequest,
    VideoCreate,
    VideoUpdate,
    VideoResponse,
    VideoListResponse,
)
from app.schemas.post import PostResponse
from app.services.video_pipeline import VideoPipelineService, get_pipeline


class ScheduleVideoRequest(BaseModel):
    platforms: List[str]
    scheduled_at: datetime          # ISO-8601 e.g. "2026-07-04T09:00:00Z"
    caption: Optional[str] = None


# ── Royalty-free music tracks bundled with the app ───────────────────────────
# These are open-licensed tracks from Pixabay / public domain sources.
# Replace URLs with your own CDN paths if you host them yourself.
MUSIC_TRACKS = [
    {"id": "none",         "label": "No music",              "url": None},
    {"id": "upbeat",       "label": "Upbeat Corporate",      "url": "https://cdn.pixabay.com/download/audio/2022/08/25/audio_57d4e1d3fc.mp3"},
    {"id": "motivational", "label": "Motivational Rise",     "url": "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946b63cb84.mp3"},
    {"id": "lofi",         "label": "Lo-Fi Chill",           "url": "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3"},
    {"id": "cinematic",    "label": "Cinematic Dramatic",    "url": "https://cdn.pixabay.com/download/audio/2022/03/15/audio_d1718ab41b.mp3"},
    {"id": "tech",         "label": "Tech/Digital Pulse",    "url": "https://cdn.pixabay.com/download/audio/2023/04/07/audio_7f6f831ad3.mp3"},
]

ELEVENLABS_VOICES = [
    {"id": "21m00Tcm4TlvDq8ikWAM", "label": "Rachel (default) — neutral female"},
    {"id": "29vD33N1CtxCmqQRPOHJ", "label": "Drew — deep male"},
    {"id": "2EiwWnXFnvU5JabPnv8n", "label": "Clyde — warm male"},
    {"id": "5Q0t7uMcjvnagumLfvZi", "label": "Paul — professional male"},
    {"id": "AZnzlk1XvdvUeBnXmlld", "label": "Domi — energetic female"},
    {"id": "EXAVITQu4vr4xnSDxMaL", "label": "Bella — soft female"},
    {"id": "ErXwobaYiN019PkySvjV", "label": "Antoni — conversational male"},
    {"id": "GBv7mTt0atIp3Br8iCZE", "label": "Thomas — calm male"},
    {"id": "IKne3meq5aSn9XLyUdCD", "label": "Charlie — Australian male"},
    {"id": "MF3mGyEYCl7XYWbV9V6O", "label": "Emily — calm female"},
    {"id": "N2lVS1w4EtoT3dr4eOWO", "label": "Ethan — male"},
    {"id": "ODq5zmih8GrVes37Dizd", "label": "Patrick — authoritative male"},
    {"id": "ThT5KcBeYPX3keUQqHPh", "label": "Dorothy — British female"},
    {"id": "TxGEqnHWrfWFTfGW9XjX", "label": "Josh — deep male"},
    {"id": "VR6AewLTigWG4xSOukaG", "label": "Arnold — strong male"},
    {"id": "pNInz6obpgDQGcFmaJgB", "label": "Adam — deep male"},
    {"id": "yoZ06aMxZJJ28mfd3POQ", "label": "Sam — raspy male"},
]

CAPTION_STYLES = [
    {"id": "timed",   "label": "Timed Karaoke — word-by-word pop (default)"},
    {"id": "hook",    "label": "Hook Only — one caption burned at bottom"},
    {"id": "none",    "label": "No captions"},
]


class EditVideoRequest(BaseModel):
    """Options for regenerating a video with different AI settings."""
    script_id: Optional[UUID] = Field(None, description="Use a different script (defaults to original)")
    voice_id: Optional[str]   = Field(None, description="ElevenLabs voice ID — see GET /api/v1/videos/voices")
    broll_keywords: Optional[str] = Field(None, description="Custom keywords for Pexels B-roll search, e.g. 'modern kitchen cooking'")
    music_id: Optional[str]   = Field(None, description="Music track ID — see GET /api/v1/videos/music-tracks")
    caption_style: Optional[str] = Field(None, description="timed | hook | none")
    music_volume: Optional[float] = Field(None, ge=0.0, le=1.0, description="Background music volume 0.0–1.0, default 0.15")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/videos", tags=["videos"])


# ---------------------------------------------------------------------------
# iPhone / manual upload endpoint
# ---------------------------------------------------------------------------

_ALLOWED_TYPES = {"video/mp4", "video/quicktime", "video/mov", "video/mpeg", "video/webm"}
_MAX_BYTES     = 500 * 1024 * 1024   # 500 MB


@router.post("/upload", response_model=VideoResponse, status_code=201)
async def upload_video_file(
    file: UploadFile = File(..., description="Video file from iPhone or any device (MP4, MOV, etc.)"),
    title: Optional[str] = Form(None, description="Optional title / label for this video"),
    db: Session = Depends(get_db),
):
    """
    **Upload a video file directly** (e.g. from an iPhone camera roll).

    - Accepts MP4, MOV, MPEG, WebM up to 500 MB.
    - Saves to the configured VIDEO_OUTPUT_DIR (or /tmp/videos).
    - Creates a Video DB record in `ready` status immediately.
    - The record can then be published to YouTube via `POST /{video_id}/publish`.
    """
    # ── Content-type guard ───────────────────────────────────────────────────
    ct = (file.content_type or "").lower()
    # Some browsers send application/octet-stream for .mov — allow by extension too
    ext = Path(file.filename or "").suffix.lower()
    if ct not in _ALLOWED_TYPES and ext not in {".mp4", ".mov", ".mpeg", ".mpg", ".webm"}:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ct}'. Please upload MP4, MOV, or WebM.",
        )

    # ── Save file ────────────────────────────────────────────────────────────
    output_dir = Path(os.getenv("VIDEO_OUTPUT_DIR", "/tmp/videos"))
    output_dir.mkdir(parents=True, exist_ok=True)

    video_id  = _uuid.uuid4()
    safe_ext  = ext if ext in {".mp4", ".mov", ".mpeg", ".mpg", ".webm"} else ".mp4"
    file_path = output_dir / f"{video_id}{safe_ext}"

    try:
        with open(file_path, "wb") as out:
            total = 0
            while chunk := await file.read(1024 * 1024):   # 1 MB chunks
                total += len(chunk)
                if total > _MAX_BYTES:
                    raise HTTPException(status_code=413, detail="File exceeds 500 MB limit.")
                out.write(chunk)
    except HTTPException:
        if file_path.exists():
            file_path.unlink()
        raise
    except Exception as exc:
        if file_path.exists():
            file_path.unlink()
        logger.exception("Upload failed for %s", video_id)
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")

    logger.info("Uploaded video %s → %s (%d bytes)", video_id, file_path, total)

    # ── Create DB record ─────────────────────────────────────────────────────
    db_video = Video(
        id=video_id,
        script_id=None,                    # no script — manually uploaded
        video_url=str(file_path),
        status=VideoStatus.READY,
        error_message=None,
    )
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    return db_video


# ---------------------------------------------------------------------------
# Reference data endpoints
# ---------------------------------------------------------------------------

@router.get("/voices")
def list_voices():
    """Return the list of available ElevenLabs voices for video generation."""
    return {"voices": ELEVENLABS_VOICES}


@router.get("/music-tracks")
def list_music_tracks():
    """Return the list of available background music tracks."""
    return {"tracks": MUSIC_TRACKS}


@router.get("/caption-styles")
def list_caption_styles():
    """Return available caption style options."""
    return {"styles": CAPTION_STYLES}


# ---------------------------------------------------------------------------
# URL import endpoint
# ---------------------------------------------------------------------------

class ImportUrlRequest(BaseModel):
    url: str = Field(..., description="Direct download URL of an MP4 video (e.g. from Davinci.ai, CapCut, HeyGen)")
    script_id: Optional[UUID] = Field(None, description="Optional: link to an existing script record")
    title: Optional[str] = Field(None, description="Optional label stored in the video record")


@router.post("/import-url", response_model=VideoResponse, status_code=201)
async def import_video_from_url(
    request: ImportUrlRequest,
    db: Session = Depends(get_db),
):
    """
    **Import a video from a direct download URL.**

    Paste any public MP4 URL (e.g. the download link from Davinci.ai, CapCut,
    HeyGen, or any other tool) and the backend will:

    1. Download the MP4 to local storage.
    2. Create a Video record in status `ready`.
    3. Return the record — ready to publish to YouTube / TikTok / etc.

    The URL must point directly to an MP4 file and be publicly accessible
    (no login required to download).
    """
    import ipaddress  # noqa: PLC0415
    from urllib.parse import urlparse  # noqa: PLC0415
    import socket  # noqa: PLC0415

    # ── SSRF prevention — validate URL before making any outbound request ────
    _parsed = urlparse(request.url)
    if _parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    _hostname = _parsed.hostname or ""
    if not _hostname:
        raise HTTPException(status_code=400, detail="Invalid URL — no hostname")

    # Block private/loopback/link-local IPs (cloud metadata, internal services)
    _BLOCKED_RANGES = [
        ipaddress.ip_network("127.0.0.0/8"),    # loopback
        ipaddress.ip_network("10.0.0.0/8"),     # private
        ipaddress.ip_network("172.16.0.0/12"),  # private
        ipaddress.ip_network("192.168.0.0/16"), # private
        ipaddress.ip_network("169.254.0.0/16"), # link-local (AWS/Azure metadata)
        ipaddress.ip_network("::1/128"),        # IPv6 loopback
        ipaddress.ip_network("fc00::/7"),       # IPv6 private
    ]
    try:
        _ip = ipaddress.ip_address(socket.gethostbyname(_hostname))
        for _blocked in _BLOCKED_RANGES:
            if _ip in _blocked:
                raise HTTPException(status_code=400, detail="URL resolves to a private/internal address")
    except (socket.gaierror, ValueError):
        raise HTTPException(status_code=400, detail="Could not resolve URL hostname")

    # Stream-download the file so we don't load the whole thing into memory
    output_dir = Path(os.getenv("VIDEO_OUTPUT_DIR", "/tmp/videos"))
    output_dir.mkdir(parents=True, exist_ok=True)
    dest = output_dir / f"{_uuid.uuid4()}.mp4"

    try:
        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
            async with client.stream("GET", request.url) as response:
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Failed to download video: remote server returned HTTP {response.status_code}",
                    )
                content_type = response.headers.get("content-type", "")
                if content_type and "video" not in content_type and "octet-stream" not in content_type:
                    raise HTTPException(
                        status_code=400,
                        detail=f"URL does not appear to be a video file (content-type: {content_type}). Make sure you paste the direct MP4 download link.",
                    )
                with open(dest, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=1024 * 64):
                        f.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        if dest.exists():
            dest.unlink()
        raise HTTPException(status_code=502, detail=f"Download failed: {exc}")

    file_size = dest.stat().st_size
    if file_size < 1024:
        dest.unlink()
        raise HTTPException(status_code=502, detail="Downloaded file is too small — the URL may not point to a valid MP4.")

    db_video = Video(
        script_id=request.script_id,
        video_url=str(dest),
        status=VideoStatus.READY,
        error_message=None,
    )
    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    logger.info("Imported video from URL to %s (%d bytes) — video id %s", dest, file_size, db_video.id)
    return db_video


# ---------------------------------------------------------------------------
# Pipeline endpoints
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=VideoResponse, status_code=202)
async def generate_video(
    request: GenerateVideoRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    pipeline: VideoPipelineService = Depends(get_pipeline),
):
    """
    **Full pipeline endpoint.**

    1. Creates a Video DB record in status `generating`.
    2. Fires off local video generation (ElevenLabs + Pexels + FFmpeg) as a background task.
    3. When generation completes, the video row is updated to `ready` with the video path.

    Poll `GET /api/v1/videos/{video_id}` to track progress.
    Once `status == ready`, call `POST /api/v1/videos/{video_id}/publish`.

    Returns 503 immediately if ELEVENLABS_API_KEY or PEXELS_API_KEY are not configured,
    rather than creating a DB record that will instantly fail in the background.
    """
    # Reject early if the video provider is not configured (Fix Warn #9)
    if pipeline._video is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Video generation is not configured. "
                "Set ELEVENLABS_API_KEY and PEXELS_API_KEY environment variables to enable it."
            ),
        )

    # Verify the script exists before creating the video row
    from app.models.content_script import ContentScript
    script = db.query(ContentScript).filter(
        ContentScript.id == request.script_id
    ).first()
    if not script:
        raise HTTPException(status_code=404, detail=f"Script {request.script_id} not found")

    # Create the DB record
    db_video = Video(script_id=request.script_id, status=VideoStatus.GENERATING)
    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    # Kick off generation in the background so the response is instant
    background_tasks.add_task(pipeline.generate, db_video.id)
    logger.info("Queued local video generation for video %s (script %s)", db_video.id, request.script_id)

    return db_video


@router.post("/{video_id}/edit", response_model=VideoResponse, status_code=202)
async def edit_video(
    video_id: UUID,
    request: EditVideoRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    pipeline: VideoPipelineService = Depends(get_pipeline),
):
    """
    **AI Video Editor** — regenerate a video with different settings.

    Lets you change voice, B-roll keywords, background music, and caption style
    without re-generating the script. The original video record is reset to
    `generating` status and a new MP4 is produced in the background.

    Poll `GET /api/v1/videos/{video_id}` for status.
    """
    from app.models.content_script import ContentScript

    original = db.query(Video).filter(Video.id == video_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Video not found")

    # Resolve script
    script_id = request.script_id or original.script_id
    if not script_id:
        raise HTTPException(status_code=400, detail="No script linked to this video and none provided")

    script = db.query(ContentScript).filter(ContentScript.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail=f"Script {script_id} not found")

    # Validate options
    music_url: Optional[str] = None
    if request.music_id and request.music_id != "none":
        track = next((t for t in MUSIC_TRACKS if t["id"] == request.music_id), None)
        if not track:
            raise HTTPException(status_code=400, detail=f"Unknown music_id '{request.music_id}'. Call GET /api/v1/videos/music-tracks.")
        music_url = track["url"]

    if request.voice_id:
        known_ids = {v["id"] for v in ELEVENLABS_VOICES}
        if request.voice_id not in known_ids:
            raise HTTPException(status_code=400, detail=f"Unknown voice_id. Call GET /api/v1/videos/voices.")

    caption_style = request.caption_style or "timed"
    if caption_style not in {"timed", "hook", "none"}:
        raise HTTPException(status_code=400, detail="caption_style must be timed | hook | none")

    if pipeline._video is None:
        raise HTTPException(
            status_code=503,
            detail="Video provider not configured. Set ELEVENLABS_API_KEY + PEXELS_API_KEY (or GOOGLE_API_KEY for Veo).",
        )

    # Reset the existing video record so the frontend polls work correctly
    original.status = VideoStatus.GENERATING
    original.script_id = script_id
    original.video_url = None
    original.thumbnail_url = None
    original.duration = None
    original.error_message = None
    db.commit()
    db.refresh(original)

    # Pass edit options to the pipeline via a custom generate call
    background_tasks.add_task(
        _edit_generate,
        pipeline,
        original.id,
        script,
        request.voice_id,
        request.broll_keywords,
        music_url,
        caption_style,
        request.music_volume or 0.15,
    )
    logger.info("Queued video re-generation for video %s with edit options", video_id)
    return original


async def _edit_generate(
    pipeline: "VideoPipelineService",
    video_id: UUID,
    script,
    voice_id: Optional[str],
    broll_keywords: Optional[str],
    music_url: Optional[str],
    caption_style: str,
    music_volume: float,
) -> None:
    """Background task: regenerate video with custom edit options."""
    from app.models.video import Video as _Video, VideoStatus as _VS
    import os as _os

    video = pipeline.db.query(_Video).filter(_Video.id == video_id).first()
    if not video:
        return

    script_text = "\n\n".join(p for p in [script.hook, script.body, script.cta] if p)
    caption = script.hook or script_text[:100]

    if pipeline._video is None:
        pipeline._set_failed(video, error="No video provider configured.")
        return

    # Patch the provider temporarily for this job
    original_provider = pipeline._video

    try:
        # Apply voice override for ElevenLabs local provider
        if voice_id:
            try:
                from app.services.local_video_service import LocalVideoService  # noqa
                from app.services.elevenlabs_service import ElevenLabsService   # noqa
                from app.services.pexels_service import PexelsService            # noqa
                from app.services.video_assembler import VideoAssembler          # noqa

                custom_tts = ElevenLabsService(
                    api_key=_os.getenv("ELEVENLABS_API_KEY"),
                    voice_id=voice_id,
                )
                pipeline._video = LocalVideoService(
                    elevenlabs=custom_tts,
                    timed_captions=(caption_style == "timed"),
                )
            except Exception as exc:
                logger.warning("Could not apply voice override: %s — using default", exc)

        # Apply B-roll keyword override for Pexels
        if broll_keywords and hasattr(pipeline._video, "_pexels"):
            # Monkey-patch the keyword extractor for this job
            pipeline._video._broll_override = broll_keywords

        # Apply caption style
        if hasattr(pipeline._video, "_timed_captions"):
            pipeline._video._timed_captions = (caption_style == "timed")

        result = await pipeline._video.create_video(script=script_text, aspect_ratio="9:16")
        job_id = result.get("video_id")
        if not job_id:
            raise RuntimeError("Provider returned no job id")

        video.job_id = job_id
        pipeline.db.commit()

        # Download music if needed
        bg_music_path: Optional[str] = None
        if music_url:
            import httpx as _httpx
            from pathlib import Path as _Path
            import tempfile as _tf
            tmp_fd, bg_music_path = _tf.mkstemp(suffix=".mp3", prefix="bgmusic_")
            _os.close(tmp_fd)
            try:
                async with _httpx.AsyncClient(timeout=30) as client:
                    r = await client.get(music_url, follow_redirects=True)
                    r.raise_for_status()
                    with open(bg_music_path, "wb") as f:
                        f.write(r.content)
            except Exception as exc:
                logger.warning("Failed to download background music %s: %s", music_url, exc)
                if _os.path.exists(bg_music_path):
                    _os.unlink(bg_music_path)
                bg_music_path = None

        kw = {"script": script_text, "caption_text": caption}
        status_data = await pipeline._video.wait_for_completion(job_id, **kw)

        # Post-process: mix in music if provided and provider returned a raw path
        if bg_music_path and status_data.get("video_url") and _os.path.exists(str(status_data["video_url"])):
            try:
                from app.services.video_assembler import VideoAssembler  # noqa
                asm = VideoAssembler()
                mixed_path = str(status_data["video_url"]).replace(".mp4", "_music.mp4")
                asm._mix_audio(
                    video_path=str(status_data["video_url"]),
                    voice_path=str(status_data["video_url"]),  # already has voice mixed in
                    out=mixed_path,
                    bg_music_path=bg_music_path,
                )
                # Replace output with music-mixed version
                import shutil as _shutil
                _shutil.move(mixed_path, str(status_data["video_url"]))
            except Exception as exc:
                logger.warning("Music mix failed: %s — using video without background music", exc)
            finally:
                if _os.path.exists(bg_music_path):
                    try:
                        _os.unlink(bg_music_path)
                    except OSError:
                        pass

        if status_data.get("status") == "failed":
            raise RuntimeError(status_data.get("error") or "Video edit failed")

        video.video_url     = status_data.get("video_url")
        video.thumbnail_url = status_data.get("thumbnail_url")
        video.duration      = status_data.get("duration")
        video.status        = VideoStatus.READY
        video.error_message = None
        pipeline.db.commit()
        logger.info("Video %s re-generated (edit) successfully", video_id)

    except Exception as exc:
        logger.error("Video edit failed for %s: %s", video_id, exc)
        pipeline._set_failed(video, error=str(exc))
    finally:
        pipeline._video = original_provider


@router.post("/{video_id}/publish", response_model=list[PostResponse], status_code=201)
async def publish_video(
    video_id: UUID,
    request: PublishVideoRequest,
    db: Session = Depends(get_db),
    pipeline: VideoPipelineService = Depends(get_pipeline),
):
    """
    **Distribute a ready video via Buffer.**

    Schedules the video on the requested social platforms.
    Returns a list of Post records (one per platform).

    The video must be in `ready` status (generation complete).
    """
    try:
        posts = await pipeline.publish(
            video_id=video_id,
            platforms=request.platforms,
            caption=request.caption,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return posts


# ---------------------------------------------------------------------------
# Standard CRUD endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=VideoResponse, status_code=201)
def create_video(
    video: VideoCreate,
    db: Session = Depends(get_db),
):
    """
    Create a bare video record without triggering generation.
    Use `POST /generate` to create *and* generate in one step.
    """
    try:
        db_video = Video(**video.model_dump())
        db.add(db_video)
        db.commit()
        db.refresh(db_video)
        return db_video
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create video: {str(e)}")


@router.get("/", response_model=VideoListResponse)
def list_videos(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(10, ge=1, le=100, description="Number of records to return"),
    status: Optional[VideoStatus] = Query(None, description="Filter by status"),
    script_id: Optional[UUID] = Query(None, description="Filter by script ID"),
    db: Session = Depends(get_db),
):
    """List all videos with pagination and optional filtering."""
    query = db.query(Video)

    if status:
        query = query.filter(Video.status == status)
    if script_id:
        query = query.filter(Video.script_id == script_id)

    total = query.count()
    videos = query.offset(skip).limit(limit).all()

    return {
        "items": videos,
        "total": total,
        "page": skip // limit + 1,
        "page_size": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(
    video_id: UUID,
    db: Session = Depends(get_db),
):
    """Get a specific video by ID."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.put("/{video_id}", response_model=VideoResponse)
def update_video(
    video_id: UUID,
    video_update: VideoUpdate,
    db: Session = Depends(get_db),
):
    """Update video metadata (URL, status, duration, etc.)."""
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")

    update_data = video_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_video, field, value)

    try:
        db.commit()
        db.refresh(db_video)
        return db_video
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update video: {str(e)}")


@router.delete("/{video_id}", status_code=204)
def delete_video(
    video_id: UUID,
    db: Session = Depends(get_db),
):
    """Delete a video."""
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")

    try:
        db.delete(db_video)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete video: {str(e)}")


@router.post("/{video_id}/mark-ready", response_model=VideoResponse)
def mark_video_ready(
    video_id: UUID,
    db: Session = Depends(get_db),
):
    """Manually mark a video as ready (useful for externally-generated videos)."""
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")

    db_video.status = VideoStatus.READY
    try:
        db.commit()
        db.refresh(db_video)
        return db_video
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update video status: {str(e)}")


@router.post("/{video_id}/mark-failed", response_model=VideoResponse)
def mark_video_failed(
    video_id: UUID,
    db: Session = Depends(get_db),
):
    """Manually mark a video as failed."""
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")

    db_video.status = VideoStatus.FAILED
    try:
        db.commit()
        db.refresh(db_video)
        return db_video
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update video status: {str(e)}")

@router.get("/{video_id}/srt")
def download_srt(
    video_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Download the SRT subtitle file for a generated video.
    The SRT is saved alongside the MP4 during the Whisper timed-captions step.
    """
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not db_video.video_url:
        raise HTTPException(status_code=404, detail="Video has no associated file")

    srt_path = Path(str(db_video.video_url).replace("_raw.mp4", "").replace(".mp4", ".srt"))
    if not srt_path.exists() or srt_path.stat().st_size == 0:
        raise HTTPException(
            status_code=404,
            detail="No SRT file found for this video. Only videos generated with timed captions have SRT files.",
        )
    return FileResponse(
        path=str(srt_path),
        media_type="text/plain",
        filename=f"captions-{video_id}.srt",
    )


@router.get("/{video_id}/stream")
def stream_video(
    video_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Stream / download the generated video file from the container's local storage.
    This is what the browser calls to preview or download a video whose
    video_url is a local filesystem path (e.g. /tmp/videos/<id>.mp4).
    """
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not db_video.video_url:
        raise HTTPException(status_code=404, detail="Video file not available yet")

    video_path = Path(db_video.video_url)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail=f"Video file not found on disk: {db_video.video_url}")

    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        filename=f"video-{video_id}.mp4",
        headers={"Accept-Ranges": "bytes"},
    )


@router.post("/{video_id}/schedule", response_model=list[PostResponse], status_code=201)
async def schedule_video(
    video_id: UUID,
    request: ScheduleVideoRequest,
    db: Session = Depends(get_db),
):
    """
    Record a scheduled YouTube upload.
    Stores the scheduled_at time in the DB; the actual upload fires when
    you call POST /{video_id}/publish (or a future cron job).
    """
    from app.models.content_script import ContentScript

    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.status != VideoStatus.READY:
        raise HTTPException(
            status_code=400,
            detail=f"Video must be READY before scheduling (current status: {video.status})"
        )
    if not video.video_url:
        raise HTTPException(status_code=400, detail="Video has no URL yet")

    caption = request.caption
    if not caption:
        script = db.query(ContentScript).filter(ContentScript.id == video.script_id).first()
        if script:
            caption = f"{script.hook} {script.cta}".strip()

    created: List[Post] = []
    for platform_name in request.platforms:
        try:
            platform_enum = Platform(platform_name)
        except ValueError:
            continue
        post = Post(
            video_id=video_id,
            platform=platform_enum,
            scheduled_at=request.scheduled_at,
            status=PostStatus.SCHEDULED,
        )
        db.add(post)
        created.append(post)

    db.commit()
    for p in created:
        db.refresh(p)
    return created


# Made with Bob
