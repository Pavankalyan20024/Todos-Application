from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import current_user
from ..models import AuditLog, User
from ..schemas import ProfileUpdate
from .auth import safe

router = APIRouter(tags=["profile"])


@router.get("/profile")
def get_profile(user: User = Depends(current_user)):
    return safe(user)


@router.put("/profile")
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    user.full_name = payload.name.strip()
    user.email = str(payload.email).lower()
    user.job_role = payload.role.strip()
    db.add(AuditLog(user_id=user.id, role=user.role, action="profile_updated", entity_type="user", entity_id=str(user.id)))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists.")
    return safe(user)
