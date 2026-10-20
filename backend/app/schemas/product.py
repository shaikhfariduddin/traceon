from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ProductBase(BaseModel):
    product_code: str
    name: str
    tile_type: str
    dimensions: Optional[str] = None
    finish: Optional[str] = None
    material: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    tile_type: Optional[str] = None
    dimensions: Optional[str] = None
    finish: Optional[str] = None
    material: Optional[str] = None
    is_archived: Optional[bool] = None

class ProductResponse(ProductBase):
    id: int
    is_archived: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
