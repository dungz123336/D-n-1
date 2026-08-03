"""Admin analytics (X-API-Key)."""

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db
from backend.models.entities import AIUsageLog, Book, ChatMessage, Order
from backend.schemas.common import APIResponse

router = APIRouter()
settings = get_settings()


async def require_admin(x_api_key: str | None = Header(default=None, alias="X-API-Key")):
    if x_api_key != settings.admin_api_key:
        raise HTTPException(403, "Admin access required")
    return True


@router.get("/dashboard", dependencies=[Depends(require_admin)])
async def dashboard(db: AsyncSession = Depends(get_db)):
    usage_count = await db.scalar(select(func.count()).select_from(AIUsageLog)) or 0
    tokens = await db.scalar(select(func.coalesce(func.sum(AIUsageLog.total_tokens), 0))) or 0
    ai_orders = await db.scalar(
        select(func.count()).select_from(Order).where(Order.ai_assisted.is_(True))
    ) or 0
    revenue = await db.scalar(
        select(func.coalesce(func.sum(Order.total), 0)).where(Order.ai_assisted.is_(True))
    ) or 0
    top = await db.execute(select(Book).order_by(desc(Book.sales_count)).limit(5))
    intents = await db.execute(
        select(ChatMessage.intent, func.count(ChatMessage.id))
        .where(ChatMessage.role == "user")
        .group_by(ChatMessage.intent)
        .order_by(desc(func.count(ChatMessage.id)))
        .limit(10)
    )
    return APIResponse(
        data={
            "ai_usage": {"calls": int(usage_count), "total_tokens": int(tokens)},
            "ai_sales": {"orders": int(ai_orders), "revenue": float(revenue)},
            "popular_books": [
                {"id": b.id, "title": b.title, "sales_count": b.sales_count, "rating": b.rating}
                for b in top.scalars().all()
            ],
            "popular_intents": [{"intent": i or "general", "count": int(c)} for i, c in intents.all()],
        }
    )


@router.get("/ai-usage", dependencies=[Depends(require_admin)])
async def ai_usage(limit: int = Query(50, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIUsageLog).order_by(desc(AIUsageLog.id)).limit(limit))
    logs = [
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
        for l in result.scalars().all()
    ]
    return APIResponse(data=logs)
