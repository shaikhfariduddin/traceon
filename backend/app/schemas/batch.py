from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.product import ProductResponse

class BatchBase(BaseModel):
    product_id: int
    batch_code: str
    production_date: datetime
    quantity: int = 1000
    supplier: Optional[str] = None
    status: str = "pending"

class BatchCreate(BatchBase):
    pass

class BatchUpdate(BaseModel):
    quantity: Optional[int] = None
    supplier: Optional[str] = None
    status: Optional[str] = None

class BatchDecisionCreate(BaseModel):
    decision: str # release, hold, conditional
    reason: str

class BatchDecisionResponse(BaseModel):
    id: int
    batch_id: int
    manager_id: int
    decision: str
    reason: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BatchResponse(BatchBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    product: Optional[ProductResponse] = None
    decisions: Optional[List[BatchDecisionResponse]] = []
    inspected_count: Optional[int] = 0
    defect_count: Optional[int] = 0

    class Config:
        from_attributes = True
