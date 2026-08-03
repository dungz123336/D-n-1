"""
Concierge chat orchestration.

Combines: multi-provider LLM + conversation memory + customer memory + bookstore tools.
"""

from typing import Any, AsyncIterator, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.llm.base import LLMMessage
from backend.llm.factory import get_llm_provider
from backend.memory.conversation import ConversationMemory
from backend.memory.customer_store import CustomerMemoryStore
from backend.models.entities import AIUsageLog, Recommendation
from backend.prompts.system import CONCIERGE_SYSTEM_PROMPT, build_context_block, build_inventory_block
from backend.schemas.chat import ChatContext, ChatRequest, ChatResponse
from backend.tools.bookstore_tools import BookstoreTools
from backend.services.store_service import StoreService
from backend.memory.rag import RAGRetriever
from backend.services.smart_recommend import SmartRecommendEngine
from backend.services.roadmap_engine import RoadmapEngine
from backend.services.compare_engine import CompareEngine
from backend.services.content_engine import ContentEngine
from backend.services.promotion_engine import PromotionEngine
from backend.utils.logging import logger


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.conv = ConversationMemory(db)
        self.cust = CustomerMemoryStore(db)
        self.tools = BookstoreTools(db)
        self.store = StoreService(db)
        self.rag = RAGRetriever(db)
        self.smart = SmartRecommendEngine(db)
        self.roadmaps = RoadmapEngine(db)
        self.comparer = CompareEngine(db)
        self.content = ContentEngine(db)
        self.promos = PromotionEngine(db)
        self.llm = get_llm_provider()

    @staticmethod
    def _match_website_inventory(
        query: str, inventory: list, limit: int = 6
    ) -> list[dict]:
        """Score website books by title/author/category keywords; keep real stock."""
        if not inventory or not query:
            return []
        q = query.lower()
        tokens = [t for t in q.replace(",", " ").split() if len(t) > 1]
        scored: list[tuple[float, dict]] = []
        for b in inventory:
            if not isinstance(b, dict):
                continue
            blob = " ".join(
                str(x or "")
                for x in (
                    b.get("title"),
                    b.get("author"),
                    b.get("author_name"),
                    b.get("category"),
                    b.get("slug"),
                    " ".join(b.get("tags") or []),
                )
            ).lower()
            score = 0.0
            for t in tokens:
                if t in blob:
                    score += 2
            # boost in-stock
            stock = int(b.get("stock") or 0)
            if stock > 0:
                score += 0.5
            else:
                score -= 1
            if score > 0:
                scored.append((score, b))
        scored.sort(key=lambda x: x[0], reverse=True)
        out = []
        for _, b in scored[:limit]:
            row = dict(b)
            # normalize for frontend cards
            row.setdefault("author_name", b.get("author"))
            row.setdefault("price", b.get("sale_price") or b.get("price"))
            row["currency"] = "VND"
            out.append(row)
        return out

    def detect_intent(self, message: str) -> str:
        m = message.lower()
        rules = [
            (("lộ trình", "roadmap", "kế hoạch đọc", "30 ngày"), "roadmap"),
            (("so sánh", "compare", "đối chiếu"), "compare"),
            (("tóm tắt", "summary", "bài học chính", "spoiler"), "summary"),
            (("quiz", "flashcard", "kiểm tra", "câu hỏi ôn"), "quiz"),
            (("học ai", "machine learning", "deep learning", "prompt engineering"), "recommend"),
            (("gợi ý", "recommend", "tư vấn sách", "quà", "làm quà", "gift"), "recommend"),
            (("giỏ", "giỏ hàng", "thêm vào giỏ", "cart"), "cart"),
            (("thanh toán", "checkout", "mua ngay", "cod", "momo", "vnpay", "zalopay"), "checkout"),
            (("đơn hàng", "theo dõi", "tra cứu đơn", "giao hàng", "hủy đơn", "đổi địa chỉ"), "track_order"),
            (("mã giảm", "voucher", "coupon", "ưu đãi", "flash sale", "combo"), "voucher"),
            (("điểm thưởng", "loyalty", "hạng thành viên", "member"), "loyalty"),
            (("hoàn tiền", "refund"), "refund"),
            (("đổi trả", "đổi sách", "exchange", "return"), "exchange"),
            (("yêu thích", "wishlist", "lưu sách"), "wishlist"),
            (("barcode", "isbn", "quét mã", "mã vạch"), "barcode"),
            (("chính sách", "faq", "vận chuyển", "ship"), "faq"),
            (("tìm sách", "search", "sách dưới", "bán chạy", "sách mới"), "search"),
            (("dưới 200", "dưới 300", "khoảng 200", "sách rẻ", "cao cấp", "ngân sách"), "budget"),
        ]
        for keys, intent in rules:
            if any(k in m for k in keys):
                return intent
        return "general"

    async def _build_messages(
        self,
        session,
        user_message: str,
        context: Optional[ChatContext],
        language: str,
    ) -> List[LLMMessage]:
        customer_data = memory_data = cart_data = current_book = None
        coupons = None
        website_inventory: list = []
        customer_id = (context.customer_id if context else None) or session.customer_id

        # Realtime AI-DB pack (secondary). Website inventory is primary truth.
        live = await self.store.chatbot_context(customer_id)
        if customer_id:
            customer = await self.cust.get_customer(customer_id)
            if customer:
                customer_data = {
                    "id": customer.id,
                    "name": customer.name,
                    "membership": customer.membership_tier,
                    "language": customer.language,
                }
                memory_data = await self.cust.as_dict(customer_id)
            cart_data = (live.get("cart") or {}).get("items") or []

        if context:
            # 1) Website inventory snapshot (full truth for stock/price)
            if context.website_inventory:
                website_inventory = list(context.website_inventory)
            # 2) Current book: prefer full object from website
            if context.current_book and isinstance(context.current_book, dict):
                current_book = dict(context.current_book)
                # normalize field names
                if "author_name" not in current_book and current_book.get("author"):
                    current_book["author_name"] = current_book.get("author")
                if "sale_price" not in current_book and current_book.get("salePrice") is not None:
                    current_book["sale_price"] = current_book.get("salePrice")
            elif context.current_book_id:
                # try match from website inventory first
                current_book = next(
                    (
                        b
                        for b in website_inventory
                        if isinstance(b, dict) and b.get("id") == context.current_book_id
                    ),
                    None,
                )
                if not current_book:
                    current_book = await self.store.get_book(context.current_book_id)
                if customer_id and context.current_book_id:
                    await self.cust.update(customer_id, append_viewed=context.current_book_id)
            if context.coupons:
                coupons = context.coupons
            if context.cart:
                cart_data = context.cart
            if context.wishlist_books:
                # merge wishlist books into inventory awareness
                for wb in context.wishlist_books:
                    if isinstance(wb, dict) and wb.get("id") is not None:
                        if not any(x.get("id") == wb.get("id") for x in website_inventory if isinstance(x, dict)):
                            website_inventory.append(wb)
            if context.viewed_book_details:
                for vb in context.viewed_book_details:
                    if isinstance(vb, dict) and vb.get("id") is not None:
                        if not any(x.get("id") == vb.get("id") for x in website_inventory if isinstance(x, dict)):
                            website_inventory.append(vb)

        if coupons is None:
            coupons = live.get("vouchers")

        # Fallback inventory from AI DB only if website sent nothing
        if not website_inventory:
            ai_books = await self.store.list_books(page_size=40)
            website_inventory = [
                {
                    "id": b["id"],
                    "title": b["title"],
                    "author": b.get("author_name"),
                    "price": b.get("original_price") or b.get("price"),
                    "sale_price": b.get("price"),
                    "stock": b.get("stock"),
                    "rating": b.get("rating"),
                    "category": b.get("category"),
                    "slug": b.get("slug"),
                }
                for b in ai_books.get("items") or []
            ]

        category = context.current_category if context else None
        catalog = await self.store.catalog_for_ai(limit=15, category=category)
        # RAG pack — retrieve before generate (secondary to website inventory)
        rag_pack = await self.rag.retrieve(user_message, customer_id=customer_id, limit_books=8)
        rag_text = self.rag.format_for_prompt(rag_pack)

        system = CONCIERGE_SYSTEM_PROMPT + "\n\n" + build_context_block(
            customer=customer_data or live.get("user"),
            memory=memory_data,
            cart=cart_data,
            wishlist=context.wishlist if context else live.get("wishlist_ids"),
            current_page=context.current_page if context else session.current_page,
            current_book=current_book,
            catalog_snippet=catalog,
            website_inventory=website_inventory,
            coupons=coupons,
            language=language,
        )
        system += "\n\n" + rag_text
        # Attach live orders for tracking questions
        if live.get("recent_orders"):
            system += f"\n- Đơn hàng gần đây: {live['recent_orders']}"
        if live.get("payment_methods"):
            system += f"\n- Phương thức thanh toán hỗ trợ: {live['payment_methods']}"
        system += (
            "\n- Không bao giờ lộ dữ liệu admin/staff. "
            "Giá và tồn kho: ƯU TIÊN website_inventory. "
            "stock>0 thì CÒN HÀNG — tuyệt đối không nói hết sách."
        )
        # Keep inventory on session for response book cards
        session.context = {
            **(session.context or {}),
            "website_inventory": website_inventory[:100],
            "current_book": current_book,
        }

        messages: List[LLMMessage] = [LLMMessage(role="system", content=system)]
        for msg in await self.conv.recent(session, limit=16):
            if msg.role in ("user", "assistant"):
                messages.append(LLMMessage(role=msg.role, content=msg.content))
        messages.append(LLMMessage(role="user", content=user_message))
        return messages

    async def _log_usage(self, **kwargs: Any) -> None:
        self.db.add(AIUsageLog(**kwargs))
        await self.db.flush()

    async def chat(self, req: ChatRequest) -> ChatResponse:
        language = req.language or (req.context.language if req.context else "vi") or "vi"
        ctx = req.context.model_dump(exclude_none=True) if req.context else {}
        session = await self.conv.get_or_create(
            session_key=req.session_id,
            customer_id=req.customer_id or (req.context.customer_id if req.context else None),
            language=language,
            context=ctx,
        )
        if req.context and req.context.current_page:
            session.current_page = req.context.current_page

        intent = self.detect_intent(req.message)
        await self.conv.add_message(session, "user", req.message, intent=intent)
        messages = await self._build_messages(session, req.message, req.context, language)

        context = req.context

        # Tool-assisted enrichments (structured side channel).
        # Best-effort: a failing engine must degrade to a plain grounded answer,
        # never swallow the whole reply — website book ids often aren't in the AI DB.
        books_payload: Optional[list] = None
        actions: Optional[list] = None
        try:
            import re

            # Specialized engines for rich intents (still grounded in DB prices)
            if intent == "roadmap":
                road = await self.roadmaps.build(
                    req.message, customer_id=session.customer_id
                )
                books_payload = road.get("books")
                # Short-circuit with engine output as assistant message base
                messages.append(
                    LLMMessage(
                        role="system",
                        content="Dùng roadmap sau (đã gắn sách thật) để trả lời khách:\n"
                        + road.get("roadmap_markdown", ""),
                    )
                )
            elif intent == "compare":
                ids = [int(x) for x in re.findall(r"\bid\s*=?\s*(\d+)\b", req.message)]
                if len(ids) < 2 and context and context.current_book_id:
                    ids = [context.current_book_id] + ids
                if len(ids) >= 2:
                    ids = ids[:4]
                    # Prefer website rows — their ids/stock/price are the truth
                    inv = (session.context or {}).get("website_inventory") or []
                    web_rows = [
                        b
                        for b in inv
                        if isinstance(b, dict) and b.get("id") in ids
                    ]
                    if len(web_rows) >= 2:
                        books_payload = web_rows
                        rows = "\n".join(
                            f"- id={b.get('id')} | {b.get('title')} | {b.get('author')} | "
                            f"giá={b.get('sale_price') or b.get('price')}đ | "
                            f"stock={b.get('stock')} "
                            f"({'CÒN HÀNG' if int(b.get('stock') or 0) > 0 else 'HẾT HÀNG'}) | "
                            f"rating={b.get('rating')} | {b.get('category')}"
                            for b in web_rows
                        )
                        messages.append(
                            LLMMessage(
                                role="system",
                                content=(
                                    "So sánh các cuốn sau bằng bảng markdown (Tên, Tác giả, Giá, "
                                    "Tồn kho, Rating, Phù hợp với, Ưu điểm, Nhược điểm), rồi kết "
                                    "bằng một đoạn khuyên chọn cuốn nào cho ai. "
                                    "Dùng đúng giá/tồn kho WEBSITE dưới đây:\n" + rows
                                ),
                            )
                        )
                    else:
                        cmp = await self.comparer.compare(ids)
                        books_payload = cmp.get("books")
                        messages.append(
                            LLMMessage(
                                role="system",
                                content="Bảng so sánh đã tính:\n" + cmp.get("comparison_markdown", ""),
                            )
                        )
            elif intent == "summary" and context and context.current_book_id:
                sm = await self.content.summarize(context.current_book_id)
                books_payload = [sm["book"]] if sm.get("book") else None
                messages.append(
                    LLMMessage(role="system", content="Tóm tắt sách:\n" + sm.get("summary_markdown", ""))
                )
            elif intent == "quiz" and context and context.current_book_id:
                qz = await self.content.quiz(context.current_book_id)
                messages.append(
                    LLMMessage(role="system", content="Quiz/flashcards:\n" + qz.get("quiz_markdown", ""))
                )
            elif intent == "loyalty" and session.customer_id:
                loy = await self.promos.loyalty(session.customer_id)
                messages.append(
                    LLMMessage(role="system", content=f"Loyalty profile (không lộ admin):\n{loy}")
                )
            elif intent == "voucher":
                promos = await self.promos.detect_promotions(session.customer_id)
                messages.append(
                    LLMMessage(role="system", content=f"Khuyến mãi realtime:\n{promos}")
                )
            elif intent in ("search", "budget", "recommend"):
                # Prefer website inventory for matching (real stock)
                inv = (session.context or {}).get("website_inventory") or []
                web_hits = self._match_website_inventory(req.message, inv, limit=6)
                if web_hits:
                    books_payload = web_hits
                    stock_lines = "\n".join(
                        f"- {b.get('title')}: stock={b.get('stock')} "
                        f"({'CÒN HÀNG' if int(b.get('stock') or 0) > 0 else 'HẾT HÀNG'}), "
                        f"giá={b.get('sale_price') or b.get('price')}đ"
                        for b in web_hits
                    )
                    messages.append(
                        LLMMessage(
                            role="system",
                            content=(
                                "Sách khớp từ WEBSITE (dùng stock/giá này, không nói hết nếu stock>0):\n"
                                + stock_lines
                            ),
                        )
                    )
                else:
                    smart = await self.smart.recommend(
                        req.message, customer_id=session.customer_id, limit=5
                    )
                    books_payload = smart.get("books")
                    messages.append(
                        LLMMessage(
                            role="system",
                            content="Gợi ý thông minh (đã chấm điểm):\n" + (smart.get("message") or ""),
                        )
                    )
            elif intent == "barcode":
                codes = re.findall(r"\d{10,13}", req.message)
                if codes:
                    found = await self.store.find_by_barcode(codes[0])
                    books_payload = [found] if found else []
            elif intent == "faq":
                faq = await self.tools.faq_answer(req.message)
                messages.append(
                    LLMMessage(role="system", content=f"Kiến thức FAQ để dùng:\n{faq}")
                )
        except Exception as exc:
            # Enrichment is optional — the website context in `messages` is enough.
            logger.warning("Enrichment skipped (intent=%s): %s", intent, exc)

        try:
            result = await self.llm.complete(messages)
            await self._log_usage(
                customer_id=session.customer_id,
                session_id=session.id,
                endpoint="/chat",
                provider=result.provider,
                model=result.model,
                prompt=req.message if True else None,
                response=result.content[:2000],
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
                total_tokens=result.total_tokens,
                latency_ms=result.latency_ms,
                success=True,
            )
            await self.conv.add_message(
                session,
                "assistant",
                result.content,
                intent=intent,
                provider=result.provider,
                model=result.model,
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
                latency_ms=result.latency_ms,
            )

            if intent == "recommend" and not books_payload:
                books_payload = await self.store.recommend_for_user(
                    customer_id=session.customer_id, limit=3
                )
                self.db.add(
                    Recommendation(
                        customer_id=session.customer_id,
                        book_ids=[b["id"] for b in books_payload],
                        reason=result.content[:1500],
                        criteria={"message": req.message},
                    )
                )
                await self.db.flush()

            return ChatResponse(
                session_id=session.session_key,
                message=result.content,
                intent=intent,
                books=books_payload,
                actions=actions,
                provider=result.provider,
                model=result.model,
                latency_ms=result.latency_ms,
                usage=result.usage,
            )
        except Exception as exc:
            logger.exception("Chat failed: %s", exc)
            await self._log_usage(
                customer_id=session.customer_id,
                session_id=session.id,
                endpoint="/chat",
                provider=getattr(self.llm, "name", "unknown"),
                model=getattr(self.llm, "model", "unknown"),
                prompt=req.message,
                success=False,
                error=str(exc),
            )
            fallback = (
                "Xin lỗi ✨\n\n"
                "Hiện tại mình chưa lấy được dữ liệu.\n"
                "Bạn thử lại sau ít phút nhé."
            )
            await self.conv.add_message(session, "assistant", fallback, intent="error")
            return ChatResponse(
                session_id=session.session_key,
                message=fallback,
                intent="error",
                provider=getattr(self.llm, "name", None),
                model=getattr(self.llm, "model", None),
            )

    async def stream_chat(self, req: ChatRequest) -> AsyncIterator[dict[str, Any]]:
        language = req.language or (req.context.language if req.context else "vi") or "vi"
        ctx = req.context.model_dump(exclude_none=True) if req.context else {}
        session = await self.conv.get_or_create(
            session_key=req.session_id,
            customer_id=req.customer_id or (req.context.customer_id if req.context else None),
            language=language,
            context=ctx,
        )
        intent = self.detect_intent(req.message)
        await self.conv.add_message(session, "user", req.message, intent=intent)
        messages = await self._build_messages(session, req.message, req.context, language)

        yield {"session_id": session.session_key, "delta": "", "done": False, "meta": {"intent": intent}}
        full: list[str] = []
        try:
            async for delta in self.llm.stream(messages):
                full.append(delta)
                yield {"session_id": session.session_key, "delta": delta, "done": False}
            content = "".join(full)
            await self.conv.add_message(
                session,
                "assistant",
                content,
                intent=intent,
                provider=getattr(self.llm, "name", None),
                model=getattr(self.llm, "model", None),
            )
            yield {
                "session_id": session.session_key,
                "delta": "",
                "done": True,
                "meta": {"intent": intent, "provider": getattr(self.llm, "name", None)},
            }
        except Exception as exc:
            logger.exception("Stream failed: %s", exc)
            yield {
                "session_id": session.session_key,
                "delta": "Xin lỗi ✨ Hiện tại mình chưa lấy được dữ liệu. Bạn thử lại sau ít phút nhé.",
                "done": True,
                "meta": {"error": str(exc)},
            }
