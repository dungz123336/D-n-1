"""Authentication service."""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.customer import Customer, CustomerMemory
from app.utils.security import create_access_token, hash_password, verify_password


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()

    async def register(self, email: str, password: str, name: Optional[str] = None, language: str = "en") -> Customer:
        existing = await self.db.execute(select(Customer).where(Customer.email == email))
        if existing.scalar_one_or_none():
            raise ValueError("Email already registered")
        customer = Customer(
            email=email,
            name=name or email.split("@")[0],
            language=language,
            hashed_password=hash_password(password),
        )
        self.db.add(customer)
        await self.db.flush()
        self.db.add(CustomerMemory(customer_id=customer.id, language=language))
        await self.db.flush()
        return customer

    async def login(self, email: str, password: str) -> tuple[Customer, str]:
        result = await self.db.execute(select(Customer).where(Customer.email == email))
        customer = result.scalar_one_or_none()
        if not customer or not verify_password(password, customer.hashed_password or ""):
            raise ValueError("Invalid email or password")
        token = create_access_token(
            customer.id,
            extra={"email": customer.email, "role": "customer"},
        )
        return customer, token

    def issue_token(self, customer: Customer) -> dict:
        token = create_access_token(
            customer.id,
            extra={"email": customer.email, "role": "customer"},
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": self.settings.jwt_expire_minutes * 60,
            "customer_id": customer.id,
            "email": customer.email,
        }
