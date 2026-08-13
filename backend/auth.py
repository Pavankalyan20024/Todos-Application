import hashlib
import secrets

import bcrypt

try:
    from werkzeug.security import check_password_hash as check_werkzeug_hash
except ImportError:  # Werkzeug is only needed when migrating an older Werkzeug hash.
    check_werkzeug_hash = None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    # Only recognized secure password-hash formats are accepted. Unknown values,
    # including legacy plaintext records, must be repaired through password reset.
    if password_hash.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except ValueError:
            return False
    if password_hash.startswith(("pbkdf2:", "scrypt:")) and check_werkzeug_hash:
        try:
            return check_werkzeug_hash(password_hash, password)
        except ValueError:
            return False
    return False


def create_reset_token():
    raw = secrets.token_urlsafe(32)
    return raw, hashlib.sha256(raw.encode("utf-8")).hexdigest()


def hash_token(raw: str):
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
