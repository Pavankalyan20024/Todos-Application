from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import current_user
from ..models import Member, User
from .dashboard import calculate

router = APIRouter(tags=["reports"])


@router.get("/reports")
def reports(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    members = db.query(Member).all()
    return {
        "stats": calculate(members),
        "status": dict(Counter(item.status for item in members)),
        "projects": dict(Counter(item.project_workstream for item in members)),
    }


@router.get("/projects")
def projects(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    names = sorted({item[0] for item in db.query(Member.project_workstream).all()}, key=str.lower)
    return [{"name": name} for name in names]
