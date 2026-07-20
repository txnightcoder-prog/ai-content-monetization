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
from app.services.script_generator import ScriptGenerator
from app.services.parrot_service import ParrotService
from app.services.trending_service import TrendingService
from app.services.optimize_service import OptimizeService
from app.services.keyword_service import KeywordService
from app.services.top_performers_service import (
    get_top_performers,
    generate_ideas_from_top_performers,
)

router = APIRouter(prefix="/api/v1/scripts", tags=["scripts"])


class TopicIdeasRequest(BaseModel):
    niche: str


class BlueprintRequest(BaseModel):
    instructions: str
    niche: str


class OptimizeRequest(BaseModel):
    topic: str
    niche: str = "AI tools"
    hook: Optional[str] = None
    body: Optional[str] = None
    cta: Optional[str] = None


class KeywordRequest(BaseModel):
    topic: str
    niche: str = "AI tools"
    count: int = 10


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


def _make_ai_service():
    """Auto-selects GeminiService or OpenAIService based on available keys."""
    import os
    if os.getenv("OPENAI_API_KEY"):
        from app.services.openai_service import OpenAIService
        return OpenAIService()
    from app.services.gemini_service import GeminiService
    return GeminiService()


def get_script_generator() -> ScriptGenerator:
    return ScriptGenerator()


def get_parrot_service() -> ParrotService:
    return ParrotService()


def get_trending_service() -> TrendingService:
    return TrendingService()


def get_optimize_service() -> OptimizeService:
    return OptimizeService()


def get_keyword_service() -> KeywordService:
    return KeywordService()


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
    openai=Depends(_make_ai_service),
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


@router.post("/optimize")
async def optimize_script(
    request: OptimizeRequest,
    service: OptimizeService = Depends(get_optimize_service),
):
    """
    **YouTube SEO Optimizer** — generate titles, description, and tags for a video.

    Given a topic and optional script text, returns:
    - 10 title options ranked by click-through potential
    - A full SEO-optimised YouTube description with hashtags
    - 20 keyword tags ordered by relevance
    - Content pack with best posting time and monetization estimate
    """
    try:
        return await service.optimize(
            topic=request.topic,
            niche=request.niche,
            hook=request.hook,
            body=request.body,
            cta=request.cta,
        )
    except Exception as exc:
        logger.exception("Optimize failed")
        raise HTTPException(status_code=500, detail=f"Optimize failed: {exc}")


@router.post("/keywords")
async def keyword_research(
    request: KeywordRequest,
    service: KeywordService = Depends(get_keyword_service),
):
    """
    **Keyword Research** — find the best YouTube search terms for a topic.

    Returns keywords with:
    - Search volume estimate (High/Medium/Low)
    - Competition level
    - Opportunity score (1-10)
    - Real YouTube result counts (if YOUTUBE_DATA_API_KEY is set)
    - Long-tail variants
    - Suggested video title per keyword
    """
    if request.count < 1 or request.count > 20:
        raise HTTPException(status_code=400, detail="count must be between 1 and 20")
    try:
        return await service.research(
            topic=request.topic,
            niche=request.niche,
            count=request.count,
        )
    except Exception as exc:
        logger.exception("Keyword research failed")
        raise HTTPException(status_code=500, detail=f"Keyword research failed: {exc}")


# ── Top Performers — AI Feedback Loop ────────────────────────────────────────

@router.get("/top-performers")
def get_top_performers_route(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    **Top Performing Videos** — ranked by weighted engagement score.

    Returns up to ``limit`` analytics records ordered by:
        views + (likes × 10) + (comments × 5)

    Use this to see which topics are resonating before generating new content.
    """
    results = get_top_performers(db, limit=limit)
    return {
        "top_performers": results,
        "count": len(results),
        "data_available": len(results) > 0,
    }


class TrendingQueueRequest(BaseModel):
    niche: str = "AI tools"
    count: int = 5   # Number of trending items to convert (max 8)


@router.post("/trending-to-queue")
async def trending_to_queue(
    request: TrendingQueueRequest,
    db: Session = Depends(get_db),
    generator: ScriptGenerator = Depends(get_script_generator),
    trending: TrendingService = Depends(get_trending_service),
):
    """
    **One-click: Fetch trending → Auto-generate scripts for all of them.**

    1. Fetches the top ``count`` trending topics for your niche across YouTube, TikTok & Instagram.
    2. Deduplicates overlapping topics across platforms.
    3. Generates a full Hook/Body/CTA script for each in parallel.
    4. Saves all scripts to the database immediately.

    Returns a list of ContentScript records ready to use for video generation.
    Typical run time: 15–30 seconds for 5 scripts.
    """
    import asyncio as _asyncio

    count = max(1, min(request.count, 8))

    logger.info("trending-to-queue: fetching trends for niche '%s'", request.niche)
    try:
        trends = await trending.get_trending(niche=request.niche, count=count)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch trending topics: {exc}")

    # Build a deduplicated topic list — prefer use_for_niche (the actionable angle)
    seen: set = set()
    topics: list[str] = []
    for platform in ("youtube", "tiktok", "instagram"):
        for item in trends.get(platform, []):
            angle = item.get("use_for_niche") or item.get("title") or ""
            key = angle.lower()[:60]
            if angle and key not in seen:
                seen.add(key)
                topics.append(angle)
            if len(topics) >= count:
                break
        if len(topics) >= count:
            break

    if not topics:
        raise HTTPException(status_code=502, detail="Trending service returned no usable topics")

    logger.info("trending-to-queue: generating %d scripts for topics: %s", len(topics), topics)

    # Generate all scripts in parallel
    async def _generate_one(topic: str):
        try:
            data = await generator.generate_script(topic=topic, niche=request.niche)
            script = ContentScript(
                topic=topic,
                hook=data["hook"],
                body=data["body"],
                cta=data["cta"],
                status=ScriptStatus.DRAFT,
                script_metadata={**data.get("metadata", {}), "auto_queued": True, "source": "trending"},
            )
            db.add(script)
            return script
        except Exception as exc:
            logger.warning("Failed to generate script for '%s': %s", topic, exc)
            return None

    results = await _asyncio.gather(*[_generate_one(t) for t in topics])
    scripts = [s for s in results if s is not None]

    if not scripts:
        db.rollback()
        raise HTTPException(status_code=500, detail="All script generations failed")

    try:
        db.commit()
        for s in scripts:
            db.refresh(s)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save scripts: {exc}")

    logger.info("trending-to-queue: saved %d scripts", len(scripts))
    return {
        "count": len(scripts),
        "niche": request.niche,
        "topics": [s.topic for s in scripts],
        "scripts": [
            {
                "id": str(s.id),
                "topic": s.topic,
                "hook": s.hook,
                "body": s.body,
                "cta": s.cta,
                "created_at": s.created_at.isoformat(),
            }
            for s in scripts
        ],
    }


class TopPerformersRequest(BaseModel):
    niche: str = "AI tools"
    count: int = 10


@router.post("/generate-from-top-performers")
async def generate_from_top_performers(
    request: TopPerformersRequest,
    db: Session = Depends(get_db),
    openai=Depends(_make_ai_service),
):
    """
    **AI Feedback Loop** — generate new topic ideas biased toward what's
    already performing well on your channel.

    1. Queries your analytics table for top-performing videos.
    2. Extracts patterns from titles and engagement data.
    3. Asks GPT to generate new ideas following the same winning formula.

    If no analytics data exists yet, falls back to standard idea generation
    and returns ``data_available: false`` so the frontend can show a notice.
    """
    try:
        result = await generate_ideas_from_top_performers(
            db=db,
            openai=openai,
            niche=request.niche,
            count=request.count,
        )
        return result
    except Exception as exc:
        logger.exception("generate-from-top-performers failed")
        raise HTTPException(status_code=500, detail=f"Failed: {exc}")


# Made with Bob
