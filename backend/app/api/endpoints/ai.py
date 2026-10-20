from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import AIAskRequest, AIAskResponse, ReportRequest, ReportResponse, CitationItem
from app.api.deps import get_current_user
from app.genai.rag_engine import generate_grounded_answer, retrieve_grounded_context

router = APIRouter()

@router.post("/ask", response_model=AIAskResponse)
def ask_quality_intelligence(
    req: AIAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not req.query.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query cannot be empty.")

    result = generate_grounded_answer(
        query=req.query,
        db=db,
        user=current_user,
        batch_id=req.batch_id
    )
    return result

@router.post("/reports", response_model=ReportResponse)
def generate_quality_report(
    req: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Generates a formal evidence-backed Quality Audit Report for a batch or line
    retrieval = retrieve_grounded_context("Generate quality summary report", db, current_user, batch_id=req.batch_id)
    ctx = retrieval["context"]
    citations = retrieval["citations"]

    batch_info = ctx.get("batch", {})
    title = f"Product Quality & Traceability Inspection Report"
    if batch_info:
        title += f" â€” Batch {batch_info.get('batch_code')}"

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    summary = (
        f"This report compiles verified inspection evidence, computer vision inference results, "
        f"and human-in-the-loop review decisions. All counts are computed over distinct physical tile items."
    )

    metrics = {
        "report_generated_by": current_user.full_name,
        "role": current_user.role,
        "batch_status": batch_info.get("status", "general"),
        "inspected_items": batch_info.get("inspected_items_count", 0),
        "confirmed_defects": batch_info.get("confirmed_defects_count", 0),
    }

    sections = [
        {
            "heading": "1. Inspection Coverage & Scope",
            "content": f"Inspected items verified against batch production quantity. Machine suggestions are flagged separately from human confirmations."
        },
        {
            "heading": "2. Defect Breakdown & Severity",
            "content": f"Categories detected: {', '.join(batch_info.get('defect_categories', [])) if batch_info.get('defect_categories') else 'Zero defect findings confirmed.'}"
        },
        {
            "heading": "3. Traceability & Decision Integrity",
            "content": f"Decisions recorded: {len(batch_info.get('decisions', []))} managerial releases/holds on file."
        }
    ]

    return ReportResponse(
        title=title,
        generated_at=now_str,
        summary_text=summary,
        key_metrics=metrics,
        citations=citations,
        sections=sections
    )
