"""
Order model — persists Gumroad webhook payloads and tracks the full
personalised-video pipeline for each purchase.
"""
import uuid
import enum
from sqlalchemy import Column, String, Text, Numeric, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class OrderStatus(str, enum.Enum):
    RECEIVED   = "received"    # webhook landed, not yet queued
    QUEUED     = "queued"      # placed on the processing queue
    GENERATING = "generating"  # AI prompt built, video generation started
    STORING    = "storing"     # video ready, uploading to cloud storage
    DELIVERING = "delivering"  # emailing the download link to the customer
    DELIVERED  = "delivered"   # email sent successfully
    FAILED     = "failed"      # unrecoverable error


class ChildProfile(Base, TimestampMixin):
    """
    Personalisation details submitted at purchase time.
    One profile per order; contains the character features used to build
    the AI prompt (hair colour, eye colour, age, any extra features).
    """
    __tablename__ = "child_profiles"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id   = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True)

    child_name  = Column(String(100), nullable=True)
    age         = Column(String(20),  nullable=True)   # stored as string ("5", "5-6", etc.)
    hair_colour = Column(String(80),  nullable=True)
    eye_colour  = Column(String(80),  nullable=True)
    features    = Column(Text,        nullable=True)   # free-text extra details

    order = relationship("Order", back_populates="child_profile", uselist=False)

    def __repr__(self) -> str:
        return f"<ChildProfile(order_id={self.order_id}, name={self.child_name})>"


class Order(Base, TimestampMixin):
    """
    One Order per Gumroad sale.
    Tracks the full lifecycle from webhook receipt to email delivery.
    """
    __tablename__ = "orders"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Gumroad fields ──────────────────────────────────────────────────────
    gumroad_sale_id = Column(String(255), unique=True, nullable=False, index=True)
    product_name    = Column(String(255), nullable=True)
    product_id      = Column(String(255), nullable=True)
    price_cents     = Column(Numeric(10, 2), nullable=True)

    # ── Customer ────────────────────────────────────────────────────────────
    customer_email  = Column(String(255), nullable=False, index=True)
    customer_name   = Column(String(255), nullable=True)

    # ── Pipeline state ──────────────────────────────────────────────────────
    status          = Column(SQLEnum(OrderStatus), default=OrderStatus.RECEIVED, nullable=False, index=True)
    error_message   = Column(String(1000), nullable=True)

    # ── Output artefacts ────────────────────────────────────────────────────
    generated_prompt   = Column(Text,        nullable=True)  # built by PromptBuilderService
    video_local_path   = Column(String(500), nullable=True)  # path after generation
    video_storage_url  = Column(String(500), nullable=True)  # public URL after upload
    email_message_id   = Column(String(255), nullable=True)  # SendGrid / Mailgun message id

    # ── Relationships ────────────────────────────────────────────────────────
    child_profile = relationship("ChildProfile", back_populates="order",
                                 cascade="all, delete-orphan", uselist=False)

    def __repr__(self) -> str:
        return f"<Order(id={self.id}, sale={self.gumroad_sale_id}, status={self.status})>"

# Made with Bob
