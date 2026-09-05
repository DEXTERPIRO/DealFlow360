import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models.models import User, UserRole
from app.middleware.auth import verify_token
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
limiter = Limiter(key_func=get_remote_address)

class LoginBody(BaseModel):
    email: EmailStr
    password: str

class SignupBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str | None = None

def generate_tokens(user: User) -> tuple[str, str]:
    access = jwt.encode(
        {"id": user.id, "email": user.email, "role": user.role.value if hasattr(user.role, 'value') else user.role,
         "name": user.name, "exp": datetime.utcnow() + timedelta(minutes=15)},
        settings.JWT_SECRET, algorithm="HS256"
    )
    refresh = jwt.encode(
        {"id": user.id, "exp": datetime.utcnow() + timedelta(days=7)},
        settings.JWT_REFRESH_SECRET, algorithm="HS256"
    )
    return access, refresh

def set_refresh_cookie(response: Response, token: str):
    response.set_cookie(
        "refreshToken", token, httponly=True, samesite="strict",
        max_age=7 * 24 * 60 * 60
    )

@router.post("/login")
@limiter.limit("10/15minutes")
async def login(request: Request, body: LoginBody, response: Response,
                 db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(body.password, user.password):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account deactivated")
    access, refresh = generate_tokens(user)
    set_refresh_cookie(response, refresh)
    return {
        "accessToken": access,
        "user": {"id": user.id, "name": user.name, "email": user.email,
                  "role": user.role.value if hasattr(user.role, 'value') else user.role, "avatar": user.avatar}
    }

@router.post("/signup", status_code=201)
async def signup(body: SignupBody, response: Response, db: AsyncSession = Depends(get_db)):
    if len(body.password) < 8:
        raise HTTPException(400, "Password min 8 characters")
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")
    allowed_roles = {"SALES_REP", "SALES_MANAGER", "FINANCE", "ADMIN"}
    role = body.role if body.role in allowed_roles else "SALES_REP"
    hashed = pwd_context.hash(body.password)
    user = User(name=body.name, email=body.email, password=hashed, role=UserRole(role))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    access, refresh = generate_tokens(user)
    set_refresh_cookie(response, refresh)
    return {"accessToken": access,
            "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role.value if hasattr(user.role, 'value') else user.role}}

@router.post("/refresh")
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refreshToken")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        decoded = jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Invalid refresh token")
    result = await db.execute(select(User).where(User.id == decoded["id"]))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(401, "Invalid session")
    access, refresh = generate_tokens(user)
    set_refresh_cookie(response, refresh)
    return {"accessToken": access}

@router.post("/magic-link")
async def magic_link(email: EmailStr, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or user.role != UserRole.CUSTOMER:
        return {"message": "If this email exists, a link was sent"}
    token = secrets.token_hex(32)
    user.magic_link_token = token
    user.magic_link_expiry = datetime.utcnow() + timedelta(minutes=30)
    await db.commit()
    return {"message": "Magic link sent", "token": token, "userId": user.id}

@router.post("/verify-magic")
async def verify_magic(token: str, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.magic_link_token == token,
                            User.magic_link_expiry > datetime.utcnow())
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "Link expired or invalid")
    user.magic_link_token = None
    user.magic_link_expiry = None
    await db.commit()
    access, refresh = generate_tokens(user)
    set_refresh_cookie(response, refresh)
    return {"accessToken": access,
            "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role.value if hasattr(user.role, 'value') else user.role}}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refreshToken")
    return {"message": "Logged out"}

@router.get("/me")
async def me(user: dict = Depends(verify_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user["id"]))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role.value if hasattr(u.role, 'value') else u.role,
            "avatar": u.avatar, "customerTier": u.customer_tier.value if hasattr(u.customer_tier, 'value') else u.customer_tier, "companyName": u.company_name}
