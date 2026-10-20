from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class ModelResult(Base):
    __tablename__ = "model_results"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False, index=True)
    image_id = Column(Integer, ForeignKey("inspection_images.id"), nullable=False, index=True)
    model_name = Column(String(100), nullable=False, default="TileDefectCNN")
    model_version = Column(String(50), nullable=False, default="v1.0.0")
    predicted_class = Column(String(50), nullable=False) # good, defective
    defect_type = Column(String(50), nullable=True)      # crack, glue_strip, gray_stroke, oil, rough, none
    confidence_score = Column(Float, nullable=True)      # Sigmoid/softmax calibrated confidence (0.0 to 1.0)
    processing_time_ms = Column(Float, nullable=False)   # Duration in ms
    status = Column(String(30), nullable=False, default="completed") # completed, failed, uncertain
    error_message = Column(Text, nullable=True)
    is_current = Column(Boolean, default=True)           # Most recent inference attempt flag
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inspection = relationship("Inspection", back_populates="model_results")
    image = relationship("InspectionImage", back_populates="model_results")
