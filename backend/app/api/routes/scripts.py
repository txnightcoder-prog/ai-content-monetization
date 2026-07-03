import logging
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.models.content_script import ContentScript, ScriptStatus
from app.schemas.content_script import (
    ContentScriptCreate,
    ContentScriptUpdate,
    ContentScriptResponse,
    ContentScriptListResponse,
)
from app.services.openai_service import OpenAIService
from app.services.script_generator import ScriptGenerator
from app.services.parrot_service import ParrotService
from app.services.trending_service import TrendingService

router = APIRouter(prefix="/api/v1/scripts", tags=["scripts"])


class TopicIdeasRequest(BaseModel):
    niche: str


class BlueprintRequest(BaseModel):
    instructions: str
    niche: str


class ParrotRequest(BaseModel):
    youtube_url: str
    niche: str = "AI tools"
    your_topic: Optional[str] = None
    # ── Production customisation ──────────────────────────────────────────────
    style: Optional[str] = None          # e.g. "documentary", "fast-paced", "educational"
    duration: Optional[str] = None       # e.g. "60 seconds", "5 minutes", "10 minutes"
    aspect_ratio: Optional[str] = None   # e.g. "9:16", "16:9", "1:1"
    audio_style: Optional[str] = None    # e.g. "upbeat", "dramatic orchestral", "lo-fi"
    camera_notes: Optional[str] = None   # any specific camera / visual preferences
    video_prompt: Optional[str] = None   # free-form description of the video

    @field_validator("youtube_url")
    @classmethod
    def validate_youtube_url(cls, v: str) -> str:
        parsed = urlparse(v)
        if parsed.netloc not in {"youtube.com", "www.youtube.com", "youtu.be"}:
            raise ValueError("Must be a valid YouTube URL")
        if len(v) > 2048:
            raise ValueError("URL too long")
        return v


class TrendingRequest(BaseModel):
    niche: str = "AI tools"
    count: int = 8


def get_script_generator() -> ScriptGenerator:
    """Dependency to get script generator instance"""
    openai_service = OpenAIService()
    return ScriptGenerator(openai_service)


def get_parrot_service() -> ParrotService:
    openai_service = OpenAIService()
    return ParrotService(openai_service)


def get_trending_service() -> TrendingService:
    openai_service = OpenAIService()
    return TrendingService(openai_service)


@router.post("/generate", response_model=ContentScriptResponse, status_code=201)
async def generate_script(
    topic: str = Query(..., description="Video topic to generate script for"),
    niche: str = Query(default="AI tools", description="Content niche"),
    db: Session = Depends(get_db),
    generator: ScriptGenerator = Depends(get_script_generator)
):
    """
    Generate a new video script using AI.
    
    This endpoint uses OpenAI to create a complete video script with hook, body, and CTA.
    The generated script is automatically saved to the database.
    """
    try:
        logger.info("Generating script for topic: %s, niche: %s", topic, niche)
        script_data = await generator.generate_script(topic=topic, niche=niche)

        db_script = ContentScript(
            topic=topic,
            hook=script_data["hook"],
            body=script_data["body"],
            cta=script_data["cta"],
            status=ScriptStatus.DRAFT,
            script_metadata=script_data.get("metadata", {})
        )

        db.add(db_script)
        db.commit()
        db.refresh(db_script)
        logger.info("Script saved: %s", db_script.id)
        return db_script

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to generate script")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to generate script")


@router.post("/", response_model=ContentScriptResponse, status_code=201)
def create_script(
    script: ContentScriptCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new script manually (without AI generation).
    
    Use this endpoint to create scripts manually or import existing scripts.
    """
    try:
        db_script = ContentScript(**script.model_dump())
        db.add(db_script)
        db.commit()
        db.refresh(db_script)
        return db_script
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create script: {str(e)}")


@router.get("/", response_model=ContentScriptListResponse)
def list_scripts(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(10, ge=1, le=100, description="Number of records to return"),
    status: Optional[ScriptStatus] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db)
):
    """
    List all scripts with pagination and optional filtering.
    """
    try:
        query = db.query(ContentScript)

        if status:
            query = query.filter(ContentScript.status == status)

        total = query.count()
        scripts = query.offset(skip).limit(limit).all()

        return {
            "items": scripts,
            "total": total,
            "page": skip // limit + 1,
            "page_size": limit,
            "pages": (total + limit - 1) // limit
        }
    except Exception:
        logger.exception("Failed to list scripts")
        raise HTTPException(status_code=500, detail="Failed to list scripts")


@router.get("/{script_id}", response_model=ContentScriptResponse)
def get_script(
    script_id: str,
    db: Session = Depends(get_db)
):
    """
    Get a specific script by ID.
    """
    script = db.query(ContentScript).filter(ContentScript.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    return script


@router.put("/{script_id}", response_model=ContentScriptResponse)
def update_script(
    script_id: str,
    script_update: ContentScriptUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing script.
    """
    db_script = db.query(ContentScript).filter(ContentScript.id == script_id).first()
    if not db_script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    # Update only provided fields
    update_data = script_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_script, field, value)
    
    try:
        db.commit()
        db.refresh(db_script)
        return db_script
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update script: {str(e)}")


@router.delete("/{script_id}", status_code=204)
def delete_script(
    script_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a script.
    """
    db_script = db.query(ContentScript).filter(ContentScript.id == script_id).first()
    if not db_script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    try:
        db.delete(db_script)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete script: {str(e)}")


@router.post("/{script_id}/approve", response_model=ContentScriptResponse)
def approve_script(
    script_id: str,
    db: Session = Depends(get_db)
):
    """
    Approve a script (change status to APPROVED).
    """
    db_script = db.query(ContentScript).filter(ContentScript.id == script_id).first()
    if not db_script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    db_script.status = ScriptStatus.APPROVED
    
    try:
        db.commit()
        db.refresh(db_script)
        return db_script
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to approve script: {str(e)}")


@router.post("/{script_id}/reject", response_model=ContentScriptResponse)
def reject_script(
    script_id: str,
    db: Session = Depends(get_db)
):
    """
    Reject a script (change status to REJECTED).
    """
    db_script = db.query(ContentScript).filter(ContentScript.id == script_id).first()
    if not db_script:
        raise HTTPException(status_code=404, detail="Script not found")
    
    db_script.status = ScriptStatus.REJECTED
    
    try:
        db.commit()
        db.refresh(db_script)
        return db_script
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reject script: {str(e)}")


@router.post("/topic-ideas")
async def get_topic_ideas(
    request: TopicIdeasRequest,
    generator: ScriptGenerator = Depends(get_script_generator)
):
    """
    Generate topic ideas for a given niche using AI.
    """
    try:
        ideas = await generator.generate_topic_ideas(niche=request.niche)
        return {"ideas": ideas}
    except Exception as e:
        logger.exception("Failed to generate topic ideas")
        raise HTTPException(status_code=500, detail="Failed to generate topic ideas")


@router.post("/blueprint")
async def generate_blueprint(
    request: BlueprintRequest,
    db: Session = Depends(get_db),
    generator: ScriptGenerator = Depends(get_script_generator)
):
    """
    Generate a comprehensive video blueprint from detailed instructions.
    
    This endpoint processes detailed video instructions and creates a structured
    blueprint with sections, hooks, thumbnails, and monetization strategies.
    """
    try:
        logger.info("Generating blueprint for niche: %s", request.niche)
        blueprint_data = await generator.generate_blueprint(
            instructions=request.instructions,
            niche=request.niche
        )

        db_script = ContentScript(
            topic=blueprint_data.get("title", "Video Blueprint"),
            hook=blueprint_data.get("structure", {}).get("hook", ""),
            body=str(blueprint_data.get("structure", {})),
            cta=blueprint_data.get("structure", {}).get("outro", ""),
            status=ScriptStatus.DRAFT,
            script_metadata=blueprint_data
        )

        db.add(db_script)
        db.commit()
        db.refresh(db_script)

        response_data = {
            "id": db_script.id,
            "created_at": db_script.created_at.isoformat(),
            **blueprint_data
        }
        logger.info("Blueprint saved: %s", db_script.id)
        return response_data

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to generate blueprint")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to generate blueprint")


@router.post("/parrot")
async def parrot_video(
    request: ParrotRequest,
    db: Session = Depends(get_db),
    service: ParrotService = Depends(get_parrot_service),
):
    """
    **Parrot a YouTube video.**

    Paste any YouTube URL. The AI will:
    1. Analyse the video's hook style, structure, tone and why it works.
    2. Generate a full Blueprint that mirrors that structure in YOUR niche.

    Returns source video info + a complete Blueprint ready to use.
    """
    try:
        result = await service.parrot(
            youtube_url=request.youtube_url,
            niche=request.niche,
            your_topic=request.your_topic,
            style=request.style,
            duration=request.duration,
            aspect_ratio=request.aspect_ratio,
            audio_style=request.audio_style,
            camera_notes=request.camera_notes,
            video_prompt=request.video_prompt,
        )

        # Persist the blueprint as a ContentScript for later use
        blueprint  = result.get("blueprint", {})
        structure  = blueprint.get("structure", {})
        voiceover  = blueprint.get("voiceover_script", {})

        # ── Build readable script text from blueprint ─────────────────────
        # Prefer the AI-generated word-for-word voiceover body if present,
        # otherwise assemble from the structured sections so ElevenLabs /
        # video pipeline receives proper prose rather than a dict repr.
        hook_text = (
            voiceover.get("hook") or structure.get("hook") or ""
        )
        cta_text = (
            voiceover.get("cta") or structure.get("outro") or ""
        )

        if voiceover.get("body"):
            body_text = voiceover["body"]
        else:
            parts = []
            if structure.get("intro"):
                parts.append(structure["intro"])
            for section in structure.get("sections", []):
                if section.get("title"):
                    parts.append(section["title"] + ":")
                if section.get("content"):
                    parts.append(section["content"])
            body_text = "\n\n".join(parts) if parts else structure.get("intro", "")

        db_script = ContentScript(
            topic=blueprint.get("title", "Parrot Blueprint"),
            hook=hook_text,
            body=body_text,
            cta=cta_text,
            status=ScriptStatus.DRAFT,
            script_metadata={
                **blueprint,
                "source_video": result.get("source_video", {}),
                "parrot": True,
            },
        )
        db.add(db_script)
        db.commit()
        db.refresh(db_script)

        return {
            "id": str(db_script.id),
            "created_at": db_script.created_at.isoformat(),
            "source_video": result.get("source_video", {}),
            "blueprint": result.get("blueprint", {}),
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Parrot failed")
        db.rollback()
        raise HTTPException(status_code=500, detail="Parrot failed")


@router.post("/trending")
async def get_trending(
    request: TrendingRequest,
    service: TrendingService = Depends(get_trending_service),
):
    """
    **What's trending right now on YouTube, TikTok and Instagram.**

    - YouTube: live Most Popular chart filtered by category (requires YOUTUBE_DATA_API_KEY,
      falls back to AI analysis if key not set).
    - TikTok & Instagram: AI-powered trend analysis (no unofficial APIs).

    Returns up to `count` trending items per platform, each with a suggested
    angle for how YOU can use that trend in your niche.
    """
    try:
        return await service.get_trending(niche=request.niche, count=request.count)
    except Exception as exc:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Trending failed: {exc}")


class AskRequest(BaseModel):
    question: str


@router.post("/ask")
async def ask_ai(
    request: AskRequest,
    openai: OpenAIService = Depends(lambda: OpenAIService()),
):
    """
    **AI Assistant** — ask any question about the platform, content strategy,
    monetization, script writing, or how to grow your YouTube/TikTok channel.

    The assistant knows all about this platform's features and will give
    actionable, specific advice.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    system_message = (
        "You are an expert AI assistant for the AI Content Monetization Platform — "
        "a tool that lets creators generate viral video scripts, create blueprints, "
        "produce faceless videos with ElevenLabs voiceover + Pexels stock footage + FFmpeg, "
        "auto-upload to YouTube, schedule posts, and track analytics. "
        "You also know about content strategy, growing a YouTube/TikTok/Instagram channel, "
        "monetization (YouTube ads, affiliate marketing, sponsorships, digital products), "
        "and AI tools for creators. "
        "Be concise, specific, and actionable. If the question is about a platform feature, "
        "explain exactly how to use it. Keep responses under 300 words."
    )

    try:
        answer = await openai.generate_completion(
            prompt=request.question.strip(),
            system_message=system_message,
            temperature=0.7,
            max_tokens=400,
        )
        return {"answer": answer}
    except Exception as exc:
        logger.exception("AI ask failed")
        raise HTTPException(status_code=500, detail=f"AI assistant unavailable: {exc}")


# Made with Bob
