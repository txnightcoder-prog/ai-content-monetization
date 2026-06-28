from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from app.models.integration import IntegrationType


class IntegrationBase(BaseModel):
    """Base schema for Integration"""
    name: str = Field(..., description="User-friendly name for the integration")
    type: IntegrationType = Field(..., description="Type of integration")
    api_key: Optional[str] = Field(None, description="API key for the service")
    api_secret: Optional[str] = Field(None, description="API secret for the service")
    access_token: Optional[str] = Field(None, description="OAuth access token")
    refresh_token: Optional[str] = Field(None, description="OAuth refresh token")
    config: Dict[str, Any] = Field(default_factory=dict, description="Additional configuration")
    is_active: bool = Field(default=True, description="Whether integration is active")


class IntegrationCreate(IntegrationBase):
    """Schema for creating a new integration"""
    pass


class IntegrationUpdate(BaseModel):
    """Schema for updating an integration"""
    name: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class IntegrationResponse(IntegrationBase):
    """Schema for integration response"""
    id: str
    is_verified: bool
    last_verified_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # Mask sensitive data in responses
    api_key: Optional[str] = Field(None, description="Masked API key")
    api_secret: Optional[str] = Field(None, description="Masked API secret")
    access_token: Optional[str] = Field(None, description="Masked access token")
    refresh_token: Optional[str] = Field(None, description="Masked refresh token")

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_masked(cls, obj):
        """Create response with masked credentials"""
        data = {
            "id": obj.id,
            "name": obj.name,
            "type": obj.type,
            "api_key": cls._mask_credential(obj.api_key),
            "api_secret": cls._mask_credential(obj.api_secret),
            "access_token": cls._mask_credential(obj.access_token),
            "refresh_token": cls._mask_credential(obj.refresh_token),
            "config": obj.config,
            "is_active": obj.is_active,
            "is_verified": obj.is_verified,
            "last_verified_at": obj.last_verified_at,
            "created_at": obj.created_at,
            "updated_at": obj.updated_at,
        }
        return cls(**data)
    
    @staticmethod
    def _mask_credential(credential: Optional[str]) -> Optional[str]:
        """Mask credential showing only last 4 characters"""
        if not credential:
            return None
        if len(credential) <= 4:
            return "****"
        return f"****{credential[-4:]}"


class IntegrationListResponse(BaseModel):
    """Schema for list of integrations"""
    integrations: list[IntegrationResponse]
    total: int


class IntegrationVerifyRequest(BaseModel):
    """Schema for verifying integration credentials"""
    test_endpoint: Optional[str] = Field(None, description="Optional test endpoint to verify")


class IntegrationVerifyResponse(BaseModel):
    """Schema for verification response"""
    success: bool
    message: str
    details: Optional[Dict[str, Any]] = None

# Made with Bob
