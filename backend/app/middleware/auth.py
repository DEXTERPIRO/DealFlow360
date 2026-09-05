"""app/middleware/auth.py — JWT dependency for FastAPI routes."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from dotenv import load_dotenv
import os

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "dealflow360_jwt_secret_2024_xyz")
JWT_ALGORITHM = "HS256"

bearer_scheme = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    """Decode and validate JWT access token. Returns the payload dict."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_roles(*roles: str):
    """
    FastAPI dependency factory for role-based access control.

    Usage::

        @router.get("/admin-only")
        async def admin_view(user=Depends(require_roles("ADMIN"))):
            ...
    """
    def _check(user: dict = Depends(verify_token)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required: {' or '.join(roles)}",
            )
        return user
    return _check
