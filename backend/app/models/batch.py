from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    batch_code = Column(String(50), unique=True, index=True, nullable=False)
    production_date = Column(DateTime(timezone=True), nullable=False)
    quantity = Column(Integer, nullable=False, default=1000)
    supplier = Column(String(100), nullable=True)
    status = Column(String(30), default="pending", nullable=False) # pending, in_inspection, released, on_hold
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    product = relationship("Product", back_populates="batches")
    inspections = relationship("Inspection", back_populates="batch", cascade="all, delete-orphan")
    decisions = relationship("BatchDecision", back_populates="batch", cascade="all, delete-orphan")
