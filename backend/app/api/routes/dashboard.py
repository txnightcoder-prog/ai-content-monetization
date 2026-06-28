from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.models.content_script import ContentScript, ScriptStatus
from app.models.video import Video, VideoStatus
from app.models.post import Post, PostStatus
from app.models.lead import Lead
from app.models.conversion import Conversion

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/metrics")
def get_dashboard_metrics(db: Session = Depends(get_db)) -> dict:
    """
    Get overview metrics for the dashboard.
    
    Returns counts and statistics for scripts, videos, posts, leads, and revenue.
    """
    # Get counts
    total_scripts = db.query(ContentScript).count()
    total_videos = db.query(Video).count()
    total_posts = db.query(Post).count()
    total_leads = db.query(Lead).count()
    
    # Get status breakdowns
    scripts_by_status = db.query(
        ContentScript.status,
        func.count(ContentScript.id)
    ).group_by(ContentScript.status).all()
    
    videos_by_status = db.query(
        Video.status,
        func.count(Video.id)
    ).group_by(Video.status).all()
    
    posts_by_status = db.query(
        Post.status,
        func.count(Post.id)
    ).group_by(Post.status).all()
    
    # Get revenue (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    revenue_30d = db.query(func.sum(Conversion.amount)).filter(
        Conversion.created_at >= thirty_days_ago
    ).scalar() or 0
    
    # Get recent activity
    recent_scripts = db.query(ContentScript).order_by(
        ContentScript.created_at.desc()
    ).limit(5).all()
    
    recent_videos = db.query(Video).order_by(
        Video.created_at.desc()
    ).limit(5).all()
    
    return {
        "overview": {
            "total_scripts": total_scripts,
            "total_videos": total_videos,
            "total_posts": total_posts,
            "total_leads": total_leads,
            "revenue_30d": float(revenue_30d)
        },
        "scripts_by_status": {str(status): count for status, count in scripts_by_status},
        "videos_by_status": {str(status): count for status, count in videos_by_status},
        "posts_by_status": {str(status): count for status, count in posts_by_status},
        "recent_scripts": [
            {
                "id": str(script.id),
                "topic": script.topic,
                "status": script.status,
                "created_at": script.created_at.isoformat()
            }
            for script in recent_scripts
        ],
        "recent_videos": [
            {
                "id": str(video.id),
                "status": video.status,
                "created_at": video.created_at.isoformat()
            }
            for video in recent_videos
        ]
    }


@router.get("/revenue")
def get_revenue_metrics(
    days: int = 30,
    db: Session = Depends(get_db)
) -> dict:
    """
    Get revenue metrics for the specified time period.
    """
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Total revenue
    total_revenue = db.query(func.sum(Conversion.amount)).filter(
        Conversion.created_at >= start_date
    ).scalar() or 0
    
    # Number of conversions
    total_conversions = db.query(Conversion).filter(
        Conversion.created_at >= start_date
    ).count()
    
    # Average order value
    avg_order_value = float(total_revenue) / total_conversions if total_conversions > 0 else 0
    
    # Revenue by product
    revenue_by_product = db.query(
        Conversion.product_id,
        func.sum(Conversion.amount),
        func.count(Conversion.id)
    ).filter(
        Conversion.created_at >= start_date
    ).group_by(Conversion.product_id).all()
    
    return {
        "period_days": days,
        "total_revenue": float(total_revenue),
        "total_conversions": total_conversions,
        "average_order_value": avg_order_value,
        "revenue_by_product": [
            {
                "product_id": str(product_id),
                "revenue": float(revenue),
                "conversions": count
            }
            for product_id, revenue, count in revenue_by_product
        ]
    }


@router.get("/funnel")
def get_funnel_metrics(db: Session = Depends(get_db)) -> dict:
    """
    Get conversion funnel metrics.
    
    Shows the flow from views → clicks → leads → conversions.
    """
    # Get counts for each stage
    total_posts = db.query(Post).filter(Post.status == PostStatus.POSTED).count()
    total_leads = db.query(Lead).count()
    total_conversions = db.query(Conversion).count()
    
    # Calculate conversion rates
    lead_conversion_rate = (total_conversions / total_leads * 100) if total_leads > 0 else 0
    
    return {
        "funnel_stages": {
            "posts_published": total_posts,
            "leads_captured": total_leads,
            "conversions": total_conversions
        },
        "conversion_rates": {
            "lead_to_customer": round(lead_conversion_rate, 2)
        }
    }

# Made with Bob
