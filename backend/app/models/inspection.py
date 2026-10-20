from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    inspector_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_reference = Column(String(100), nullable=False, index=True) # e.g. TILE-A1-04, distinct physical item
    sample_type = Column(String(50), nullable=False, default="individual_tile") # individual_tile, surface_sample, batch_sample
    location = Column(String(100), nullable=True) # e.g. Kiln 2 Exit, Setting Bed 4, Packaging Line A
    notes = Column(Text, nullable=True)           # Inspector observations
    status = Column(String(40), default="submitted", nullable=False) # submitted, ai_processing, ai_completed, ai_failed, in_review, confirmed_defect, confirmed_good, reinspected, closed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch", back_populates="inspections")
    inspector = relationship("User", back_populates="inspections")
    images = relationship("InspectionImage", back_populates="inspection", cascade="all, delete-orphan")
    model_results = relationship("ModelResult", back_populates="inspection", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="inspection", cascade="all, delete-orphan")
    defects = relationship("Defect", back_populates="inspection", cascade="all, delete-orphan")
    follow_up_actions = relationship("CorrectiveAction", foreign_keys="CorrectiveAction.follow_up_inspection_id", back_populates="follow_up_inspection")
