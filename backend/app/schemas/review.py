from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.schemas.user import UserResponse

class ReviewCreate(BaseModel):
    review_decision: str # confirmed_defect, confirmed_good, corrected_defect, more_evidence_needed, disputed
    confirmed_category: Optional[str] = None # crack, glue_strip, gray_stroke, oil, rough, uneven_alignment, etc.
    notes: Optional[str] = None
    severity: Optional[str] = "minor" # if creating defect directly
    description: Optional[str] = None

class ReviewResponse(BaseModel):
    id: int
    inspection_id: int
    reviewer_id: int
    review_decision: str
    confirmed_category: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    reviewer: Optional[UserResponse] = None

    class Config:
        from_attributes = True
