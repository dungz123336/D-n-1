"""Long-term customer preference memory."""

from typing import Any, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import Customer, CustomerMemory


class CustomerMemoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_customer(self, customer_id: int) -> Optional[Customer]:
        result = await self.db.execute(
            select(Customer)
            .options(selectinload(Customer.memory))
            .where(Customer.id == customer_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create_memory(self, customer_id: int) -> CustomerMemory:
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
        mem = await self.get_or_create_memory(customer_id)
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

    async def update(
        self,
        customer_id: int,
        *,
        favorite_genres: Optional[List[str]] = None,
        favorite_authors: Optional[List[str]] = None,
        reading_goals: Optional[str] = None,
        budget: Optional[float] = None,
        preferred_format: Optional[str] = None,
        reading_level: Optional[str] = None,
        language: Optional[str] = None,
        append_viewed: Optional[int] = None,
        append_search: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> CustomerMemory:
        mem = await self.get_or_create_memory(customer_id)
        if favorite_genres is not None:
            mem.favorite_genres = favorite_genres
        if favorite_authors is not None:
            mem.favorite_authors = favorite_authors
        if reading_goals is not None:
            mem.reading_goals = reading_goals
        if budget is not None:
            mem.budget = budget
        if preferred_format is not None:
            mem.preferred_format = preferred_format
        if reading_level is not None:
            mem.reading_level = reading_level
        if language is not None:
            mem.language = language
        if notes is not None:
            mem.notes = notes
        if append_viewed is not None:
            viewed = list(mem.viewed_books or [])
            if append_viewed not in viewed:
                viewed.append(append_viewed)
            mem.viewed_books = viewed[-50:]
        if append_search:
            history = list(mem.search_history or [])
            history.append(append_search)
            mem.search_history = history[-50:]
        await self.db.flush()
        return mem
