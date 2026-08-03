"""Shared FastAPI dependencies."""

from app.database import get_db
from app.middleware.auth import get_current_customer, get_current_customer_optional, require_admin

__all__ = [
    "get_db",
    "get_current_customer",
    "get_current_customer_optional",
    "require_admin",
]
