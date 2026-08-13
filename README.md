# TaskFlow

TaskFlow keeps its existing HTML/CSS/JavaScript interface and now uses a FastAPI REST API, SQLAlchemy, and MySQL as its primary data store.

## Development setup

1. Install Python 3.11+ and MySQL.
2. Create the database: `CREATE DATABASE taskflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
3. Create and activate a virtual environment.
4. Install dependencies: `pip install -r requirements.txt`
5. Copy `.env.example` to `.env` and set the MySQL user, password, and a long random session secret.
6. Start TaskFlow: `uvicorn backend.main:app --reload --port 8000`
7. Open `http://127.0.0.1:8000`.

The compatibility command `python server.py` also starts the app on port 8000. Do not open `index.html` directly because authentication and application data require the API.

API documentation is available at `/docs` and `/redoc`; health status is available at `/api/health`.

## Data and security

- Members, reports, dashboard statistics, profiles, accounts, and password-reset tokens are database-backed.
- Employee ID is unique. Excel imports update an existing row with the same Employee ID and insert new IDs.
- Passwords are bcrypt hashes; session cookies are HTTP-only and become Secure when `ENVIRONMENT=production`.
- Keep `.env` uncommitted and serve production deployments over HTTPS.
- Automatic table creation is retained for the local POC. Introduce Alembic before production schema changes.

Non-sensitive UI preferences (theme, language, and notification toggles) remain in Local Storage; it is no longer the source of truth for members or authentication.
