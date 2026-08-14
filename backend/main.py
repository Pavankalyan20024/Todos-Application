import os
import secrets
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import inspect, text
from starlette.middleware.sessions import SessionMiddleware

from .database import Base, engine
from .routes import admin, auth, dashboard, import_excel, members, profile, reports

BASE_DIR = Path(__file__).resolve().parent.parent
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
SESSION_SECRET = os.getenv("SESSION_SECRET")
if not SESSION_SECRET and ENVIRONMENT == "production":
    raise RuntimeError("SESSION_SECRET is required in production")

app = FastAPI(title="TaskFlow API", version="1.0.0")
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET or secrets.token_hex(32),
    session_cookie="taskflow_session",
    max_age=60 * 60 * 24 * 30,
    same_site="lax",
    https_only=ENVIRONMENT == "production",
)


@app.middleware("http")
async def apply_session_lifetime(request: Request, call_next):
    response = await call_next(request)
    # Starlette signs the session cookie. Without Remember Me, remove Max-Age so
    # the browser treats it as a normal session cookie.
    if request.session.get("user_id") and not request.session.get("remember", False):
        cookie = response.headers.get("set-cookie")
        if cookie and "taskflow_session=" in cookie:
            parts = [part for part in cookie.split("; ") if not part.lower().startswith("max-age=")]
            response.headers["set-cookie"] = "; ".join(parts)
    return response
origins = [item.strip() for item in os.getenv("FRONTEND_ORIGIN", "http://localhost:5500,http://127.0.0.1:5500").split(",") if item.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"])

app.include_router(auth.router, prefix="/api/auth")
app.include_router(members.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(import_excel.router, prefix="/api")
app.include_router(admin.router, prefix="/api/admin")


@app.on_event("startup")
def create_tables():
    # Suitable for this POC; use Alembic before production schema changes.
    Base.metadata.create_all(bind=engine)
    # Lightweight compatibility migration for existing POC databases.
    with engine.begin() as connection:
        db_inspector = inspect(connection)
        audit_columns = {column["name"] for column in db_inspector.get_columns("audit_logs")}
        if "role" not in audit_columns:
            connection.execute(text("ALTER TABLE audit_logs ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'employee'"))
        user_columns = {column["name"] for column in db_inspector.get_columns("users")}
        if "job_role" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN job_role VARCHAR(80) NOT NULL DEFAULT 'Employee'"))
            connection.execute(text("UPDATE users SET job_role = role WHERE lower(role) NOT IN ('admin', 'manager', 'employee')"))
        member_columns = {column["name"] for column in db_inspector.get_columns("members")}
        if "access_level" not in member_columns:
            connection.execute(text("ALTER TABLE members ADD COLUMN access_level VARCHAR(20) NOT NULL DEFAULT 'employee'"))
        connection.execute(text("UPDATE users SET role = 'employee' WHERE lower(role) NOT IN ('admin', 'manager', 'employee') OR role IS NULL"))
        bootstrap_email = os.getenv("TASKFLOW_BOOTSTRAP_ADMIN_EMAIL", "").strip().lower()
        if bootstrap_email:
            connection.execute(text("UPDATE users SET role = 'admin' WHERE lower(email) = :email"), {"email": bootstrap_email})


@app.exception_handler(HTTPException)
async def http_error(_request: Request, error: HTTPException):
    return JSONResponse({"message": str(error.detail)}, status_code=error.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, error: RequestValidationError):
    first = error.errors()[0] if error.errors() else {}
    field = ".".join(str(part) for part in first.get("loc", [])[1:])
    return JSONResponse({"message": f"Invalid {field or 'request data'}: {first.get('msg', 'validation failed')}."}, status_code=422)


@app.exception_handler(Exception)
async def server_error(_request: Request, _error: Exception):
    return JSONResponse({"message": "Unable to complete the request. Please try again."}, status_code=500)


@app.get("/api/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.get("/")
@app.get("/reset-password")
def index():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/{filename}")
def asset(filename: str):
    if filename not in {"script.js", "style.css"}:
        raise HTTPException(404, "Not found.")
    return FileResponse(BASE_DIR / filename)
