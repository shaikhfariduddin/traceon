from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, func
from app.db.session import Base

class AuditHistory(Base):
    __tablename__ = "audit_history"

    id = Column(Integer, primary_key=True, index=True)
    entity_name = Column(String(50), nullable=False, index=True) # product, batch, inspection, review, defect, action, batch_decision
    entity_id = Column(Integer, nullable=False, index=True)
    action = Column(String(50), nullable=False)                  # create, update, review, dispute, resolve, reinspect, hold, release, archive
    actor_id = Column(Integer, nullable=True, index=True)
    actor_name = Column(String(100), nullable=False)
    actor_role = Column(String(30), nullable=False)
    reason = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
