"""Password hashing, signed tokens and the role/permission table (enforced by the services layer)."""
import base64
import hashlib
import hmac
import json
import os
import time

from . import config
from .errors import AppError


def hash_password(password: str, salt: str | None = None, iterations: int = 120_000) -> str:
    salt = salt or os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), iterations).hex()
    return f"pbkdf2${iterations}${salt}${dk}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, dk = stored.split("$")
        test = hash_password(password, salt, int(iterations)).split("$")[3]
        return hmac.compare_digest(test, dk)
    except Exception:
        return False


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def make_token(user_id: int) -> str:
    body = _b64(json.dumps({"uid": user_id, "exp": int(time.time()) + config.TOKEN_TTL_SECONDS}).encode())
    sig = _b64(hmac.new(config.SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_token(token: str) -> int:
    try:
        body, sig = token.split(".")
        good = _b64(hmac.new(config.SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, good):
            raise ValueError("bad signature")
        payload = json.loads(_unb64(body))
        if payload["exp"] < time.time():
            raise AppError(401, "TOKEN_EXPIRED", "Your session expired. Sign in again.")
        return int(payload["uid"])
    except AppError:
        raise
    except Exception:
        raise AppError(401, "BAD_TOKEN", "Sign in to continue.")


# Role -> what it may do. The model never decides permissions; this table does, on the server.
PERMISSIONS = {
    "product.write": ("manager",),
    "batch.write": ("manager", "inspector"),
    "batch.archive": ("manager",),
    "inspection.create": ("manager", "inspector"),
    "review.write": ("manager", "inspector"),
    "review.resolve": ("manager",),
    "action.assign": ("manager", "inspector"),
    "defect.decide": ("manager", "inspector"),
    "batch.decide": ("manager",),
    "audit.all": ("manager", "inspector"),
    "users.list": ("manager", "inspector"),
}


def can(user: dict, permission: str) -> bool:
    return user["role"] in PERMISSIONS.get(permission, ())


def require(user: dict, permission: str, message: str | None = None) -> None:
    if not can(user, permission):
        raise AppError(
            403, "FORBIDDEN",
            message or f"Your role ({user['role']}) is not allowed to do this. Needed: {permission}.",
        )
