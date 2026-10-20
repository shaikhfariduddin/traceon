from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class Defect(Base):
    __tablename__ = "defects"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False, index=True)
    defect_category = Column(String(50), nullable=False) # crack, glue_strip, gray_stroke, oil, rough, uneven_alignment, inconsistent_grout, chipped_corner, surface_scratch, stain
    severity = Column(String(20), nullable=False, default="minor") # minor, major, critical
    description = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="open")   # open, in_progress, resolved, reopened
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    inspection = relationship("Inspection", back_populates="defects")
    corrective_actions = relationship("CorrectiveAction", back_populates="defect", cascade="all, delete-orphan")
