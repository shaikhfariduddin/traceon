from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, desc
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from app.db.session import get_db
from app.models.product import Product
from app.models.batch import Batch
from app.models.inspection import Inspection
from app.models.inspection_image import InspectionImage
from app.models.model_result import ModelResult
from app.models.review import Review
from app.models.defect import Defect
from app.models.corrective_action import CorrectiveAction
from app.models.audit import AuditHistory
from app.models.user import User
from app.schemas.dashboard import DashboardStatsResponse, PriorityItemResponse, TrendPoint, CategoryCount, RecentActivity
from app.api.deps import get_current_user
from app.services.priority_service import get_prioritized_queue, run_queue_simulation_experiment

router = APIRouter()

@router.get("", response_model=DashboardStatsResponse)
def get_dashboard_metrics(
    product_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)

    # Base queries with optional filtering
    insp_query = db.query(Inspection)
    if batch_id:
        insp_query = insp_query.filter(Inspection.batch_id == batch_id)
    if product_id:
        insp_query = insp_query.join(Batch, Inspection.batch_id == Batch.id).filter(Batch.product_id == product_id)

    total_products = db.query(Product).count()
    total_batches = db.query(Batch).count()

    # Item counts (counting distinct physical item references, NOT photographs)
    distinct_inspected_items = insp_query.with_entities(func.count(distinct(Inspection.item_reference))).scalar() or 0

    # Reviewed items
    reviewed_query = db.query(distinct(Inspection.item_reference))\
        .join(Review, Inspection.id == Review.inspection_id)
    if batch_id:
        reviewed_query = reviewed_query.filter(Inspection.batch_id == batch_id)
    if product_id:
        reviewed_query = reviewed_query.join(Batch, Inspection.batch_id == Batch.id).filter(Batch.product_id == product_id)
    distinct_reviewed_items = reviewed_query.count() or 0

    # Pending human reviews
    pending_reviews_count = insp_query.filter(Inspection.status.in_(["submitted", "in_review"])).count() or 0

    # Confirmed defects
    defect_query = db.query(Defect).join(Inspection, Defect.inspection_id == Inspection.id)
    if batch_id:
        defect_query = defect_query.filter(Inspection.batch_id == batch_id)
    if product_id:
        defect_query = defect_query.join(Batch, Inspection.batch_id == Batch.id).filter(Batch.product_id == product_id)
    confirmed_defects_count = defect_query.count() or 0

    # Open actions & Overdue actions
    action_query = db.query(CorrectiveAction).join(Defect, CorrectiveAction.defect_id == Defect.id)\
        .join(Inspection, Defect.inspection_id == Inspection.id)
    if batch_id:
        action_query = action_query.filter(Inspection.batch_id == batch_id)
    if product_id:
        action_query = action_query.join(Batch, Inspection.batch_id == Batch.id).filter(Batch.product_id == product_id)

    open_actions_count = action_query.filter(CorrectiveAction.status.in_(["pending", "in_progress", "overdue"])).count() or 0
    overdue_actions_count = action_query.filter(
        CorrectiveAction.status.in_(["pending", "in_progress", "overdue"]),
        CorrectiveAction.due_date < now
    ).count() or 0

    # Reopened defects
    reopened_defects_count = defect_query.filter(Defect.status == "reopened").count() or 0

    # Defect Rates (Denominator defined explicitly as distinct inspected items)
    confirmed_rate = 0.0
    if distinct_inspected_items > 0:
        confirmed_rate = round((confirmed_defects_count / distinct_inspected_items) * 100.0, 2)

    # AI Flagged Rate
    ai_flagged_count = insp_query.join(ModelResult, Inspection.id == ModelResult.inspection_id)\
        .filter(ModelResult.predicted_class == "defective")\
        .filter(ModelResult.is_current == True)\
        .with_entities(func.count(distinct(Inspection.item_reference))).scalar() or 0

    ai_rate = 0.0
    if distinct_inspected_items > 0:
        ai_rate = round((ai_flagged_count / distinct_inspected_items) * 100.0, 2)

    # Defect category breakdown
    category_counts = db.query(Defect.defect_category, func.count(Defect.id))\
        .join(Inspection, Defect.inspection_id == Inspection.id)
    if batch_id:
        category_counts = category_counts.filter(Inspection.batch_id == batch_id)
    if product_id:
        category_counts = category_counts.join(Batch, Inspection.batch_id == Batch.id).filter(Batch.product_id == product_id)
    cat_rows = category_counts.group_by(Defect.defect_category).all()
    defect_categories = [CategoryCount(category=r[0], count=r[1]) for r in cat_rows]

    # 14-day Trend Analysis
    trends = []
    for day_offset in range(13, -1, -1):
        target_date = (now - timedelta(days=day_offset)).date()
        start_day = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
        end_day = start_day + timedelta(days=1)

        day_items = db.query(func.count(distinct(Inspection.item_reference)))\
            .filter(Inspection.created_at >= start_day, Inspection.created_at < end_day).scalar() or 0

        day_defects = db.query(func.count(Defect.id))\
            .filter(Defect.created_at >= start_day, Defect.created_at < end_day).scalar() or 0

        day_rate = round((day_defects / day_items * 100.0), 1) if day_items > 0 else 0.0
        trends.append(TrendPoint(
            date=target_date.strftime("%b %d"),
            inspected_items=day_items,
            confirmed_defects=day_defects,
            defect_rate_pct=day_rate
        ))

    # Recent activity from audit history
    recent_events = db.query(AuditHistory).order_by(AuditHistory.timestamp.desc()).limit(15).all()
    activity_items = [
        RecentActivity(
            id=ev.id,
            entity_name=ev.entity_name,
            entity_id=ev.entity_id,
            action=ev.action,
            actor_name=ev.actor_name,
            actor_role=ev.actor_role,
            reason=ev.reason,
            timestamp=ev.timestamp
        )
        for ev in recent_events
    ]

    return DashboardStatsResponse(
        total_products=total_products,
        total_batches=total_batches,
        distinct_inspected_items=distinct_inspected_items,
        distinct_reviewed_items=distinct_reviewed_items,
        pending_reviews_count=pending_reviews_count,
        confirmed_defects_count=confirmed_defects_count,
        open_actions_count=open_actions_count,
        overdue_actions_count=overdue_actions_count,
        reopened_defects_count=reopened_defects_count,
        overall_confirmed_defect_rate_pct=confirmed_rate,
        ai_flagged_rate_pct=ai_rate,
        defect_categories=defect_categories,
        trends=trends,
        recent_activity=activity_items
    )

@router.get("/priority-queue", response_model=List[PriorityItemResponse])
def get_priority_inspection_queue(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_prioritized_queue(db, limit=limit)

@router.get("/priority-evaluation")
def get_priority_evaluation_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return run_queue_simulation_experiment(db)
