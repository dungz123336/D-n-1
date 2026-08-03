"""Book comparison with structured AI tables."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import LLMMessage
from app.ai.factory import get_llm_provider
from app.prompts.system import BOOKSTORE_SYSTEM_PROMPT
from app.services.catalog_service import CatalogService
from app.services.usage_service import UsageService


class CompareService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.catalog = CatalogService(db)
        self.usage = UsageService(db)
        self.llm = get_llm_provider()

    async def compare(self, book_ids: list[int], language: str = "en") -> dict[str, Any]:
        books = await self.catalog.get_books_by_ids(book_ids)
        if len(books) < 2:
            raise ValueError("Need at least 2 valid books to compare")

        rows = []
        structured = []
        for b in books:
            author = b.author.name if b.author else "Unknown"
            row = {
                "id": b.id,
                "title": b.title,
                "author": author,
                "difficulty": b.difficulty,
                "price": b.price,
                "target_reader": b.target_reader,
                "rating": b.rating,
                "format": b.format,
                "language": b.language,
                "page_count": b.page_count,
                "category": b.category,
                "description": (b.description or "")[:280],
            }
            structured.append(row)
            rows.append(str(row))

        prompt = (
            f"Compare these books for a customer (language={language}).\n"
            f"Produce a markdown comparison table including: Difficulty, Price, Target reader, "
            f"Pros, Cons, Reading order (if series/related), Rating.\n"
            f"Then give a short verdict for different reader profiles.\n\n"
            f"Books:\n" + "\n".join(rows)
        )
        messages = [
            LLMMessage(role="system", content=BOOKSTORE_SYSTEM_PROMPT),
            LLMMessage(role="user", content=prompt),
        ]
        result = await self.llm.complete(messages)
        await self.usage.log(
            provider=result.provider,
            model=result.model,
            prompt=prompt[:2000],
            response=result.content,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            total_tokens=result.total_tokens,
            latency_ms=result.latency_ms,
            endpoint="/compare",
        )
        return {
            "books": structured,
            "comparison": result.content,
            "provider": result.provider,
            "model": result.model,
        }
