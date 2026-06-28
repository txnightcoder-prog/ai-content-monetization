from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.models.lead import Lead
from app.schemas.lead import (
    LeadCreate,
    LeadUpdate,
    LeadResponse,
    LeadListResponse,
)

router = APIRouter(prefix="/api/v1/leads", tags=["leads"])


@router.post("/", response_model=LeadResponse, status_code=201)
def create_lead(
    lead: LeadCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new lead (capture email).
    
    This endpoint is typically called from lead capture forms or webhooks.
    """
    # Check if email already exists
    existing_lead = db.query(Lead).filter(Lead.email == lead.email).first()
    if existing_lead:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    try:
        db_lead = Lead(**lead.model_dump())
        db.add(db_lead)
        db.commit()
        db.refresh(db_lead)
        return db_lead
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create lead: {str(e)}")


@router.get("/", response_model=LeadListResponse)
def list_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    source: Optional[str] = Query(None, description="Filter by source"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    db: Session = Depends(get_db)
):
    """
    List all leads with pagination and filtering.
    """
    query = db.query(Lead)
    
    if source:
        query = query.filter(Lead.source == source)
    if tag:
        query = query.filter(Lead.tags.contains([tag]))
    
    total = query.count()
    leads = query.offset(skip).limit(limit).all()
    
    return {
        "items": leads,
        "total": total,
        "page": skip // limit + 1,
        "page_size": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get a specific lead by ID.
    """
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.get("/by-email/{email}", response_model=LeadResponse)
def get_lead_by_email(
    email: str,
    db: Session = Depends(get_db)
):
    """
    Get a lead by email address.
    """
    lead = db.query(Lead).filter(Lead.email == email).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: UUID,
    lead_update: LeadUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing lead.
    """
    db_lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not db_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    update_data = lead_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_lead, field, value)
    
    try:
        db.commit()
        db.refresh(db_lead)
        return db_lead
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update lead: {str(e)}")


@router.delete("/{lead_id}", status_code=204)
def delete_lead(
    lead_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Delete a lead.
    """
    db_lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not db_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    try:
        db.delete(db_lead)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete lead: {str(e)}")


@router.post("/{lead_id}/add-tag", response_model=LeadResponse)
def add_tag_to_lead(
    lead_id: UUID,
    tag: str = Query(..., description="Tag to add"),
    db: Session = Depends(get_db)
):
    """
    Add a tag to a lead for segmentation.
    """
    db_lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not db_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if tag not in db_lead.tags:
        db_lead.tags = db_lead.tags + [tag]
    
    try:
        db.commit()
        db.refresh(db_lead)
        return db_lead
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add tag: {str(e)}")


@router.post("/{lead_id}/remove-tag", response_model=LeadResponse)
def remove_tag_from_lead(
    lead_id: UUID,
    tag: str = Query(..., description="Tag to remove"),
    db: Session = Depends(get_db)
):
    """
    Remove a tag from a lead.
    """
    db_lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not db_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if tag in db_lead.tags:
        db_lead.tags = [t for t in db_lead.tags if t != tag]
    
    try:
        db.commit()
        db.refresh(db_lead)
        return db_lead
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to remove tag: {str(e)}")

# Made with Bob
