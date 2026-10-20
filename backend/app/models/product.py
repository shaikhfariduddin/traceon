from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    tile_type = Column(String(50), nullable=False) # Ceramic, Porcelain, Vitrified, Mosaic, Terracotta, Marble-look
    dimensions = Column(String(50), nullable=True) # e.g. 300x300 mm, 600x600 mm
    finish = Column(String(50), nullable=True)     # Glossy, Matte, Textured, Satin, Polished
    material = Column(String(50), nullable=True)   # Glazed Ceramic, Unglazed Vitrified, Quartz
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batches = relationship("Batch", back_populates="product", cascade="all, delete-orphan")
