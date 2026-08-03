"""
Smart Recommendation Engine.

Signals (when available):
  search history, browsing, purchases, wishlist, favorite authors/categories,
  budget, bestsellers, trends, keyword similarity.
"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.llm.base import LLMMessage
from backend.llm.factory import get_llm_provider
from backend.memory.customer_store import CustomerMemoryStore
from backend.memory.rag import RAGRetriever
from backend.prompts.system import CONCIERGE_SYSTEM_PROMPT
from backend.services.store_service import StoreService


# Topic → keyword expansions (Vietnamese learning paths)
TOPIC_MAP: dict[str, list[str]] = {
    "ai": ["ai", "machine learning", "deep learning", "python", "prompt", "trí tuệ", "học máy"],
    "python": ["python", "lập trình", "coding", "cơ bản"],
    "đầu tư": ["đầu tư", "chứng khoán", "tài chính", "tiền"],
    "kinh doanh": ["kinh doanh", "startup", "marketing", "quản trị"],
    "phát triển bản thân": ["thói quen", "self-help", "động lực", "kỹ năng"],
    "ielts": ["ielts", "english", "tiếng anh", "ngữ pháp"],
}


class SmartRecommendEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.store = StoreService(db)
        self.memory = CustomerMemoryStore(db)
        self.rag = RAGRetriever(db)
        self.llm = get_llm_provider()

    def _topic_keys(self, query: str) -> list[str]:
        q = query.lower()
        keys: list[str] = []
        for topic, kws in TOPIC_MAP.items():
            if topic in q or any(k in q for k in kws):
                keys.extend(kws)
        if not keys:
            keys = q.split()
        return keys

    async def score_books(
        self,
        books: list[dict[str, Any]],
        *,
        query: str,
        memory: dict[str, Any],
        wishlist_ids: list[int],
        budget: Optional[float],
    ) -> list[dict[str, Any]]:
        keys = set(self._topic_keys(query))
        fav_authors = {a.lower() for a in (memory.get("favorite_authors") or [])}
        fav_genres = {g.lower() for g in (memory.get("favorite_genres") or [])}
        viewed = set(memory.get("viewed_books") or [])

        scored = []
        for b in books:
            score = 0.0
            blob = " ".join(
                [
                    str(b.get("title") or ""),
                    str(b.get("author_name") or ""),
                    str(b.get("category") or ""),
                    " ".join(b.get("genres") or []),
                    " ".join(b.get("tags") or []),
                    str(b.get("description") or "")[:400],
                ]
            ).lower()
            for k in keys:
                if k and k in blob:
                    score += 3
            if (b.get("author_name") or "").lower() in fav_authors:
                score += 5
            for g in fav_genres:
                if g and g in blob:
                    score += 2
            if b.get("is_bestseller"):
                score += 2
            if b.get("is_trending"):
                score += 1.5
            if b.get("id") in wishlist_ids:
                score += 4
            if b.get("id") in viewed:
                score += 1
            price = float(b.get("price") or 0)
            if budget and price and price <= budget:
                score += 2
            elif budget and price and price > budget * 1.2:
                score -= 2
            score += float(b.get("rating") or 0) * 0.4
            scored.append({**b, "_score": round(score, 2)})
        # de-dupe by id keeping best score
        best: dict[int, dict[str, Any]] = {}
        for row in scored:
            bid = int(row["id"])
            if bid not in best or row["_score"] > best[bid]["_score"]:
                best[bid] = row
        out = list(best.values())
        out.sort(key=lambda x: x["_score"], reverse=True)
        return out

    async def recommend(
        self,
        query: str,
        *,
        customer_id: Optional[int] = None,
        limit: int = 5,
        force_llm: bool = True,
    ) -> dict[str, Any]:
        memory: dict[str, Any] = {}
        wishlist_ids: list[int] = []
        budget = None
        if customer_id:
            memory = await self.memory.as_dict(customer_id)
            budget = memory.get("budget")
            ctx = await self.store.chatbot_context(customer_id)
            wishlist_ids = ctx.get("wishlist_ids") or []

        rag = await self.rag.retrieve(query, customer_id=customer_id, limit_books=20)
        candidates = rag["books"] or []
        # Expand with bestsellers if thin
        if len(candidates) < 5:
            candidates = candidates + await self.store.bestseller(8)

        ranked = await self.score_books(
            candidates,
            query=query,
            memory=memory,
            wishlist_ids=wishlist_ids,
            budget=budget,
        )
        top = ranked[:limit]

        explanation = ""
        if force_llm and top:
            pack_text = self.rag.format_for_prompt({**rag, "books": top})
            prompt = (
                f"Khách hỏi: {query}\n\n"
                f"{pack_text}\n\n"
                "Hãy gợi ý 3–5 cuốn từ danh sách trên (tiếng Việt, xưng mình/bạn). "
                "Giải thích vì sao hợp (không random). Nhắc giá/tồn đúng số liệu. "
                "Có thể gợi ý lộ trình đọc ngắn và 1 voucher nếu phù hợp."
            )
            try:
                result = await self.llm.complete(
                    [
                        LLMMessage(role="system", content=CONCIERGE_SYSTEM_PROMPT),
                        LLMMessage(role="user", content=prompt),
                    ]
                )
                explanation = result.content
                provider = result.provider
                model = result.model
            except Exception as exc:
                explanation = (
                    "Mình đã chọn vài đầu sách dựa trên lịch sử và độ phù hợp. "
                    f"(LLM tạm lỗi: {exc})"
                )
                provider, model = "none", "none"
        else:
            explanation = "Gợi ý theo điểm tương đồng và bestseller."
            provider, model = "ranker", "smart-v1"

        # Persist light preference signal
        if customer_id and query:
            await self.memory.update(customer_id, append_search=query)

        return {
            "query": query,
            "books": top,
            "message": explanation,
            "signals_used": {
                "search_history": (memory.get("search_history") or [])[-5:],
                "favorite_authors": memory.get("favorite_authors"),
                "favorite_genres": memory.get("favorite_genres"),
                "budget": budget,
                "wishlist": wishlist_ids,
                "bestsellers": True,
                "trends": True,
            },
            "provider": provider,
            "model": model,
        }
