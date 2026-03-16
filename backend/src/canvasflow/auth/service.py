"""认证核心服务：密码哈希、JWT、CSRF、默认用户"""

from __future__ import annotations

import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from sqlalchemy import func, select

from canvasflow.config import Settings
from canvasflow.database import async_session
from canvasflow.models.user import User

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


async def verify_credentials(username: str, password: str) -> User | None:
    async with async_session() as session:
        result = await session.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if user is None:
            return None
        if not user.is_active:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user


def create_access_token(username: str, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": now,
        "exp": now + timedelta(hours=settings.auth_token_expiry_hours),
    }
    return jwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


def decode_access_token(token: str, settings: Settings) -> dict | None:
    try:
        return jwt.decode(token, settings.auth_jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def generate_csrf_token() -> str:
    return secrets.token_hex(32)


def verify_csrf_token(token_from_header: str, token_from_cookie: str) -> bool:
    if not token_from_header or not token_from_cookie:
        return False
    return hmac.compare_digest(token_from_header, token_from_cookie)


async def seed_default_user(settings: Settings) -> None:
    async with async_session() as session:
        result = await session.execute(select(func.count()).select_from(User))
        count = result.scalar() or 0
        if count > 0:
            return

        user = User(
            username=settings.auth_default_username,
            password_hash=hash_password(settings.auth_default_password),
        )
        session.add(user)
        await session.commit()
        logger.warning(
            "Default user created: username=%s password=%s — change the password after first login",
            settings.auth_default_username,
            settings.auth_default_password,
        )
