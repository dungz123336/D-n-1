"""Long-term customer preference memory."""

from typing import Any, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.entities import Customer, CustomerMemory


class CustomerMemoryStore:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_customer(self, customer_id: int) -> Optional[Customer]:
        result = await self.db.execute(
            select(Customer)
            .options(selectinload(Customer.memory))
            .where(Customer.id == customer_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, customer_id: int) -> CustomerMemory:
        result = await self.db.execute(
            select(CustomerMemory).where(CustomerMemory.customer_id == customer_id)
        )
        mem = result.scalar_one_or_none()
        if mem:
            return mem
        mem = CustomerMemory(customer_id=customer_id)
        self.db.add(mem)
        await self.db.flush()
        return mem

    async def as_dict(self, customer_id: int) -> dict[str, Any]:
        mem = await self.get_or_create(customer_id)
        return {
            "favorite_genres": mem.favorite_genres or [],
            "favorite_authors": mem.favorite_authors or [],
            "reading_goals": mem.reading_goals,
            "budget": mem.budget,
            "preferred_format": mem.preferred_format,
            "reading_level": mem.reading_level,
            "language": mem.language,
            "viewed_books": mem.viewed_books or [],
            "search_history": (mem.search_history or [])[-20:],
            "notes": mem.notes,
        }

    async def update(self, customer_id: int, **fields: Any) -> CustomerMemory:
        mem = await self.get_or_create(customer_id)
        for key, value in fields.items():
            if value is None:
                continue
            if key == "append_viewed":
                viewed = list(mem.viewed_books or [])
                if value not in viewed:
                    viewed.append(value)
                mem.viewed_books = viewed[-50:]
            elif key == "append_search":
                hist = list(mem.search_history or [])
                hist.append(value)
                mem.search_history = hist[-50:]
            elif hasattr(mem, key):
                setattr(mem, key, value)
        await self.db.flush()
        return mem
