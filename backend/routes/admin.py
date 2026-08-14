from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require_roles
from ..models import AuditLog, User
from ..schemas import AccessLevelUpdate
from .auth import safe

router = APIRouter(tags=["administration"])


@router.put("/users/{user_id}/access-level")
def update_access_level(
    user_id: int,
    payload: AccessLevelUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found.")
    user.role = payload.access_level
    user.session_version += 1
    db.add(AuditLog(
        user_id=admin.id, role=admin.role, action="access_level_updated",
        entity_type="user", entity_id=str(user.id),
    ))
    db.commit()
    db.refresh(user)
    return safe(user)
