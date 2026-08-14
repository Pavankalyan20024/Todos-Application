from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Status = Literal["Ongoing", "Completed", "On Hold", "Not Started", "Blocked"]
AccessLevel = Literal["admin", "manager", "employee"]


class MemberBase(BaseModel):
    employee_id: str = Field(alias="id", min_length=1, max_length=40)
    team_member: str = Field(alias="teamMember", min_length=1, max_length=80)
    project_workstream: str = Field(alias="project", min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=100)
    access_level: AccessLevel = Field(default="employee", alias="accessLevel")
    current_work: str = Field(alias="currentWork", min_length=1, max_length=2000)
    technologies: list[str] = Field(default_factory=list, alias="technologiesUsed")
    skills: list[str] = Field(default_factory=list)
    working_with: str = Field(default="", alias="workingWith", max_length=150)
    contribution_value_add: str = Field(default="", alias="contribution", max_length=2000)
    status: Status
    expected_completion_date: date = Field(alias="expectedCompletionDate")
    blockers: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    @field_validator("technologies", "skills", "blockers")
    @classmethod
    def clean_lists(cls, values):
        seen = set()
        result = []
        for value in values:
            clean = str(value).strip()
            key = clean.lower()
            if clean and key not in seen:
                result.append(clean)
                seen.add(key)
        return result


class MemberCreate(MemberBase):
    pass


class MemberUpdate(MemberBase):
    pass


class MemberResponse(MemberBase):
    database_id: int = Field(alias="databaseId")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

    @field_validator("password")
    @classmethod
    def bcrypt_length(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must be no more than 72 encoded bytes")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    role: str = Field(min_length=1, max_length=80)


class AccessLevelUpdate(BaseModel):
    access_level: AccessLevel = Field(alias="accessLevel")


class PasswordChange(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=12, max_length=128)

    @field_validator("newPassword")
    @classmethod
    def bcrypt_length(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must be no more than 72 encoded bytes")
        return value


class ForgotPassword(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str = Field(min_length=20)
    newPassword: str = Field(min_length=12, max_length=128)

    @field_validator("newPassword")
    @classmethod
    def bcrypt_length(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must be no more than 72 encoded bytes")
        return value
