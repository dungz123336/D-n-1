"""JWT and admin API-key dependencies."""

from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.customer import Customer
from app.utils.security import decode_access_token

security = HTTPBearer(auto_error=False)
settings = get_settings()


async def get_current_customer_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[Customer]:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        return None
    try:
        customer_id = int(payload["sub"])
    except (TypeError, ValueError):
        return None
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    return result.scalar_one_or_none()


async def get_current_customer(
    customer: Optional[Customer] = Depends(get_current_customer_optional),
) -> Customer:
    if not customer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return customer


async def require_admin(
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> bool:
    if x_api_key and x_api_key == settings.admin_api_key:
        return True
    if credentials:
        payload = decode_access_token(credentials.credentials)
        if payload and payload.get("role") == "admin":
            return True
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
