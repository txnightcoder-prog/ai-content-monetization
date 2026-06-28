from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.integration import Integration, IntegrationType
from app.schemas.integration import (
    IntegrationCreate,
    IntegrationUpdate,
    IntegrationResponse,
    IntegrationListResponse,
    IntegrationVerifyRequest,
    IntegrationVerifyResponse,
)

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


@router.post("/", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
def create_integration(
    integration: IntegrationCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new integration with API credentials.
    
    Supports:
    - Video Generation: HeyGen, D-ID, Synthesia
    - Social Media: TikTok, Instagram, YouTube, Facebook, Twitter
    - Automation: Buffer, Hootsuite, n8n, Zapier
    - AI Services: OpenAI, ElevenLabs
    """
    db_integration = Integration(
        name=integration.name,
        type=integration.type,
        api_key=integration.api_key,
        api_secret=integration.api_secret,
        access_token=integration.access_token,
        refresh_token=integration.refresh_token,
        config=integration.config,
        is_active=integration.is_active,
    )
    db.add(db_integration)
    db.commit()
    db.refresh(db_integration)
    
    return IntegrationResponse.from_orm_masked(db_integration)


@router.get("/", response_model=IntegrationListResponse)
def list_integrations(
    skip: int = 0,
    limit: int = 100,
    type: IntegrationType | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db)
):
    """List all integrations with optional filtering"""
    query = db.query(Integration)
    
    if type:
        query = query.filter(Integration.type == type)
    if is_active is not None:
        query = query.filter(Integration.is_active == is_active)
    
    total = query.count()
    integrations = query.offset(skip).limit(limit).all()
    
    return IntegrationListResponse(
        integrations=[IntegrationResponse.from_orm_masked(i) for i in integrations],
        total=total
    )


@router.get("/{integration_id}", response_model=IntegrationResponse)
def get_integration(integration_id: str, db: Session = Depends(get_db)):
    """Get a specific integration by ID"""
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    return IntegrationResponse.from_orm_masked(integration)


@router.put("/{integration_id}", response_model=IntegrationResponse)
def update_integration(
    integration_id: str,
    integration_update: IntegrationUpdate,
    db: Session = Depends(get_db)
):
    """Update an integration's credentials or configuration"""
    db_integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    update_data = integration_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_integration, field, value)
    
    db.commit()
    db.refresh(db_integration)
    
    return IntegrationResponse.from_orm_masked(db_integration)


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_integration(integration_id: str, db: Session = Depends(get_db)):
    """Delete an integration"""
    db_integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    db.delete(db_integration)
    db.commit()
    
    return None


@router.post("/{integration_id}/verify", response_model=IntegrationVerifyResponse)
def verify_integration(
    integration_id: str,
    verify_request: IntegrationVerifyRequest = None,
    db: Session = Depends(get_db)
):
    """
    Verify integration credentials by making a test API call.
    
    This will attempt to connect to the service and validate the credentials.
    """
    db_integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Verification not yet implemented — return an honest not-implemented response
    return IntegrationVerifyResponse(
        success=False,
        message="Verification not yet implemented for this integration type.",
        details={"type": db_integration.type, "name": db_integration.name}
    )


@router.post("/{integration_id}/activate", response_model=IntegrationResponse)
def activate_integration(integration_id: str, db: Session = Depends(get_db)):
    """Activate an integration"""
    db_integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    db_integration.is_active = True
    db.commit()
    db.refresh(db_integration)
    
    return IntegrationResponse.from_orm_masked(db_integration)


@router.post("/{integration_id}/deactivate", response_model=IntegrationResponse)
def deactivate_integration(integration_id: str, db: Session = Depends(get_db)):
    """Deactivate an integration"""
    db_integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    db_integration.is_active = False
    db.commit()
    db.refresh(db_integration)
    
    return IntegrationResponse.from_orm_masked(db_integration)


@router.get("/types/available", response_model=List[str])
def get_available_integration_types():
    """Get list of all available integration types"""
    return [t.value for t in IntegrationType]

# Made with Bob
