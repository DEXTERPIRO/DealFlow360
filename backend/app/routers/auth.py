"""app/routers/auth.py — Authentication routes (FastAPI)."""
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_SECRET = os.getenv("JWT_SECRET", "dealflow360_jwt_secret_2024_xyz")
JWT_REFRESH_SECRET = os.getenv("JWT_REFRESH_SECRET", "dealflow360_refresh_secret_2024_abc")
JWT_ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str | None = "SALES_REP"

class MagicLinkRequest(BaseModel):
    email: str

class VerifyMagicRequest(BaseModel):
    token: str

# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_tokens(user: User) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    access_payload = {
        "id": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "name": user.name,
        "exp": now + timedelta(minutes=15),
    }
    refresh_payload = {
        "id": str(user.id),
        "exp": now + timedelta(days=7),
    }
    access_token = jwt.encode(access_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    refresh_token = jwt.encode(refresh_payload, JWT_REFRESH_SECRET, algorithm=JWT_ALGORITHM)
    return access_token, refresh_token


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refreshToken",
        value=token,
        httponly=True,
        samesite="strict",
        max_age=7 * 24 * 60 * 60,
    )

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not pwd_context.verify(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    access_token, refresh_token = _generate_tokens(user)
    _set_refresh_cookie(response, refresh_token)
    return {
        "accessToken": access_token,
        "user": {
            "id": str(user.id), "name": user.name,
            "email": user.email, "role": user.role.value,
            "avatar": user.avatar,
        },
    }


@router.post("/signup", status_code=201)
async def signup(body: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)):
    if not body.name or not body.email or not body.password:
        raise HTTPException(status_code=400, detail="All fields required")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password min 8 characters")

    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    allowed_roles = {"SALES_REP", "SALES_MANAGER", "FINANCE", "ADMIN"}
    role = UserRole(body.role) if body.role in allowed_roles else UserRole.SALES_REP

    hashed = pwd_context.hash(body.password)
    user = User(name=body.name, email=body.email, password=hashed, role=role)
    db.add(user)
    await db.flush()
    await db.refresh(user)

    access_token, refresh_token = _generate_tokens(user)
    _set_refresh_cookie(response, refresh_token)
    return {
        "accessToken": access_token,
        "user": {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role.value},
    }


@router.post("/refresh")
async def refresh_token(response: Response, refreshToken: str | None = Cookie(default=None), db: AsyncSession = Depends(get_db)):
    if not refreshToken:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(refreshToken, JWT_REFRESH_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == payload["id"]))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid session")

    access_token, new_refresh = _generate_tokens(user)
    _set_refresh_cookie(response, new_refresh)
    return {"accessToken": access_token}


@router.post("/magic-link")
async def magic_link(body: MagicLinkRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or user.role != UserRole.CUSTOMER:
        return {"message": "If this email exists, a link was sent"}

    token = secrets.token_hex(32)
    expiry = datetime.now(timezone.utc) + timedelta(minutes=30)
    user.magic_link_token = token
    user.magic_link_expiry = expiry
    await db.flush()
    # In production: send email — for demo return token
    return {"message": "Magic link sent", "token": token, "userId": str(user.id)}


@router.post("/verify-magic")
async def verify_magic(body: VerifyMagicRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(
            User.magic_link_token == body.token,
            User.magic_link_expiry > datetime.now(timezone.utc),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Link expired or invalid")

    user.magic_link_token = None
    user.magic_link_expiry = None
    await db.flush()

    access_token, refresh_token = _generate_tokens(user)
    _set_refresh_cookie(response, refresh_token)
    return {
        "accessToken": access_token,
        "user": {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role.value},
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refreshToken")
    return {"message": "Logged out"}


@router.get("/me")
async def me(user_payload: dict = Depends(verify_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_payload["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(user.id), "name": user.name, "email": user.email,
        "role": user.role.value, "avatar": user.avatar,
        "customerTier": user.customer_tier.value if user.customer_tier else None,
        "companyName": user.company_name,
    }
