"""Structured multi-book comparison (2–4 books)."""

from __future__ import annotations

from typing import Any, List

from sqlalchemy.ext.asyncio import AsyncSession

from backend.llm.base import LLMMessage
from backend.llm.factory import get_llm_provider
from backend.prompts.system import CONCIERGE_SYSTEM_PROMPT
from backend.services.store_service import StoreService


class CompareEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.store = StoreService(db)
        self.llm = get_llm_provider()

    async def compare(self, book_ids: List[int], language: str = "vi") -> dict[str, Any]:
        if len(book_ids) < 2 or len(book_ids) > 4:
            raise ValueError("Chọn từ 2 đến 4 cuốn để so sánh")
        books = []
        for bid in book_ids:
            b = await self.store.get_book(bid)
            if b:
                books.append(b)
        if len(books) < 2:
            raise ValueError("Không đủ sách hợp lệ để so sánh")

        table_rows = []
        for b in books:
            table_rows.append(
                {
                    "id": b["id"],
                    "cover": b.get("cover_url"),
                    "title": b["title"],
                    "author": b.get("author_name"),
                    "publisher_id": b.get("publisher_id"),
                    "price": b.get("price"),
                    "original_price": b.get("original_price"),
                    "discount_percent": b.get("discount_percent"),
                    "pages": b.get("page_count"),
                    "language": b.get("language"),
                    "release_year": b.get("published_year"),
                    "rating": b.get("rating"),
                    "difficulty": b.get("difficulty"),
                    "best_for": b.get("target_reader"),
                    "stock": b.get("stock"),
                    "category": b.get("category"),
                }
            )

        prompt = (
            "So sánh các cuốn sau bằng tiếng Việt (mình/bạn). "
            "Trả về bảng markdown với cột: Tên, Tác giả, Giá, % giảm, Số trang, Ngôn ngữ, "
            "Năm XB, Rating, Độ khó, Phù hợp với, Ưu điểm, Nhược điểm.\n"
            "Cuối cùng: 1 đoạn AI Recommendation chọn cuốn nào cho ai.\n\n"
            f"Dữ liệu (giá/tồn kho thật):\n{table_rows}"
        )
        result = await self.llm.complete(
            [
                LLMMessage(role="system", content=CONCIERGE_SYSTEM_PROMPT),
                LLMMessage(role="user", content=prompt),
            ]
        )
        return {
            "books": table_rows,
            "comparison_markdown": result.content,
            "provider": result.provider,
            "model": result.model,
        }
