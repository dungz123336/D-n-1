"""Reading roadmap generator (AI + catalog grounding)."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.llm.base import LLMMessage
from backend.llm.factory import get_llm_provider
from backend.memory.rag import RAGRetriever
from backend.prompts.system import CONCIERGE_SYSTEM_PROMPT
from backend.services.smart_recommend import SmartRecommendEngine


ROADMAP_PRESETS = {
    "ai": "Roadmap học AI cho người mới",
    "python": "Roadmap học Python",
    "đầu tư": "Roadmap đầu tư",
    "kinh doanh": "Roadmap kinh doanh",
    "phát triển bản thân": "Roadmap phát triển bản thân",
    "ielts": "Roadmap luyện IELTS",
    "30 ngày": "Roadmap đọc trong 30 ngày",
}


class RoadmapEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.rec = SmartRecommendEngine(db)
        self.rag = RAGRetriever(db)
        self.llm = get_llm_provider()

    async def build(
        self,
        topic: str,
        *,
        customer_id: Optional[int] = None,
        days: Optional[int] = None,
    ) -> dict[str, Any]:
        topic_l = topic.lower()
        title = next((v for k, v in ROADMAP_PRESETS.items() if k in topic_l), f"Roadmap: {topic}")
        rec = await self.rec.recommend(topic, customer_id=customer_id, limit=6)
        books = rec["books"]
        days = days or (30 if "30" in topic_l else 60)

        prompt = (
            f"Tạo {title} bằng tiếng Việt (mình/bạn).\n"
            f"Thời gian gợi ý: {days} ngày.\n"
            f"Danh sách sách có sẵn (dùng đúng id/giá/tồn):\n{books}\n\n"
            "Cấu trúc:\n"
            "1. Mục tiêu lộ trình\n"
            "2. Các giai đoạn (cơ bản → trung cấp → nâng cao)\n"
            "3. Gán sách cụ thể từng giai đoạn + thời lượng đọc ước tính\n"
            "4. Checklist 30/60 ngày\n"
            "5. Mẹo duy trì thói quen đọc\n"
            "Chỉ recommend sách trong danh sách."
        )
        result = await self.llm.complete(
            [
                LLMMessage(role="system", content=CONCIERGE_SYSTEM_PROMPT),
                LLMMessage(role="user", content=prompt),
            ]
        )
        return {
            "title": title,
            "topic": topic,
            "days": days,
            "books": books,
            "roadmap_markdown": result.content,
            "provider": result.provider,
            "model": result.model,
        }
