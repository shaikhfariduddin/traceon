from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class InspectionImage(Base):
    __tablename__ = "inspection_images"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False) # SHA-256 integrity hash
    file_size = Column(Integer, nullable=False)     # Size in bytes
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    blur_score = Column(Float, nullable=True)       # Laplacian variance
    brightness_score = Column(Float, nullable=True) # Mean luminance
    is_uncertain = Column(Boolean, default=False)   # True if blur/illumination fails threshold
    quality_notes = Column(Text, nullable=True)     # Notes on image quality checks
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inspection = relationship("Inspection", back_populates="images")
    model_results = relationship("ModelResult", back_populates="image", cascade="all, delete-orphan")
