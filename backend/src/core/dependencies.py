from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .database import get_db
from .security import decode_token
from ..models.user import User

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    if str(user_id).isdigit():
        result = await db.execute(select(User).where(User.id == int(user_id)))
    else:
        result = await db.execute(select(User).where(User.email == str(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def require_role(*roles: str, verified: bool = False):
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        user_role = current_user.role.value if hasattr(current_user.role, 'value') else current_user.role
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(roles)}",
            )
        if verified and not current_user.verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account not verified",
            )
        return current_user

    return role_checker


optional_security_scheme = HTTPBearer(auto_error=False)

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not credentials:
        return None
    token = credentials.credentials
    try:
        payload = decode_token(token)
        if payload is None or payload.get("type") != "access":
            return None
        user_id = payload.get("sub")
        if user_id is None:
            return None
        result = await db.execute(select(User).where(User.id == int(user_id)))
        return result.scalar_one_or_none()
    except Exception:
        return None

