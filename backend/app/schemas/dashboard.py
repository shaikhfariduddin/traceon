from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class TrendPoint(BaseModel):
    date: str
    inspected_items: int
    confirmed_defects: int
    defect_rate_pct: float

class CategoryCount(BaseModel):
    category: str
    count: int

class RecentActivity(BaseModel):
    id: int
    entity_name: str
    entity_id: int
    action: str
    actor_name: str
    actor_role: str
    reason: Optional[str] = None
    timestamp: datetime

class DashboardStatsResponse(BaseModel):
    total_products: int
    total_batches: int
    distinct_inspected_items: int
    distinct_reviewed_items: int
    pending_reviews_count: int
    confirmed_defects_count: int
    open_actions_count: int
    overdue_actions_count: int
    reopened_defects_count: int
    overall_confirmed_defect_rate_pct: float
    ai_flagged_rate_pct: float
    defect_categories: List[CategoryCount]
    trends: List[TrendPoint]
    recent_activity: List[RecentActivity]

class PriorityItemResponse(BaseModel):
    inspection_id: int
    item_reference: str
    batch_code: str
    product_name: str
    status: str
    priority_level: str # CRITICAL, HIGH, MEDIUM, LOW
    priority_score: int
    priority_reasons: List[str]
    has_overdue_action: bool
    is_reopened: bool
    is_pending_review: bool
    is_uncertain_image: bool
    recurring_defect_count: int
    created_at: datetime
