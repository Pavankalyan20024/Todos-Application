from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import create_reset_token, hash_password, hash_token, verify_password
from ..database import get_db
from ..dependencies import current_user
from ..models import PasswordResetToken, User, utcnow
from ..schemas import ForgotPassword, PasswordChange, ResetPassword, UserLogin, UserRegister

router = APIRouter(tags=["authentication"])


def safe(user):
    return {"id": str(user.id), "name": user.full_name, "email": user.email, "role": user.role, "authProvider": user.auth_provider}


def begin_session(request, user):
    request.session.clear()
    request.session.update(user_id=user.id, session_version=user.session_version)


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    user = db.get(User, user_id) if user_id else None
    authenticated = bool(user and request.session.get("session_version") == user.session_version)
    return {"authenticated": authenticated, "user": safe(user) if authenticated else None}


@router.post("/register", status_code=201)
def register(payload: UserRegister, request: Request, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "An account with this email already exists.")
    user = User(full_name=payload.name.strip(), email=email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists.")
    db.refresh(user)
    begin_session(request, user)
    return {"success": True, "authenticated": True, "user": safe(user)}


@router.post("/login")
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email address or password.")
    begin_session(request, user)
    request.session["remember"] = payload.remember
    return {"authenticated": True, "user": safe(user)}


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"authenticated": False}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPassword, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(payload.email).lower()).first()
    development_token = None
    if user and user.password_hash:
        raw, digest = create_reset_token()
        db.query(PasswordResetToken).filter_by(user_id=user.id, used_at=None).update({"used_at": utcnow()})
        db.add(PasswordResetToken(user_id=user.id, token_hash=digest, expires_at=utcnow() + timedelta(minutes=30)))
        db.commit()
        development_token = raw
    result = {"message": "If an account exists for this email, password reset instructions have been sent."}
    # Email delivery can consume this token; never expose it outside development.
    import os
    if os.getenv("ENVIRONMENT", "development") == "development" and development_token:
        result["developmentResetToken"] = development_token
    return result


@router.post("/reset-password")
def reset_password(payload: ResetPassword, request: Request, db: Session = Depends(get_db)):
    reset = db.query(PasswordResetToken).filter_by(token_hash=hash_token(payload.token), used_at=None).first()
    if not reset or reset.expires_at.replace(tzinfo=None) <= utcnow().replace(tzinfo=None):
        raise HTTPException(400, "This password reset link is invalid or has expired.")
    user = db.get(User, reset.user_id)
    user.password_hash = hash_password(payload.newPassword)
    user.session_version += 1
    db.query(PasswordResetToken).filter_by(user_id=user.id, used_at=None).update({"used_at": utcnow()})
    db.commit()
    begin_session(request, user)
    return {"authenticated": True, "user": safe(user)}


@router.post("/change-password")
def change_password(payload: PasswordChange, request: Request, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not verify_password(payload.currentPassword, user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
    user.password_hash = hash_password(payload.newPassword)
    user.session_version += 1
    db.commit()
    begin_session(request, user)
    return {"user": safe(user)}
