from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field


class ConversionBase(BaseModel):
    """Base schema for Conversion with common fields"""
    amount: Decimal = Field(..., ge=0, decimal_places=2, description="Conversion amount")
    stan_store_order_id: Optional[str] = Field(None, description="Stan Store order ID")


class ConversionCreate(ConversionBase):
    """Schema for creating a new conversion"""
    lead_id: UUID = Field(..., description="ID of the lead who converted")
    product_id: UUID = Field(..., description="ID of the product purchased")


class ConversionResponse(ConversionBase):
    """Schema for conversion responses"""
    id: UUID
    lead_id: UUID
    product_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversionListResponse(BaseModel):
    """Schema for paginated list of conversions"""
    items: list[ConversionResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ConversionStats(BaseModel):
    """Schema for conversion statistics"""
    total_conversions: int
    total_revenue: Decimal
    average_order_value: Decimal
    conversion_rate: float
    period_start: datetime
    period_end: datetime

# Made with Bob
