from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.models.defect import Defect
from app.models.corrective_action import CorrectiveAction
from app.models.inspection import Inspection
from app.models.batch import Batch
from app.models.product import Product
from app.models.user import User
from app.schemas.defect import (
    DefectResponse, CorrectiveActionCreate, CorrectiveActionResponse
)
from app.api.deps import get_current_user, require_role
from app.services.audit_service import log_audit_event

router = APIRouter()

@router.get("", response_model=List[DefectResponse])
def get_defects(
    status_filter: Optional[str] = None,
    severity: Optional[str] = None,
    batch_id: Optional[int] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Defect).join(Inspection, Defect.inspection_id == Inspection.id)
    if status_filter:
        query = query.filter(Defect.status == status_filter)
    if severity:
        query = query.filter(Defect.severity == severity)
    if batch_id:
        query = query.filter(Inspection.batch_id == batch_id)
    if product_id:
        query = query.join(Batch, Inspection.batch_id == Batch.id).filter(Batch.product_id == product_id)

    defects = query.order_by(Defect.id.desc()).all()
    results = []
    for d in defects:
        insp = d.inspection
        batch = insp.batch if insp else None
        prod = batch.product if batch else None

        results.append({
            "id": d.id,
            "inspection_id": d.inspection_id,
            "defect_category": d.defect_category,
            "severity": d.severity,
            "description": d.description,
            "status": d.status,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
            "corrective_actions": d.corrective_actions,
            "item_reference": insp.item_reference if insp else None,
            "batch_code": batch.batch_code if batch else None,
            "product_name": prod.name if prod else None
        })
    return results

@router.get("/{defect_id}", response_model=DefectResponse)
def get_defect(
    defect_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    d = db.query(Defect).filter(Defect.id == defect_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Defect not found")

    insp = d.inspection
    batch = insp.batch if insp else None
    prod = batch.product if batch else None

    return {
        "id": d.id,
        "inspection_id": d.inspection_id,
        "defect_category": d.defect_category,
        "severity": d.severity,
        "description": d.description,
        "status": d.status,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
        "corrective_actions": d.corrective_actions,
        "item_reference": insp.item_reference if insp else None,
        "batch_code": batch.batch_code if batch else None,
        "product_name": prod.name if prod else None
    }

@router.post("/{defect_id}/actions", response_model=CorrectiveActionResponse, status_code=status.HTTP_201_CREATED)
def create_corrective_action(
    defect_id: int,
    action_in: CorrectiveActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "manager"]))
):
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Defect not found")

    assigned_user = db.query(User).filter(User.id == action_in.assigned_to_id).first()
    if not assigned_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned owner user not found")

    action = CorrectiveAction(
        defect_id=defect.id,
        title=action_in.title,
        description=action_in.description,
        assigned_to_id=action_in.assigned_to_id,
        created_by_id=current_user.id,
        due_date=action_in.due_date,
        status="pending"
    )
    db.add(action)

    defect.status = "in_progress"
    db.commit()
    db.refresh(action)

    log_audit_event(
        db=db,
        entity_name="corrective_action",
        entity_id=action.id,
        action="create",
        actor=current_user,
        reason=f"Assigned corrective action '{action.title}' to {assigned_user.full_name}",
        details=action_in.model_dump(mode="json")
    )
    return action

@router.post("/{defect_id}/reopen", response_model=DefectResponse)
def reopen_defect(
    defect_id: int,
    reason: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["inspector", "supervisor", "manager"]))
):
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Defect not found")

    defect.status = "reopened"
    db.commit()
    db.refresh(defect)

    log_audit_event(
        db=db,
        entity_name="defect",
        entity_id=defect.id,
        action="reopen",
        actor=current_user,
        reason=f"Defect reopened: {reason}",
        details={"defect_id": defect.id, "reason": reason}
    )
    return get_defect(defect_id=defect_id, db=db, current_user=current_user)
