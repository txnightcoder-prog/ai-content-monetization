"""
Pydantic schemas for the Gumroad → personalised-video pipeline.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.order import OrderStatus


# ── Gumroad Webhook ─────────────────────────────────────────────────────────

class GumroadWebhookPayload(BaseModel):
    """
    Subset of fields Gumroad sends on a `sale` ping-back.
    All fields are optional because Gumroad's actual payload varies by product.
    See: https://help.gumroad.com/article/53-webhooks
    """
    sale_id:        str  = Field(...,  description="Gumroad unique sale identifier")
    product_name:   Optional[str]  = Field(None)
    product_id:     Optional[str]  = Field(None)
    price:          Optional[str]  = Field(None, description="Formatted price string, e.g. '9.99'")
    email:          str  = Field(...,  description="Buyer's email address")
    full_name:      Optional[str]  = Field(None)

    # Child personalisation fields — sent via Gumroad custom fields
    child_name:     Optional[str]  = Field(None, alias="custom_fields[child_name]")
    child_age:      Optional[str]  = Field(None, alias="custom_fields[child_age]")
    hair_colour:    Optional[str]  = Field(None, alias="custom_fields[hair_colour]")
    eye_colour:     Optional[str]  = Field(None, alias="custom_fields[eye_colour]")
    extra_features: Optional[str]  = Field(None, alias="custom_fields[extra_features]")

    model_config = {"populate_by_name": True, "extra": "allow"}


# ── Child Profile ────────────────────────────────────────────────────────────

class ChildProfileResponse(BaseModel):
    id:          UUID
    order_id:    UUID
    child_name:  Optional[str]
    age:         Optional[str]
    hair_colour: Optional[str]
    eye_colour:  Optional[str]
    features:    Optional[str]
    created_at:  datetime

    model_config = {"from_attributes": True}


# ── Order ────────────────────────────────────────────────────────────────────

class OrderResponse(BaseModel):
    id:                 UUID
    gumroad_sale_id:    str
    product_name:       Optional[str]
    price_cents:        Optional[float]
    customer_email:     str
    customer_name:      Optional[str]
    status:             OrderStatus
    error_message:      Optional[str]
    generated_prompt:   Optional[str]
    video_local_path:   Optional[str]
    video_storage_url:  Optional[str]
    email_message_id:   Optional[str]
    created_at:         datetime
    updated_at:         datetime
    child_profile:      Optional[ChildProfileResponse] = None

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    items:     list[OrderResponse]
    total:     int
    page:      int
    page_size: int
    pages:     int


class OrderRetryRequest(BaseModel):
    """POST body for manually retrying a failed order."""
    from_step: Optional[str] = Field(
        None,
        description="Which step to restart from: prompt | video | storage | email. "
                    "Defaults to the step that failed.",
    )

# Made with Bob
