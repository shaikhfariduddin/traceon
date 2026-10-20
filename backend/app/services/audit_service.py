from sqlalchemy.orm import Session
from app.models.audit import AuditHistory
from app.models.user import User
from typing import Optional, Dict, Any

def log_audit_event(
    db: Session,
    entity_name: str,
    entity_id: int,
    action: str,
    actor: Optional[User] = None,
    reason: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
):
    actor_id = actor.id if actor else None
    actor_name = actor.full_name if actor else "System"
    actor_role = actor.role if actor else "system"

    entry = AuditHistory(
        entity_name=entity_name,
        entity_id=entity_id,
        action=action,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        reason=reason,
        details=details
    )
    db.add(entry)
    db.commit()
    return entry
