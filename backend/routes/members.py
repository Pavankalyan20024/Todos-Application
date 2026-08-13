from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import current_user
from ..models import AuditLog, Member, User
from ..schemas import MemberCreate, MemberResponse, MemberUpdate

router = APIRouter(tags=["members"])


def response_for(member: Member):
    return MemberResponse(
        id=member.employee_id, teamMember=member.team_member, project=member.project_workstream,
        role=member.role, currentWork=member.current_work, technologiesUsed=member.technologies or [],
        skills=member.skills or [], workingWith=member.working_with or "",
        contribution=member.contribution_value_add or "", status=member.status,
        expectedCompletionDate=member.expected_completion_date, blockers=member.blockers or [],
        databaseId=member.id, createdAt=member.created_at, updatedAt=member.updated_at,
    )


def apply_payload(member: Member, payload):
    values = payload.model_dump(by_alias=False)
    for key, value in values.items():
        setattr(member, key, value)


@router.get("/members", response_model=list[MemberResponse], response_model_by_alias=True)
def list_members(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    return [response_for(item) for item in db.query(Member).order_by(Member.created_at.desc()).all()]


@router.get("/members/{employee_id}", response_model=MemberResponse, response_model_by_alias=True)
def get_member(employee_id: str, db: Session = Depends(get_db), _user: User = Depends(current_user)):
    member = db.query(Member).filter(Member.employee_id == employee_id).first()
    if not member:
        raise HTTPException(404, "Team member not found.")
    return response_for(member)


@router.post("/members", response_model=MemberResponse, response_model_by_alias=True, status_code=201)
def create_member(payload: MemberCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    member = Member()
    apply_payload(member, payload)
    db.add(member)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This Employee ID already exists.")
    db.add(AuditLog(user_id=user.id, action="member_created", entity_type="member", entity_id=member.employee_id))
    db.commit()
    db.refresh(member)
    return response_for(member)


@router.put("/members/{employee_id}", response_model=MemberResponse, response_model_by_alias=True)
def update_member(employee_id: str, payload: MemberUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    member = db.query(Member).filter(Member.employee_id == employee_id).first()
    if not member:
        raise HTTPException(404, "Team member not found.")
    apply_payload(member, payload)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This Employee ID already exists.")
    db.add(AuditLog(user_id=user.id, action="member_updated", entity_type="member", entity_id=member.employee_id))
    db.commit()
    db.refresh(member)
    return response_for(member)


@router.delete("/members/{employee_id}", status_code=204)
def delete_member(employee_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    member = db.query(Member).filter(Member.employee_id == employee_id).first()
    if not member:
        raise HTTPException(404, "Team member not found.")
    db.delete(member)
    db.add(AuditLog(user_id=user.id, action="member_deleted", entity_type="member", entity_id=employee_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/members", status_code=204)
def clear_members(db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.query(Member).delete()
    db.add(AuditLog(user_id=user.id, action="members_cleared", entity_type="member"))
    db.commit()
    return Response(status_code=204)
