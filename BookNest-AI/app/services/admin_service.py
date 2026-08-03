"""Admin analytics APIs."""

from typing import Any, List

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.book import Book
from app.models.chat import ChatMessage, ChatSession
from app.models.order import Order
from app.models.usage_log import AIUsageLog

# selectinload reserved for future eager loads


class AdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def chat_history(self, limit: int = 100) -> List[dict[str, Any]]:
        result = await self.db.execute(
            select(ChatMessage).order_by(desc(ChatMessage.id)).limit(limit)
        )
        return [
            {
                "id": m.id,
                "session_id": m.session_id,
                "role": m.role,
                "content": m.content[:500],
                "intent": m.intent,
                "provider": m.provider,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in result.scalars().all()
        ]

    async def ai_usage(self, limit: int = 100) -> dict[str, Any]:
        result = await self.db.execute(
            select(AIUsageLog).order_by(desc(AIUsageLog.id)).limit(limit)
        )
        logs = list(result.scalars().all())
        totals = await self.db.execute(
            select(
                func.coalesce(func.sum(AIUsageLog.total_tokens), 0),
                func.coalesce(func.avg(AIUsageLog.latency_ms), 0),
                func.count(AIUsageLog.id),
            )
        )
        total_tokens, avg_latency, count = totals.one()
        by_provider = await self.db.execute(
            select(AIUsageLog.provider, func.count(AIUsageLog.id), func.sum(AIUsageLog.total_tokens))
            .group_by(AIUsageLog.provider)
        )
        return {
            "summary": {
                "calls": int(count or 0),
                "total_tokens": int(total_tokens or 0),
                "avg_latency_ms": float(avg_latency or 0),
            },
            "by_provider": [
                {"provider": p, "calls": int(c), "tokens": int(t or 0)} for p, c, t in by_provider.all()
            ],
            "recent": [
                {
                    "id": l.id,
                    "provider": l.provider,
                    "model": l.model,
                    "endpoint": l.endpoint,
                    "total_tokens": l.total_tokens,
                    "latency_ms": l.latency_ms,
                    "success": l.success,
                    "created_at": l.created_at.isoformat() if l.created_at else None,
                }
                for l in logs
            ],
        }

    async def ai_sales(self) -> dict[str, Any]:
        result = await self.db.execute(
            select(func.count(Order.id), func.coalesce(func.sum(Order.total), 0)).where(
                Order.ai_assisted.is_(True)
            )
        )
        order_count, revenue = result.one()
        top = await self.db.execute(
            select(Book).where(Book.ai_sales_count > 0).order_by(desc(Book.ai_sales_count)).limit(10)
        )
        return {
            "ai_assisted_orders": int(order_count or 0),
            "ai_assisted_revenue": float(revenue or 0),
            "top_ai_books": [
                {"id": b.id, "title": b.title, "ai_sales_count": b.ai_sales_count, "price": b.price}
                for b in top.scalars().all()
            ],
        }

    async def popular_books(self, limit: int = 10) -> List[dict[str, Any]]:
        result = await self.db.execute(
            select(Book).order_by(desc(Book.sales_count), desc(Book.rating)).limit(limit)
        )
        return [
            {
                "id": b.id,
                "title": b.title,
                "sales_count": b.sales_count,
                "ai_sales_count": b.ai_sales_count,
                "rating": b.rating,
                "price": b.price,
            }
            for b in result.scalars().all()
        ]

    async def popular_questions(self, limit: int = 20) -> dict[str, Any]:
        result = await self.db.execute(
            select(ChatMessage.intent, func.count(ChatMessage.id))
            .where(ChatMessage.role == "user")
            .group_by(ChatMessage.intent)
            .order_by(desc(func.count(ChatMessage.id)))
            .limit(limit)
        )
        intents = [{"intent": i or "general", "count": int(c)} for i, c in result.all()]

        recent_q = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.role == "user")
            .order_by(desc(ChatMessage.id))
            .limit(limit)
        )
        samples = [
            {"id": m.id, "content": m.content[:200], "intent": m.intent}
            for m in recent_q.scalars().all()
        ]
        return {"by_intent": intents, "recent_samples": samples}

    async def customer_satisfaction(self) -> dict[str, Any]:
        result = await self.db.execute(
            select(
                func.avg(ChatSession.satisfaction),
                func.count(ChatSession.id),
            ).where(ChatSession.satisfaction.is_not(None))
        )
        avg, counted = result.one()
        return {
            "avg_satisfaction": float(avg) if avg is not None else None,
            "rated_sessions": int(counted or 0),
        }
