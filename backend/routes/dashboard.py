from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import current_user
from ..models import Member, User

router = APIRouter(tags=["dashboard"])


def calculate(members):
    today = date.today()
    incomplete = [m for m in members if m.status != "Completed"]
    return {
        "totalTeamMembers": len({m.team_member.strip().lower() for m in members}),
        "activeProjects": len({m.project_workstream.strip().lower() for m in incomplete}),
        "ongoingWork": sum(m.status == "Ongoing" for m in members),
        "completedWork": sum(m.status == "Completed" for m in members),
        "blockedItems": sum(m.status == "Blocked" or bool(m.blockers) for m in members),
        "upcomingDeadlines": sum(today <= m.expected_completion_date <= today + timedelta(days=30) for m in incomplete),
    }


@router.get("/dashboard/stats")
def stats(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    return calculate(db.query(Member).all())
