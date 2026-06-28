import uuid
from sqlalchemy import Column, String, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Conversion(Base, TimestampMixin):
    """Model for tracking product conversions/sales"""
    
    __tablename__ = "conversions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    stan_store_order_id = Column(String(255), nullable=True)
    
    # Relationships
    lead = relationship("Lead", back_populates="conversions")
    product = relationship("Product", back_populates="conversions")
    
    def __repr__(self):
        return f"<Conversion(id={self.id}, amount=${self.amount}, lead_id={self.lead_id})>"

# Made with Bob
