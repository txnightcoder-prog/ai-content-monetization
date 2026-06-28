from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel

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

router = APIRouter(prefix="/api/v1/scripts", tags=["scripts"])


class TopicIdeasRequest(BaseModel):
    niche: str


class BlueprintRequest(BaseModel):
    instructions: str
    niche: str


def get_script_generator() -> ScriptGenerator:
    """Dependency to get script generator instance"""
    openai_service = OpenAIService()
    return ScriptGenerator(openai_service)


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
        print(f"Generating script for topic: {topic}, niche: {niche}")
        
        # Generate script using AI (now async)
        script_data = await generator.generate_script(topic=topic, niche=niche)
        print(f"Script generated successfully: {script_data}")
        
        # Create database record
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
        
        print(f"Script saved to database with ID: {db_script.id}")
        return db_script
        
    except ValueError as e:
        print(f"ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Exception: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate script: {str(e)}")


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
        print(f"Exception generating topic ideas: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate topic ideas: {str(e)}")


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
        print(f"Generating blueprint for niche: {request.niche}")
        print(f"Instructions length: {len(request.instructions)} characters")
        
        # Generate blueprint using AI
        blueprint_data = await generator.generate_blueprint(
            instructions=request.instructions,
            niche=request.niche
        )
        
        print(f"Blueprint generated successfully")
        
        # Create a simplified database record (using existing ContentScript model)
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
        
        # Return the full blueprint data with the database ID
        response_data = {
            "id": db_script.id,
            "created_at": db_script.created_at.isoformat(),
            **blueprint_data
        }
        
        print(f"Blueprint saved to database with ID: {db_script.id}")
        return response_data
        
    except ValueError as e:
        print(f"ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Exception: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate blueprint: {str(e)}")


# Made with Bob
