"""Book recommendation with mandatory discovery questions."""

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import LLMMessage
from app.ai.factory import get_llm_provider
from app.models.recommendation import Recommendation
from app.prompts.system import BOOKSTORE_SYSTEM_PROMPT
from app.schemas.commerce import RecommendRequest
from app.services.catalog_service import CatalogService
from app.services.usage_service import UsageService
from app.memory.customer_memory import CustomerMemoryService


REQUIRED_FIELDS = ("purpose", "budget", "reading_level", "favorite_author", "language", "format")


class RecommendService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.catalog = CatalogService(db)
        self.memory = CustomerMemoryService(db)
        self.usage = UsageService(db)
        self.llm = get_llm_provider()

    def _missing_criteria(self, req: RecommendRequest) -> list[str]:
        missing = []
        for field in REQUIRED_FIELDS:
            if getattr(req, field, None) in (None, ""):
                missing.append(field)
        return missing

    async def recommend(self, req: RecommendRequest) -> dict[str, Any]:
        missing = self._missing_criteria(req)

        # Merge customer memory when available
        if req.customer_id:
            mem = await self.memory.as_dict(req.customer_id)
            if not req.budget and mem.get("budget"):
                req.budget = mem["budget"]
            if not req.reading_level and mem.get("reading_level"):
                req.reading_level = mem["reading_level"]
            if not req.format and mem.get("preferred_format"):
                req.format = mem["preferred_format"]
            if not req.language and mem.get("language"):
                req.language = mem["language"]
            if not req.favorite_author and mem.get("favorite_authors"):
                req.favorite_author = mem["favorite_authors"][0]
            missing = self._missing_criteria(req)

        if missing and not req.force:
            questions = {
                "purpose": "What is the purpose of this book? (gift, self-improvement, entertainment, study…)",
                "budget": "What is your budget range?",
                "reading_level": "What reading level? (beginner / intermediate / advanced)",
                "favorite_author": "Do you have a favorite author or similar books you loved?",
                "language": "Preferred language?",
                "format": "Paperback, ebook, hardcover, or audiobook?",
            }
            return {
                "status": "need_more_info",
                "message": (
                    "I'd love to recommend the perfect books — but I never guess. "
                    "Please help me with a few details first."
                ),
                "missing": missing,
                "questions": [questions[m] for m in missing],
                "recommendations": [],
            }

        catalog = await self.catalog.catalog_snippet(
            limit=20, category=req.category
        )
        criteria = {
            "purpose": req.purpose,
            "budget": req.budget,
            "reading_level": req.reading_level,
            "favorite_author": req.favorite_author,
            "language": req.language,
            "format": req.format,
            "category": req.category,
            "message": req.message,
        }
        prompt = (
            f"Recommend 3 books from the catalog for these criteria:\n{criteria}\n\n"
            f"Catalog:\n{catalog}\n\n"
            "For each book: explain why it fits, difficulty, price, target reader. "
            "Also suggest one optional bundle or voucher if relevant. "
            "Only use books from the catalog (include book id)."
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
            customer_id=req.customer_id,
            endpoint="/recommend",
        )

        # Persist recommendation trail
        rec = Recommendation(
            customer_id=req.customer_id,
            book_ids=[],
            reason=result.content[:2000],
            criteria=criteria,
        )
        self.db.add(rec)
        await self.db.flush()

        if req.customer_id:
            updates: dict[str, Any] = {}
            if req.budget is not None:
                updates["budget"] = req.budget
            if req.reading_level:
                updates["reading_level"] = req.reading_level
            if req.format:
                updates["preferred_format"] = req.format
            if req.language:
                updates["language"] = req.language
            if req.favorite_author:
                mem = await self.memory.as_dict(req.customer_id)
                authors = list(mem.get("favorite_authors") or [])
                if req.favorite_author not in authors:
                    authors.append(req.favorite_author)
                updates["favorite_authors"] = authors
            if updates:
                await self.memory.update(req.customer_id, **updates)

        return {
            "status": "ok",
            "message": result.content,
            "criteria": criteria,
            "provider": result.provider,
            "model": result.model,
            "recommendation_id": rec.id,
        }
