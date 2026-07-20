"""
Gumroad → Personalised Video — API Routes
==========================================

POST /api/v1/orders/webhook/gumroad
    Receives the Gumroad sale ping-back, persists the Order + ChildProfile,
    and fires off the background processing pipeline.
    Returns 200 immediately (Gumroad expects a fast response).

GET  /api/v1/orders/
    Paginated list of all orders (admin use).

GET  /api/v1/orders/{order_id}
    Single order detail with child profile.

POST /api/v1/orders/{order_id}/retry
    Re-queue a failed order from a specific step.
"""

import hashlib
import hmac
import logging
import os
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Header, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.order import Order, OrderStatus, ChildProfile
from app.schemas.order import (
    GumroadWebhookPayload,
    OrderListResponse,
    OrderResponse,
    OrderRetryRequest,
)
from app.services.order_pipeline import process_order

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])

# ── Gumroad webhook secret (optional — set GUMROAD_WEBHOOK_SECRET to verify) ─
_GUMROAD_SECRET = os.getenv("GUMROAD_WEBHOOK_SECRET", "")


def _verify_gumroad_signature(body: bytes, sig_header: Optional[str]) -> None:
    """
    Verify HMAC-SHA256 signature from Gumroad if GUMROAD_WEBHOOK_SECRET is set.
    Skips verification when the secret is not configured (dev / test).
    """
    if not _GUMROAD_SECRET:
        return
    if not sig_header:
        raise HTTPException(status_code=401, detail="Missing X-Gumroad-Signature header")
    expected = hmac.new(
        _GUMROAD_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, sig_header):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


# ---------------------------------------------------------------------------
# Webhook endpoint
# ---------------------------------------------------------------------------

@router.post("/webhook/gumroad", status_code=200)
async def gumroad_webhook(
    request:          Request,
    background_tasks: BackgroundTasks,
    x_gumroad_sig:    Optional[str] = Header(None, alias="X-Gumroad-Signature"),
    db:               Session       = Depends(get_db),
):
    """
    **Gumroad Webhook — Order API Service**

    Receives a `sale` event from Gumroad when a customer purchases your product.

    1. Verifies the HMAC signature (if `GUMROAD_WEBHOOK_SECRET` is set).
    2. Parses the form-encoded body (Gumroad sends `application/x-www-form-urlencoded`).
    3. Persists the `Order` + `ChildProfile` rows.
    4. Fires the background pipeline: Prompt → Video → Storage → Email.

    Gumroad expects a **200 OK** response within a few seconds — heavy work
    runs in the background.

    Configure in Gumroad: Dashboard → Settings → Advanced → Webhooks → Add URL.
    """
    # ── Read & verify raw body ───────────────────────────────────────────────
    raw_body = await request.body()
    _verify_gumroad_signature(raw_body, x_gumroad_sig)

    # ── Parse form-encoded body ──────────────────────────────────────────────
    form = await request.form()
    data = dict(form)

    # Flatten Gumroad's bracket notation for custom fields
    # e.g. "custom_fields[child_name]" → kept as-is so Pydantic alias handles it
    try:
        payload = GumroadWebhookPayload(**data)
    except Exception as exc:
        # Log full detail server-side only — never expose to caller
        logger.warning("Gumroad webhook payload validation error: %s | raw keys: %s", exc, list(data.keys()))
        # Still return 200 so Gumroad doesn't retry indefinitely
        return {"status": "ignored", "reason": "Invalid payload"}

    # ── Idempotency — skip duplicate sale events ─────────────────────────────
    existing = db.query(Order).filter(
        Order.gumroad_sale_id == payload.sale_id
    ).first()
    if existing:
        logger.info("Gumroad webhook: duplicate sale_id=%s — skipping", payload.sale_id)
        return {"status": "duplicate", "order_id": str(existing.id)}

    # ── Persist Order ────────────────────────────────────────────────────────
    price_val: Optional[float] = None
    if payload.price:
        try:
            price_val = float(payload.price.replace("$", "").strip())
        except ValueError:
            pass

    order = Order(
        gumroad_sale_id = payload.sale_id,
        product_name    = payload.product_name,
        product_id      = payload.product_id,
        price_cents     = price_val,
        customer_email  = payload.email,
        customer_name   = payload.full_name,
        status          = OrderStatus.RECEIVED,
    )
    db.add(order)
    db.flush()   # get order.id before ChildProfile FK

    # ── Persist ChildProfile ─────────────────────────────────────────────────
    profile = ChildProfile(
        order_id    = order.id,
        child_name  = payload.child_name,
        age         = payload.child_age,
        hair_colour = payload.hair_colour,
        eye_colour  = payload.eye_colour,
        features    = payload.extra_features,
    )
    db.add(profile)
    db.commit()
    db.refresh(order)

    logger.info(
        "Gumroad webhook: new order %s for %s (sale=%s)",
        order.id, order.customer_email, order.gumroad_sale_id,
    )

    # ── Kick off the processing pipeline ────────────────────────────────────
    background_tasks.add_task(process_order, order.id, db)

    return {"status": "queued", "order_id": str(order.id)}


# ---------------------------------------------------------------------------
# Admin / management endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=OrderListResponse)
def list_orders(
    skip:   int                    = Query(0,    ge=0),
    limit:  int                    = Query(20,   ge=1, le=100),
    status: Optional[OrderStatus]  = Query(None, description="Filter by pipeline status"),
    db:     Session                = Depends(get_db),
):
    """List all orders with optional status filter and pagination."""
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    q = q.order_by(Order.created_at.desc())

    total  = q.count()
    orders = q.offset(skip).limit(limit).all()

    return {
        "items":     orders,
        "total":     total,
        "page":      skip // limit + 1,
        "page_size": limit,
        "pages":     (total + limit - 1) // limit,
    }


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: UUID, db: Session = Depends(get_db)):
    """Retrieve a single order and its child profile."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/{order_id}/retry", response_model=OrderResponse, status_code=202)
async def retry_order(
    order_id:         UUID,
    request:          OrderRetryRequest,
    background_tasks: BackgroundTasks,
    db:               Session = Depends(get_db),
):
    """
    **Retry a failed order.**

    Re-enqueues the background pipeline starting from the failed step.
    Only orders in `failed` status can be retried.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in (OrderStatus.FAILED, OrderStatus.RECEIVED):
        raise HTTPException(
            status_code=400,
            detail=f"Order is not in a retriable state (status={order.status}). "
                   "Only 'failed' or 'received' orders can be retried.",
        )

    # Reset to received so the pipeline starts cleanly
    order.status        = OrderStatus.RECEIVED
    order.error_message = None
    db.commit()
    db.refresh(order)

    background_tasks.add_task(process_order, order.id, db)
    logger.info("Order %s manually re-queued", order_id)
    return order

# Made with Bob
