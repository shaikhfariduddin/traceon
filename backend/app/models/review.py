from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    review_decision = Column(String(50), nullable=False) # confirmed_defect, confirmed_good, corrected_defect, more_evidence_needed, disputed
    confirmed_category = Column(String(50), nullable=True) # Supported defect category or manual category
    notes = Column(Text, nullable=True)                  # Review justification and notes
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inspection = relationship("Inspection", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")
