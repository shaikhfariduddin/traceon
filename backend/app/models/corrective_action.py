from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class CorrectiveAction(Base):
    __tablename__ = "corrective_actions"

    id = Column(Integer, primary_key=True, index=True)
    defect_id = Column(Integer, ForeignKey("defects.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    due_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(30), nullable=False, default="pending") # pending, in_progress, completed, overdue
    completion_notes = Column(Text, nullable=True)
    follow_up_inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=True, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    defect = relationship("Defect", back_populates="corrective_actions")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_actions")
    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="created_actions")
    follow_up_inspection = relationship("Inspection", foreign_keys=[follow_up_inspection_id], back_populates="follow_up_actions")
