"""
Retrieval-Augmented Generation for BookNest Concierge.

Priority:
  1. Website database (catalog, inventory, prices)
  2. CMS (categories, vouchers, authors)
  3. Internal documentation / FAQ
  4. LLM generative layer (caller injects retrieved text)

No external vector DB required for v1 — keyword + scoring over live StoreService.
Pluggable for Chroma/Qdrant later via VECTOR_BACKEND.
"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.store_service import StoreService


FAQ_DOCS: list[dict[str, str]] = [
    {
        "id": "faq-ship",
        "title": "Vận chuyển",
        "text": "Đơn từ 400.000đ miễn phí ship. Giao tiêu chuẩn 2–5 ngày làm việc. Hỗ trợ đổi địa chỉ trước khi đơn sang trạng thái đang giao.",
    },
    {
        "id": "faq-return",
        "title": "Đổi trả",
        "text": "Đổi/trả trong 14 ngày nếu sách còn nguyên. Chatbot hỗ trợ tạo yêu cầu hoàn tiền / đổi trả.",
    },
    {
        "id": "faq-pay",
        "title": "Thanh toán",
        "text": "Hỗ trợ COD, MoMo, VNPay, ZaloPay, Visa, Mastercard. Không yêu cầu số thẻ trong chat.",
    },
    {
        "id": "faq-member",
        "title": "Thành viên",
        "text": "Hạng Gold/Platinum: Flash Sale sớm, mã MEMBER15, tích điểm loyalty.",
    },
    {
        "id": "faq-student",
        "title": "Sinh viên",
        "text": "Ưu đãi STUDENT10 sau khi xác thực hồ sơ sinh viên.",
    },
]


class RAGRetriever:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.store = StoreService(db)

    def _score(self, query: str, text: str) -> float:
        q = set(query.lower().replace(",", " ").split())
        t = set(text.lower().replace(",", " ").split())
        if not q:
            return 0.0
        return len(q & t) / max(1, len(q))

    async def retrieve(
        self,
        query: str,
        *,
        customer_id: Optional[int] = None,
        limit_books: int = 8,
    ) -> dict[str, Any]:
        """Return structured knowledge pack for the LLM."""
        # 1) Catalog
        catalog = await self.store.list_books(query=query, page_size=limit_books)
        books = catalog["items"]
        if not books and len(query) > 2:
            # broaden: bestseller + trending
            books = await self.store.bestseller(limit=4)
            books += await self.store.trending(limit=4)

        # 2) CMS: categories, vouchers, authors
        categories = await self.store.list_categories()
        vouchers = await self.store.vouchers_available(customer_id)
        authors = (await self.store.list_authors(page_size=30))["items"]

        # 3) Docs / FAQ
        docs = sorted(
            FAQ_DOCS,
            key=lambda d: self._score(query, d["title"] + " " + d["text"]),
            reverse=True,
        )[:3]

        # Personal context
        personal = await self.store.chatbot_context(customer_id) if customer_id else {}

        return {
            "query": query,
            "priority": ["database", "cms", "documentation", "llm"],
            "books": books[:limit_books],
            "categories": categories,
            "vouchers": vouchers,
            "authors": authors[:10],
            "docs": docs,
            "personal": {
                "user": personal.get("user"),
                "cart": personal.get("cart"),
                "wishlist_ids": personal.get("wishlist_ids"),
                "recent_orders": personal.get("recent_orders"),
            },
            "catalog_text": await self.store.catalog_for_ai(limit=12),
        }

    def format_for_prompt(self, pack: dict[str, Any]) -> str:
        lines = [
            "## Kiến thức truy xuất (RAG — ưu tiên DB/CMS trước khi suy luận)",
            f"Query: {pack.get('query')}",
            "",
            "### Catalog / giá / tồn (từ database — không bịa giá)",
        ]
        for b in pack.get("books") or []:
            lines.append(
                f"- id={b['id']} | {b['title']} | {b.get('author_name')} | "
                f"{b.get('price', 0):,.0f} {b.get('currency', 'VND')} | stock={b.get('stock')} | "
                f"rating={b.get('rating')} | cat={b.get('category')}"
            )
        lines.append("\n### Voucher / CMS")
        for v in (pack.get("vouchers") or [])[:8]:
            lines.append(f"- {v.get('code')}: {v.get('description')}")
        lines.append("\n### Tài liệu nội bộ")
        for d in pack.get("docs") or []:
            lines.append(f"- {d['title']}: {d['text']}")
        if pack.get("personal", {}).get("user"):
            lines.append(f"\n### Khách: {pack['personal']['user']}")
        if pack.get("personal", {}).get("cart"):
            lines.append(f"### Giỏ: {pack['personal']['cart']}")
        lines.append(
            "\nChỉ dùng giá/tồn kho ở trên. Nếu thiếu dữ liệu, nói thật và mời khách cung cấp thêm."
        )
        return "\n".join(lines)
