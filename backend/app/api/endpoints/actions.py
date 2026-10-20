from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.corrective_action import CorrectiveAction
from app.models.defect import Defect
from app.models.inspection import Inspection
from app.models.user import User
from app.schemas.defect import (
    CorrectiveActionUpdate, CorrectiveActionComplete, CorrectiveActionResponse
)
from app.api.deps import get_current_user, require_role
from app.services.audit_service import log_audit_event

router = APIRouter()

@router.get("", response_model=List[CorrectiveActionResponse])
def get_corrective_actions(
    status_filter: Optional[str] = None,
    assigned_to_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(CorrectiveAction)
    if status_filter:
        query = query.filter(CorrectiveAction.status == status_filter)
    if assigned_to_id:
        query = query.filter(CorrectiveAction.assigned_to_id == assigned_to_id)

    actions = query.order_by(CorrectiveAction.due_date.asc()).all()
    now = datetime.now(timezone.utc)
    # Check overdue status dynamically
    for a in actions:
        if a.status in ["pending", "in_progress"] and a.due_date < now:
            a.status = "overdue"
    db.commit()
    return actions

@router.patch("/{action_id}", response_model=CorrectiveActionResponse)
def update_action(
    action_id: int,
    action_in: CorrectiveActionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "manager", "inspector"]))
):
    action = db.query(CorrectiveAction).filter(CorrectiveAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corrective action not found")

    update_data = action_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(action, field, value)

    db.commit()
    db.refresh(action)

    log_audit_event(
        db=db,
        entity_name="corrective_action",
        entity_id=action.id,
        action="update",
        actor=current_user,
        details=update_data
    )
    return action

@router.post("/{action_id}/complete", response_model=CorrectiveActionResponse)
def complete_action(
    action_id: int,
    comp_in: CorrectiveActionComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "manager", "inspector"]))
):
    action = db.query(CorrectiveAction).filter(CorrectiveAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corrective action not found")

    action.status = "completed"
    action.completion_notes = comp_in.completion_notes
    action.completed_at = datetime.now(timezone.utc)
    if comp_in.follow_up_inspection_id:
        action.follow_up_inspection_id = comp_in.follow_up_inspection_id

    # Note: As per requirements, completing a repair DOES NOT automatically close the defect.
    # Reinspection must verify it!
    db.commit()
    db.refresh(action)

    log_audit_event(
        db=db,
        entity_name="corrective_action",
        entity_id=action.id,
        action="complete_action",
        actor=current_user,
        reason="Corrective repair work executed and marked complete. Pending reinspection.",
        details={"notes": comp_in.completion_notes, "follow_up_inspection_id": comp_in.follow_up_inspection_id}
    )
    return action

@router.post("/{action_id}/close-defect")
def close_defect_via_reinspection(
    action_id: int,
    resolution_notes: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "manager"]))
):
    action = db.query(CorrectiveAction).filter(CorrectiveAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")

    defect = action.defect
    defect.status = "resolved"

    insp = defect.inspection
    insp.status = "closed"

    db.commit()

    log_audit_event(
        db=db,
        entity_name="defect",
        entity_id=defect.id,
        action="close_defect",
        actor=current_user,
        reason=f"Defect verified and closed: {resolution_notes}",
        details={"action_id": action.id, "resolution_notes": resolution_notes}
    )
    return {"status": "success", "message": f"Defect #{defect.id} and Inspection #{insp.id} closed successfully."}
