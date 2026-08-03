"""Short-term chat history per session."""

import uuid
from typing import Any, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.entities import ChatMessage, ChatSession


class ConversationMemory:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create(
        self,
        session_key: Optional[str] = None,
        customer_id: Optional[int] = None,
        language: str = "en",
        context: Optional[dict[str, Any]] = None,
    ) -> ChatSession:
        if session_key:
            result = await self.db.execute(
                select(ChatSession)
                .options(selectinload(ChatSession.messages))
                .where(ChatSession.session_key == session_key)
            )
            session = result.scalar_one_or_none()
            if session:
                if context:
                    session.context = {**(session.context or {}), **context}
                if customer_id and not session.customer_id:
                    session.customer_id = customer_id
                await self.db.flush()
                return session

        session = ChatSession(
            session_key=session_key or uuid.uuid4().hex,
            customer_id=customer_id,
            language=language,
            context=context or {},
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def add_message(self, session: ChatSession, role: str, content: str, **kwargs: Any) -> ChatMessage:
        msg = ChatMessage(
            session_id=session.id,
            role=role,
            content=content,
            intent=kwargs.get("intent"),
            provider=kwargs.get("provider"),
            model=kwargs.get("model"),
            prompt_tokens=kwargs.get("prompt_tokens"),
            completion_tokens=kwargs.get("completion_tokens"),
            latency_ms=kwargs.get("latency_ms"),
            meta=kwargs.get("meta") or {},
        )
        self.db.add(msg)
        await self.db.flush()
        return msg

    async def recent(self, session: ChatSession, limit: int = 20) -> List[ChatMessage]:
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.id.desc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        rows.reverse()
        return rows

    async def history_for_customer(self, customer_id: int, limit: int = 50) -> List[ChatMessage]:
        result = await self.db.execute(
            select(ChatMessage)
            .join(ChatSession)
            .where(ChatSession.customer_id == customer_id)
            .order_by(ChatMessage.id.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
