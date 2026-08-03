"""Core AI chat orchestration — provider-agnostic."""

from typing import Any, AsyncIterator, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import LLMMessage
from app.ai.factory import get_llm_provider
from app.memory.chat_memory import ChatMemoryService
from app.memory.customer_memory import CustomerMemoryService
from app.prompts.system import BOOKSTORE_SYSTEM_PROMPT, build_context_prompt
from app.schemas.chat import ChatContext, ChatRequest, ChatResponse
from app.services.catalog_service import CatalogService
from app.services.commerce_service import CommerceService
from app.services.usage_service import UsageService
from app.utils.logging import logger


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.chat_memory = ChatMemoryService(db)
        self.customer_memory = CustomerMemoryService(db)
        self.catalog = CatalogService(db)
        self.commerce = CommerceService(db)
        self.usage = UsageService(db)
        self.llm = get_llm_provider()

    async def _build_messages(
        self,
        session,
        user_message: str,
        context: Optional[ChatContext],
        language: str,
    ) -> List[LLMMessage]:
        customer_data = None
        memory_data = None
        cart_data = None
        current_book = None
        coupons = None
        orders = None
        website_inventory: List[dict] = []

        customer_id = (context.customer_id if context else None) or session.customer_id
        if customer_id:
            customer = await self.customer_memory.get_customer(customer_id)
            if customer:
                customer_data = {
                    "id": customer.id,
                    "name": customer.name,
                    "membership": customer.membership_tier,
                    "language": customer.language,
                }
                memory_data = await self.customer_memory.as_dict(customer_id)
            cart_data = (await self.commerce.cart_summary(customer_id))["items"]

        if context:
            # 1) Website inventory snapshot — full truth for stock/price
            if context.website_inventory:
                website_inventory = list(context.website_inventory)

            # 2) Current book: prefer the full object sent by the website
            if context.current_book and isinstance(context.current_book, dict):
                current_book = dict(context.current_book)
                if "author_name" not in current_book and current_book.get("author"):
                    current_book["author_name"] = current_book["author"]
                if "sale_price" not in current_book and current_book.get("salePrice") is not None:
                    current_book["sale_price"] = current_book["salePrice"]
            elif context.current_book_id:
                current_book = next(
                    (
                        b
                        for b in website_inventory
                        if isinstance(b, dict) and b.get("id") == context.current_book_id
                    ),
                    None,
                )
                if not current_book:
                    book = await self.catalog.get_book(context.current_book_id)
                    if book:
                        current_book = self.catalog.to_out(book).model_dump()
            if context.current_book_id and customer_id:
                await self.customer_memory.update(
                    customer_id, append_viewed=context.current_book_id
                )

            # 3) Fold wishlist / viewed books into inventory awareness
            for extra in (context.wishlist_books, context.viewed_book_details):
                for row in extra or []:
                    if not isinstance(row, dict) or row.get("id") is None:
                        continue
                    if not any(
                        b.get("id") == row["id"] for b in website_inventory if isinstance(b, dict)
                    ):
                        website_inventory.append(row)

            if context.coupons:
                coupons = context.coupons
            if context.cart:
                cart_data = context.cart
            if context.orders:
                orders = context.orders

        category = context.current_category if context else None
        catalog_snippet = await self.catalog.catalog_snippet(limit=12, category=category)

        system = BOOKSTORE_SYSTEM_PROMPT + "\n\n" + build_context_prompt(
            customer=customer_data,
            memory=memory_data,
            cart=cart_data,
            wishlist=context.wishlist if context else None,
            current_page=context.current_page if context else session.current_page,
            current_book=current_book,
            current_category=category,
            catalog_snippet=catalog_snippet,
            website_inventory=website_inventory,
            coupons=coupons,
            orders=orders,
            search_history=context.search_history if context else None,
            language=language,
        )

        messages: List[LLMMessage] = [LLMMessage(role="system", content=system)]
        history = await self.chat_memory.recent_messages(session, limit=16)
        for msg in history:
            if msg.role in ("user", "assistant"):
                messages.append(LLMMessage(role=msg.role, content=msg.content))
        messages.append(LLMMessage(role="user", content=user_message))
        return messages

    def _detect_intent(self, message: str) -> str:
        m = message.lower()
        if any(w in m for w in ("recommend", "suggest", "gợi ý", "đề xuất")):
            return "recommend"
        if any(w in m for w in ("compare", "so sánh", "vs")):
            return "compare"
        if any(w in m for w in ("cart", "giỏ", "add to cart")):
            return "cart"
        if any(w in m for w in ("checkout", "thanh toán", "buy", "mua")):
            return "checkout"
        if any(w in m for w in ("track", "order", "đơn hàng", "shipping")):
            return "track_order"
        if any(w in m for w in ("refund", "return", "hoàn", "đổi trả")):
            return "refund_return"
        if any(w in m for w in ("voucher", "coupon", "mã giảm")):
            return "voucher"
        if any(w in m for w in ("search", "tìm", "find book")):
            return "search"
        return "general"

    async def chat(self, req: ChatRequest) -> ChatResponse:
        language = req.language or (req.context.language if req.context else "vi") or "vi"
        ctx_dict = req.context.model_dump(exclude_none=True) if req.context else {}
        session = await self.chat_memory.get_or_create_session(
            session_key=req.session_id,
            customer_id=req.customer_id or (req.context.customer_id if req.context else None),
            language=language,
            context=ctx_dict,
        )
        if req.context and req.context.current_page:
            session.current_page = req.context.current_page

        intent = self._detect_intent(req.message)
        await self.chat_memory.add_message(session, "user", req.message, intent=intent)

        messages = await self._build_messages(session, req.message, req.context, language)

        try:
            result = await self.llm.complete(messages)
            await self.usage.log(
                provider=result.provider,
                model=result.model,
                prompt=req.message,
                response=result.content,
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
                total_tokens=result.total_tokens,
                latency_ms=result.latency_ms,
                customer_id=session.customer_id,
                session_id=session.id,
                endpoint="/chat",
            )
            await self.chat_memory.add_message(
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
            return ChatResponse(
                session_id=session.session_key,
                message=result.content,
                intent=intent,
                provider=result.provider,
                model=result.model,
                latency_ms=result.latency_ms,
                usage=result.usage,
            )
        except Exception as exc:
            logger.exception("Chat failed: %s", exc)
            await self.usage.log(
                provider=getattr(self.llm, "name", "unknown"),
                model=getattr(self.llm, "model", "unknown"),
                prompt=req.message,
                success=False,
                error=str(exc),
                customer_id=session.customer_id,
                session_id=session.id,
                endpoint="/chat",
            )
            fallback = (
                "I'm having trouble reaching the AI service right now. "
                "Please try again in a moment, or browse our catalog with /books."
            )
            await self.chat_memory.add_message(session, "assistant", fallback, intent="error")
            return ChatResponse(
                session_id=session.session_key,
                message=fallback,
                intent="error",
                provider=getattr(self.llm, "name", None),
                model=getattr(self.llm, "model", None),
            )

    async def stream_chat(self, req: ChatRequest) -> AsyncIterator[dict[str, Any]]:
        language = req.language or (req.context.language if req.context else "vi") or "vi"
        ctx_dict = req.context.model_dump(exclude_none=True) if req.context else {}
        session = await self.chat_memory.get_or_create_session(
            session_key=req.session_id,
            customer_id=req.customer_id or (req.context.customer_id if req.context else None),
            language=language,
            context=ctx_dict,
        )
        intent = self._detect_intent(req.message)
        await self.chat_memory.add_message(session, "user", req.message, intent=intent)
        messages = await self._build_messages(session, req.message, req.context, language)

        yield {"session_id": session.session_key, "delta": "", "done": False, "meta": {"intent": intent}}

        full = []
        try:
            async for delta in self.llm.stream(messages):
                full.append(delta)
                yield {"session_id": session.session_key, "delta": delta, "done": False}
            content = "".join(full)
            await self.chat_memory.add_message(
                session,
                "assistant",
                content,
                intent=intent,
                provider=getattr(self.llm, "name", None),
                model=getattr(self.llm, "model", None),
            )
            await self.usage.log(
                provider=getattr(self.llm, "name", "unknown"),
                model=getattr(self.llm, "model", "unknown"),
                prompt=req.message,
                response=content,
                customer_id=session.customer_id,
                session_id=session.id,
                endpoint="/chat/stream",
            )
            yield {
                "session_id": session.session_key,
                "delta": "",
                "done": True,
                "meta": {"intent": intent, "provider": getattr(self.llm, "name", None)},
            }
        except Exception as exc:
            logger.exception("Stream chat failed: %s", exc)
            err = "Sorry, streaming failed. Please retry."
            yield {"session_id": session.session_key, "delta": err, "done": True, "meta": {"error": str(exc)}}
