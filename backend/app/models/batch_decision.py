from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class BatchDecision(Base):
    __tablename__ = "batch_decisions"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    decision = Column(String(30), nullable=False) # release, hold, conditional
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="decisions")
    manager = relationship("User", back_populates="batch_decisions")
