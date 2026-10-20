from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class CitationItem(BaseModel):
    record_type: str # inspection, defect, action, batch, product
    record_id: int
    identifier: str # e.g. INS-12, DEF-4, BAT-B-104, ACT-3
    label: str
    url_path: str

class AIAskRequest(BaseModel):
    query: str
    batch_id: Optional[int] = None
    product_id: Optional[int] = None

class AIAskResponse(BaseModel):
    query: str
    answer: str
    citations: List[CitationItem]
    grounding_stats: Dict[str, Any]
    provider: str
    disclaimer: str = "AI-generated summary grounded strictly in authorised PostgreSQL records. AI suggestions are distinguished from human-confirmed findings."

class ReportRequest(BaseModel):
    batch_id: Optional[int] = None
    product_id: Optional[int] = None
    days_back: int = 30

class ReportResponse(BaseModel):
    title: str
    generated_at: str
    summary_text: str
    key_metrics: Dict[str, Any]
    citations: List[CitationItem]
    sections: List[Dict[str, Any]]
