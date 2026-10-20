from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.user import UserResponse

class CorrectiveActionBase(BaseModel):
    title: str
    description: str
    assigned_to_id: int
    due_date: datetime

class CorrectiveActionCreate(CorrectiveActionBase):
    pass

class CorrectiveActionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to_id: Optional[int] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None # pending, in_progress, completed, overdue
    completion_notes: Optional[str] = None

class CorrectiveActionComplete(BaseModel):
    completion_notes: str
    follow_up_inspection_id: Optional[int] = None

class CorrectiveActionResponse(CorrectiveActionBase):
    id: int
    defect_id: int
    created_by_id: int
    status: str
    completion_notes: Optional[str] = None
    follow_up_inspection_id: Optional[int] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    assigned_to: Optional[UserResponse] = None
    created_by: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class DefectBase(BaseModel):
    inspection_id: int
    defect_category: str
    severity: str = "minor" # minor, major, critical
    description: str

class DefectCreate(DefectBase):
    pass

class DefectResponse(DefectBase):
    id: int
    status: str # open, in_progress, resolved, reopened
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    corrective_actions: Optional[List[CorrectiveActionResponse]] = []
    item_reference: Optional[str] = None
    batch_code: Optional[str] = None
    product_name: Optional[str] = None

    class Config:
        from_attributes = True
