from datetime import datetime, timezone

from sqlalchemy import JSON, CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Table, Text

from .database import Base

member_skills = Table(
    "member_skills", Base.metadata,
    Column("member_id", ForeignKey("members.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)
member_technologies = Table(
    "member_technologies", Base.metadata,
    Column("member_id", ForeignKey("members.id", ondelete="CASCADE"), primary_key=True),
    Column("technology_id", ForeignKey("technologies.id", ondelete="CASCADE"), primary_key=True),
)


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('admin', 'manager', 'employee')", name="ck_users_role"),)
    id = Column(Integer, primary_key=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(254), nullable=False, unique=True, index=True)
    password_hash = Column(String(255))
    job_role = Column(String(80), nullable=False, default="Employee")
    role = Column(String(20), nullable=False, default="employee")
    auth_provider = Column(String(30), nullable=False, default="password")
    session_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class Member(Base):
    __tablename__ = "members"
    __table_args__ = (CheckConstraint("access_level IN ('admin', 'manager', 'employee')", name="ck_members_access_level"),)
    id = Column(Integer, primary_key=True)
    employee_id = Column(String(40), nullable=False, unique=True, index=True)
    team_member = Column(String(80), nullable=False)
    project_workstream = Column(String(100), nullable=False, index=True)
    role = Column(String(100), nullable=False)
    access_level = Column(String(20), nullable=False, default="employee")
    current_work = Column(Text, nullable=False)
    working_with = Column(String(150), nullable=False, default="")
    contribution_value_add = Column(Text, nullable=False, default="")
    status = Column(String(30), nullable=False, index=True)
    expected_completion_date = Column(Date, nullable=False, index=True)
    blockers = Column(JSON, nullable=False, default=list)
    skills = Column(JSON, nullable=False, default=list)
    technologies = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)


class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)


class Technology(Base):
    __tablename__ = "technologies"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    role = Column(String(20), nullable=False, default="employee")
    action = Column(String(60), nullable=False)
    entity_type = Column(String(40), nullable=False)
    entity_id = Column(String(80))
    timestamp = Column(DateTime(timezone=True), nullable=False, default=utcnow)
