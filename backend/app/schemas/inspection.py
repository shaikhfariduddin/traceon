from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from app.schemas.user import UserResponse

class InspectionImageResponse(BaseModel):
    id: int
    inspection_id: int
    file_path: str
    original_filename: str
    file_hash: str
    file_size: int
    width: Optional[int] = None
    height: Optional[int] = None
    blur_score: Optional[float] = None
    brightness_score: Optional[float] = None
    is_uncertain: bool = False
    quality_notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ModelResultResponse(BaseModel):
    id: int
    inspection_id: int
    image_id: int
    model_name: str
    model_version: str
    predicted_class: str
    defect_type: Optional[str] = None
    confidence_score: Optional[float] = None
    processing_time_ms: float
    status: str
    error_message: Optional[str] = None
    is_current: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

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

class DefectSummary(BaseModel):
    id: int
    defect_category: str
    severity: str
    description: str
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class InspectionBase(BaseModel):
    batch_id: int
    item_reference: str
    sample_type: str = "individual_tile"
    location: Optional[str] = None
    notes: Optional[str] = None

class InspectionCreate(InspectionBase):
    pass

class InspectionResponse(InspectionBase):
    id: int
    inspector_id: int
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    inspector: Optional[UserResponse] = None
    images: Optional[List[InspectionImageResponse]] = []
    latest_model_result: Optional[ModelResultResponse] = None
    latest_review: Optional[ReviewResponse] = None

    class Config:
        from_attributes = True

class InspectionDetailResponse(InspectionResponse):
    model_results: Optional[List[ModelResultResponse]] = []
    reviews: Optional[List[ReviewResponse]] = []
    defects: Optional[List[DefectSummary]] = []
    batch_code: Optional[str] = None
    product_name: Optional[str] = None
    product_code: Optional[str] = None
