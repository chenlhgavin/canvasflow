"""认证路由：登录、登出、修改密码、当前用户"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select

from canvasflow.config import settings
from canvasflow.database import async_session
from canvasflow.models.user import User

from .rate_limiter import LoginRateLimiter
from .schemas import AuthStatusResponse, ChangePasswordRequest, LoginRequest, LoginResponse
from .service import (
    create_access_token,
    generate_csrf_token,
    hash_password,
    verify_credentials,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_rate_limiter = LoginRateLimiter()


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _resolve_cookie_secure(request: Request) -> bool:
    setting = settings.auth_cookie_secure
    if setting in {"true", "1", "yes"}:
        return True
    if setting in {"false", "0", "no"}:
        return False
    # auto: 根据请求协议自动判断
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    return proto == "https"


def _set_auth_cookies(
    response: Response, access_token: str, csrf_token: str, request: Request
) -> None:
    max_age = settings.auth_token_expiry_hours * 3600
    secure = _resolve_cookie_secure(request)
    domain = settings.auth_cookie_domain or None

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
        max_age=max_age,
        domain=domain,
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
        max_age=max_age,
        domain=domain,
    )


def _clear_auth_cookies(response: Response) -> None:
    domain = settings.auth_cookie_domain or None
    response.delete_cookie(key="access_token", path="/", domain=domain)
    response.delete_cookie(key="csrf_token", path="/", domain=domain)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, response: Response):
    client_ip = _get_client_ip(request)
    _rate_limiter.check(client_ip)

    user = await verify_credentials(body.username, body.password)

    if user is None:
        _rate_limiter.record(client_ip)
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    access_token = create_access_token(user.username, settings)
    csrf_token = generate_csrf_token()

    _set_auth_cookies(response, access_token, csrf_token, request)

    return LoginResponse(username=user.username, csrf_token=csrf_token)


@router.post("/logout")
async def logout(response: Response):
    _clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.post("/change-password")
async def change_password(body: ChangePasswordRequest, request: Request):
    username = getattr(request.state, "username", None)
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.username == username)
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")

        if not verify_password(body.current_password, user.password_hash):
            raise HTTPException(
                status_code=401, detail="Current password is incorrect"
            )

        user.password_hash = hash_password(body.new_password)
        await session.commit()

    return {"message": "Password changed"}


@router.get("/me", response_model=AuthStatusResponse)
async def me(request: Request):
    username = getattr(request.state, "username", None)
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return AuthStatusResponse(authenticated=True, username=username)
