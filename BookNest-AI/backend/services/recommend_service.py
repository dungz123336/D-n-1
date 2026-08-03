"""Luồng gợi ý sách — luôn hỏi nhu cầu trước khi recommend."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.llm.base import LLMMessage
from backend.llm.factory import get_llm_provider
from backend.memory.customer_store import CustomerMemoryStore
from backend.models.entities import Recommendation
from backend.prompts.system import CONCIERGE_SYSTEM_PROMPT
from backend.schemas.commerce import RecommendRequest
from backend.tools.bookstore_tools import BookstoreTools

REQUIRED = ("purpose", "budget", "reading_level", "favorite_author", "language", "format")


class RecommendService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.tools = BookstoreTools(db)
        self.memory = CustomerMemoryStore(db)
        self.llm = get_llm_provider()

    def _missing(self, req: RecommendRequest) -> list[str]:
        return [f for f in REQUIRED if not getattr(req, f, None)]

    async def recommend(self, req: RecommendRequest) -> dict[str, Any]:
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

        # Mặc định ngôn ngữ gợi ý: tiếng Việt
        if not req.language:
            req.language = "vi"

        missing = self._missing(req)
        if missing and not req.force:
            questions = {
                "purpose": "Bạn muốn tìm sách để học tập, giải trí hay làm quà ạ?",
                "budget": "Ngân sách của bạn khoảng bao nhiêu? (ví dụ dưới 200k, khoảng 300k…)",
                "reading_level": "Bạn thích sách dễ đọc, trung bình hay chuyên sâu hơn?",
                "favorite_author": "Bạn có tác giả yêu thích hoặc cuốn nào từng đọc rất hợp không?",
                "language": "Bạn muốn sách tiếng Việt hay tiếng Anh?",
                "format": "Bạn thích sách giấy, ebook hay bìa cứng?",
            }
            return {
                "status": "need_more_info",
                "message": (
                    "Mình rất muốn gợi ý đúng gu cho bạn ✨ "
                    "Cho mình hỏi thêm vài ý nhỏ nhé — mình không recommend vội đâu."
                ),
                "missing": missing,
                "questions": [questions[m] for m in missing],
                "recommendations": [],
            }

        catalog = await self.tools.catalog_snippet(limit=20, category=req.category)
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
            "Hãy gợi ý 3 cuốn sách từ catalog dưới đây, viết hoàn toàn bằng tiếng Việt tự nhiên "
            "(xưng hô mình/bạn). Không trộn tiếng Anh trừ tên sách/tác giả.\n"
            f"Tiêu chí khách:\n{criteria}\n\n"
            f"Catalog:\n{catalog}\n\n"
            "Với mỗi cuốn: nêu id, giá, độ khó, và giải thích vì sao hợp. "
            "Có thể gợi ý nhẹ một mã giảm giá hoặc combo nếu phù hợp. Chỉ 3 cuốn."
        )
        result = await self.llm.complete(
            [
                LLMMessage(role="system", content=CONCIERGE_SYSTEM_PROMPT),
                LLMMessage(role="user", content=prompt),
            ]
        )
        books = await self.tools.search_books(
            query=req.favorite_author or req.category or req.message,
            max_price=req.budget,
            language=None if req.language == "vi" else req.language,
            limit=3,
        )
        rec = Recommendation(
            customer_id=req.customer_id,
            book_ids=[b["id"] for b in books],
            reason=result.content[:2000],
            criteria=criteria,
        )
        self.db.add(rec)
        await self.db.flush()

        if req.customer_id:
            updates = {}
            if req.budget is not None:
                updates["budget"] = req.budget
            if req.reading_level:
                updates["reading_level"] = req.reading_level
            if req.format:
                updates["preferred_format"] = req.format
            if req.language:
                updates["language"] = req.language
            if updates:
                await self.memory.update(req.customer_id, **updates)

        return {
            "status": "ok",
            "message": result.content,
            "criteria": criteria,
            "books": books,
            "provider": result.provider,
            "model": result.model,
            "recommendation_id": rec.id,
        }
