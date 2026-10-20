from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="inspector") # inspector, supervisor, manager
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inspections = relationship("Inspection", back_populates="inspector")
    reviews = relationship("Review", back_populates="reviewer")
    assigned_actions = relationship("CorrectiveAction", foreign_keys="CorrectiveAction.assigned_to_id", back_populates="assigned_to")
    created_actions = relationship("CorrectiveAction", foreign_keys="CorrectiveAction.created_by_id", back_populates="created_by")
    batch_decisions = relationship("BatchDecision", back_populates="manager")
