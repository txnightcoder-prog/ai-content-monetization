from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.core.database import get_db
from app.models.conversion import Conversion
from app.schemas.conversion import (
    ConversionCreate,
    ConversionResponse,
    ConversionListResponse,
    ConversionStats,
)

router = APIRouter(prefix="/api/v1/conversions", tags=["conversions"])


@router.post("/", response_model=ConversionResponse, status_code=201)
def create_conversion(
    conversion: ConversionCreate,
    db: Session = Depends(get_db)
):
    """
    Record a new conversion (sale).
    
    This endpoint is typically called from webhooks when a sale occurs.
    """
    try:
        db_conversion = Conversion(**conversion.model_dump())
        db.add(db_conversion)
        db.commit()
        db.refresh(db_conversion)
        return db_conversion
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create conversion: {str(e)}")


@router.get("/", response_model=ConversionListResponse)
def list_conversions(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    lead_id: Optional[UUID] = Query(None, description="Filter by lead ID"),
    product_id: Optional[UUID] = Query(None, description="Filter by product ID"),
    db: Session = Depends(get_db)
):
    """
    List all conversions with pagination and filtering.
    """
    query = db.query(Conversion)
    
    if lead_id:
        query = query.filter(Conversion.lead_id == lead_id)
    if product_id:
        query = query.filter(Conversion.product_id == product_id)
    
    total = query.count()
    conversions = query.offset(skip).limit(limit).all()
    
    return {
        "items": conversions,
        "total": total,
        "page": skip // limit + 1,
        "page_size": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/{conversion_id}", response_model=ConversionResponse)
def get_conversion(
    conversion_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get a specific conversion by ID.
    """
    conversion = db.query(Conversion).filter(Conversion.id == conversion_id).first()
    if not conversion:
        raise HTTPException(status_code=404, detail="Conversion not found")
    return conversion


@router.delete("/{conversion_id}", status_code=204)
def delete_conversion(
    conversion_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Delete a conversion (e.g., refund).
    """
    db_conversion = db.query(Conversion).filter(Conversion.id == conversion_id).first()
    if not db_conversion:
        raise HTTPException(status_code=404, detail="Conversion not found")
    
    try:
        db.delete(db_conversion)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete conversion: {str(e)}")


@router.get("/stats/summary", response_model=ConversionStats)
def get_conversion_stats(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """
    Get conversion statistics for a time period.
    
    Returns total conversions, revenue, average order value, and conversion rate.
    """
    from app.models.lead import Lead
    
    period_start = datetime.now(timezone.utc) - timedelta(days=days)
    period_end = datetime.now(timezone.utc)
    
    # Get conversions in period
    conversions = db.query(Conversion).filter(
        Conversion.created_at >= period_start,
        Conversion.created_at <= period_end
    ).all()
    
    total_conversions = len(conversions)
    total_revenue = sum(c.amount for c in conversions)
    
    # Calculate average order value
    avg_order_value = total_revenue / total_conversions if total_conversions > 0 else Decimal(0)
    
    # Calculate conversion rate (conversions / total leads in period)
    total_leads = db.query(Lead).filter(
        Lead.created_at >= period_start,
        Lead.created_at <= period_end
    ).count()
    
    conversion_rate = (total_conversions / total_leads * 100) if total_leads > 0 else 0.0
    
    return {
        "total_conversions": total_conversions,
        "total_revenue": total_revenue,
        "average_order_value": avg_order_value,
        "conversion_rate": conversion_rate,
        "period_start": period_start,
        "period_end": period_end
    }


@router.get("/stats/by-product", response_model=list[dict])
def get_conversions_by_product(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """
    Get conversion statistics grouped by product.
    """
    from app.models.product import Product
    
    period_start = datetime.now(timezone.utc) - timedelta(days=days)
    
    results = db.query(
        Product.name,
        func.count(Conversion.id).label('count'),
        func.sum(Conversion.amount).label('revenue')
    ).join(
        Conversion, Conversion.product_id == Product.id
    ).filter(
        Conversion.created_at >= period_start
    ).group_by(
        Product.name
    ).all()
    
    return [
        {
            "product_name": r.name,
            "conversions": r.count,
            "revenue": float(r.revenue) if r.revenue else 0.0
        }
        for r in results
    ]

# Made with Bob
