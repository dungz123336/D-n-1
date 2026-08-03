"""AI book summary, knowledge map, quiz, flashcards."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.llm.base import LLMMessage
from backend.llm.factory import get_llm_provider
from backend.prompts.system import CONCIERGE_SYSTEM_PROMPT
from backend.services.store_service import StoreService


class ContentEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.store = StoreService(db)
        self.llm = get_llm_provider()

    async def summarize(self, book_id: int, spoiler: bool = False) -> dict[str, Any]:
        book = await self.store.get_book(book_id)
        if not book:
            raise ValueError("Không tìm thấy sách")
        pages = book.get("page_count") or 250
        minutes = int(pages * 1.5)
        prompt = (
            f"Tóm tắt sách sau bằng tiếng Việt (mình/bạn).\n"
            f"Sách: {book}\n"
            f"Spoiler allowed: {spoiler}\n\n"
            "Trả về các mục markdown:\n"
            "## Tóm tắt ngắn\n## Bài học chính\n## Đối tượng đọc\n"
            f"## Thời gian đọc (ước tính ~{minutes} phút)\n## Độ khó\n"
            "## Trích dẫn quan trọng (2–3 câu mang tính minh họa, ghi rõ là mang tính gợi ý)\n"
            "## Sơ đồ kiến thức (bullet hierarchy)\n"
            + ("## Cảnh báo spoiler\n" if spoiler else "## Không spoiler cốt truyện\n")
        )
        result = await self.llm.complete(
            [
                LLMMessage(role="system", content=CONCIERGE_SYSTEM_PROMPT),
                LLMMessage(role="user", content=prompt),
            ]
        )
        return {
            "book": book,
            "reading_time_minutes": minutes,
            "summary_markdown": result.content,
            "provider": result.provider,
            "model": result.model,
        }

    async def quiz(self, book_id: int, num_questions: int = 5) -> dict[str, Any]:
        book = await self.store.get_book(book_id)
        if not book:
            raise ValueError("Không tìm thấy sách")
        prompt = (
            f"Tạo quiz {num_questions} câu về sách {book['title']} (tiếng Việt).\n"
            "Format:\n"
            "### Câu hỏi\n"
            "A/B/C/D\n"
            "**Đáp án:** ...\n"
            "Thêm phần Flashcards (5 thẻ) và Key Takeaways (5 ý).\n"
            "Không spoiler nặng nếu là tiểu thuyết."
        )
        result = await self.llm.complete(
            [
                LLMMessage(role="system", content=CONCIERGE_SYSTEM_PROMPT),
                LLMMessage(role="user", content=prompt),
            ]
        )
        return {
            "book_id": book_id,
            "title": book["title"],
            "quiz_markdown": result.content,
            "provider": result.provider,
            "model": result.model,
        }
