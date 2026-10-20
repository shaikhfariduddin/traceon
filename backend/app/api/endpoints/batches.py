from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import List, Optional
from app.db.session import get_db
from app.models.batch import Batch
from app.models.product import Product
from app.models.user import User
from app.models.inspection import Inspection
from app.models.defect import Defect
from app.models.batch_decision import BatchDecision
from app.schemas.batch import BatchCreate, BatchUpdate, BatchResponse, BatchDecisionCreate, BatchDecisionResponse
from app.api.deps import get_current_user, require_role
from app.services.audit_service import log_audit_event

router = APIRouter()

@router.get("", response_model=List[BatchResponse])
def get_batches(
    product_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Batch)
    if product_id:
        query = query.filter(Batch.product_id == product_id)
    if status:
        query = query.filter(Batch.status == status)

    batches = query.order_by(Batch.id.desc()).all()
    results = []
    for b in batches:
        # Distinct inspected items (counting distinct physical item references, not photographs!)
        inspected_count = db.query(func.count(distinct(Inspection.item_reference)))\
            .filter(Inspection.batch_id == b.id).scalar() or 0

        # Confirmed defects count in this batch
        defect_count = db.query(func.count(Defect.id))\
            .join(Inspection, Defect.inspection_id == Inspection.id)\
            .filter(Inspection.batch_id == b.id).scalar() or 0

        batch_dict = {
            "id": b.id,
            "product_id": b.product_id,
            "batch_code": b.batch_code,
            "production_date": b.production_date,
            "quantity": b.quantity,
            "supplier": b.supplier,
            "status": b.status,
            "created_at": b.created_at,
            "updated_at": b.updated_at,
            "product": b.product,
            "decisions": b.decisions,
            "inspected_count": inspected_count,
            "defect_count": defect_count
        }
        results.append(batch_dict)
    return results

@router.post("", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    batch_in: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["inspector", "supervisor", "manager"]))
):
    product = db.query(Product).filter(Product.id == batch_in.product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referenced product not found")

    existing = db.query(Batch).filter(Batch.batch_code == batch_in.batch_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch with code '{batch_in.batch_code}' already exists."
        )

    batch = Batch(**batch_in.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)

    log_audit_event(
        db=db,
        entity_name="batch",
        entity_id=batch.id,
        action="create",
        actor=current_user,
        reason=f"Registered batch {batch.batch_code} for product {product.product_code}",
        details=batch_in.model_dump(mode="json")
    )
    return batch

@router.get("/{batch_id}", response_model=BatchResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    b = db.query(Batch).filter(Batch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    inspected_count = db.query(func.count(distinct(Inspection.item_reference)))\
        .filter(Inspection.batch_id == b.id).scalar() or 0
    defect_count = db.query(func.count(Defect.id))\
        .join(Inspection, Defect.inspection_id == Inspection.id)\
        .filter(Inspection.batch_id == b.id).scalar() or 0

    return {
        "id": b.id,
        "product_id": b.product_id,
        "batch_code": b.batch_code,
        "production_date": b.production_date,
        "quantity": b.quantity,
        "supplier": b.supplier,
        "status": b.status,
        "created_at": b.created_at,
        "updated_at": b.updated_at,
        "product": b.product,
        "decisions": b.decisions,
        "inspected_count": inspected_count,
        "defect_count": defect_count
    }

@router.patch("/{batch_id}", response_model=BatchResponse)
def update_batch(
    batch_id: int,
    batch_in: BatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "manager"]))
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    update_data = batch_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(batch, field, value)

    db.commit()
    db.refresh(batch)

    log_audit_event(
        db=db,
        entity_name="batch",
        entity_id=batch.id,
        action="update",
        actor=current_user,
        details=update_data
    )
    return batch

@router.post("/{batch_id}/decision", response_model=BatchDecisionResponse)
def record_batch_decision(
    batch_id: int,
    decision_in: BatchDecisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["manager"])) # STRICT BACKEND CHECK: Only manager can record batch decision!
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    if decision_in.decision not in ["release", "hold", "conditional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be one of: 'release', 'hold', 'conditional'"
        )

    decision = BatchDecision(
        batch_id=batch.id,
        manager_id=current_user.id,
        decision=decision_in.decision,
        reason=decision_in.reason
    )
    db.add(decision)

    # Update batch status accordingly
    if decision_in.decision == "release":
        batch.status = "released"
    elif decision_in.decision == "hold":
        batch.status = "on_hold"
    elif decision_in.decision == "conditional":
        batch.status = "in_inspection"

    db.commit()
    db.refresh(decision)

    log_audit_event(
        db=db,
        entity_name="batch_decision",
        entity_id=decision.id,
        action=f"batch_{decision_in.decision}",
        actor=current_user,
        reason=decision_in.reason,
        details={"batch_id": batch.id, "batch_code": batch.batch_code, "decision": decision_in.decision}
    )
    return decision

@router.get("/{batch_id}/decisions", response_model=List[BatchDecisionResponse])
def get_batch_decisions(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(BatchDecision).filter(BatchDecision.batch_id == batch_id).order_by(BatchDecision.id.desc()).all()
