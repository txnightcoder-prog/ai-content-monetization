import uuid
from sqlalchemy import Column, String, Text, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    """Model for products being sold"""
    
    __tablename__ = "products"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    description = Column(Text, nullable=True)
    stan_store_product_id = Column(String(255), nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    conversions = relationship("Conversion", back_populates="product", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Product(id={self.id}, name={self.name}, price=${self.price})>"

# Made with Bob
