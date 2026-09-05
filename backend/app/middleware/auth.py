from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

def verify_token(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if not creds:
        raise HTTPException(status_code=401, detail="No token provided")
    try:
        payload = jwt.decode(creds.credentials, settings.JWT_SECRET, algorithms=["HS256"])
        return payload   # equivalent to req.user in Express
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def require_roles(*roles):
    def checker(user: dict = Depends(verify_token)):
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required: {' or '.join(roles)}"
            )
        return user
    return checker
