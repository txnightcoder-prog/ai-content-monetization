from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    """Base schema for Product with common fields"""
    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    price: Decimal = Field(..., ge=0, decimal_places=2, description="Product price")
    description: Optional[str] = Field(None, description="Product description")
    active: bool = Field(default=True, description="Whether product is active")


class ProductCreate(ProductBase):
    """Schema for creating a new product"""
    stan_store_product_id: Optional[str] = Field(None, description="Stan Store product ID")


class ProductUpdate(BaseModel):
    """Schema for updating an existing product"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    description: Optional[str] = None
    stan_store_product_id: Optional[str] = None
    active: Optional[bool] = None


class ProductResponse(ProductBase):
    """Schema for product responses"""
    id: UUID
    stan_store_product_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    """Schema for paginated list of products"""
    items: list[ProductResponse]
    total: int
    page: int
    page_size: int
    pages: int

# Made with Bob
