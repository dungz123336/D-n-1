"""
Advanced AI feature endpoints.

Smart recommend · Compare · Roadmap · Summary · Quiz ·
Promotions · Loyalty · Shipping · RAG · Analytics extras
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db
from backend.models.entities import AIUsageLog, Book, ChatMessage, Order, Recommendation
from backend.schemas.common import APIResponse
from backend.services.compare_engine import CompareEngine
from backend.services.content_engine import ContentEngine
from backend.services.promotion_engine import PromotionEngine
from backend.services.roadmap_engine import RoadmapEngine
from backend.services.smart_recommend import SmartRecommendEngine
from backend.memory.rag import RAGRetriever

router = APIRouter(prefix="/ai", tags=["Advanced AI"])
settings = get_settings()


async def require_admin(x_api_key: str | None = Header(default=None, alias="X-API-Key")):
    if x_api_key != settings.admin_api_key:
        raise HTTPException(403, "Admin only")
    return True


# ---------- Smart recommendation ----------
class RecommendBody(BaseModel):
    query: str
    customer_id: Optional[int] = None
    limit: int = Field(default=5, ge=1, le=12)


@router.post("/smart-recommend")
async def smart_recommend(body: RecommendBody, db: AsyncSession = Depends(get_db)):
    data = await SmartRecommendEngine(db).recommend(
        body.query, customer_id=body.customer_id, limit=body.limit
    )
    return APIResponse(message="ok", data=data)


# ---------- Compare ----------
class CompareBody(BaseModel):
    book_ids: List[int] = Field(..., min_length=2, max_length=4)
    language: str = "vi"


@router.post("/compare")
async def ai_compare(body: CompareBody, db: AsyncSession = Depends(get_db)):
    try:
        data = await CompareEngine(db).compare(body.book_ids, body.language)
        return APIResponse(data=data)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except Exception as e:
        raise HTTPException(502, str(e)) from e


# ---------- Roadmap ----------
class RoadmapBody(BaseModel):
    topic: str
    customer_id: Optional[int] = None
    days: Optional[int] = None


@router.post("/roadmap")
async def roadmap(body: RoadmapBody, db: AsyncSession = Depends(get_db)):
    try:
        data = await RoadmapEngine(db).build(
            body.topic, customer_id=body.customer_id, days=body.days
        )
        return APIResponse(data=data)
    except Exception as e:
        raise HTTPException(502, str(e)) from e


# ---------- Summary / Quiz ----------
@router.get("/books/{book_id}/summary")
async def book_summary(
    book_id: int,
    spoiler: bool = False,
    db: AsyncSession = Depends(get_db),
):
    try:
        return APIResponse(data=await ContentEngine(db).summarize(book_id, spoiler=spoiler))
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    except Exception as e:
        raise HTTPException(502, str(e)) from e


@router.get("/books/{book_id}/quiz")
async def book_quiz(
    book_id: int,
    n: int = Query(5, ge=3, le=15),
    db: AsyncSession = Depends(get_db),
):
    try:
        return APIResponse(data=await ContentEngine(db).quiz(book_id, num_questions=n))
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    except Exception as e:
        raise HTTPException(502, str(e)) from e


# ---------- Promotions / Loyalty / Shipping ----------
@router.get("/promotions")
async def promotions(customer_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await PromotionEngine(db).detect_promotions(customer_id))


@router.get("/loyalty/{customer_id}")
async def loyalty(customer_id: int, db: AsyncSession = Depends(get_db)):
    try:
        return APIResponse(data=await PromotionEngine(db).loyalty(customer_id))
    except ValueError as e:
        raise HTTPException(404, str(e)) from e


@router.get("/shipping/estimate")
async def shipping_estimate(
    subtotal: float = Query(..., ge=0),
    city: str = "HCM",
    db: AsyncSession = Depends(get_db),
):
    return APIResponse(data=await PromotionEngine(db).shipping_estimate(subtotal, city))


# ---------- RAG ----------
@router.get("/rag/search")
async def rag_search(
    q: str = Query(..., min_length=1),
    customer_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    pack = await RAGRetriever(db).retrieve(q, customer_id=customer_id)
    return APIResponse(data=pack)


# ---------- Personal librarian snapshot ----------
@router.get("/librarian/{customer_id}")
async def personal_librarian(customer_id: int, db: AsyncSession = Depends(get_db)):
    from backend.memory.customer_store import CustomerMemoryStore
    from backend.services.store_service import StoreService

    mem = await CustomerMemoryStore(db).as_dict(customer_id)
    ctx = await StoreService(db).chatbot_context(customer_id)
    return APIResponse(
        data={
            "memory": mem,
            "wishlist_ids": ctx.get("wishlist_ids"),
            "cart": ctx.get("cart"),
            "recent_orders": ctx.get("recent_orders"),
            "user": ctx.get("user"),
        }
    )


# ---------- Admin analytics (advanced) ----------
@router.get("/admin/analytics", dependencies=[Depends(require_admin)], tags=["Admin"])
async def admin_analytics(db: AsyncSession = Depends(get_db)):
    sessions = await db.scalar(select(func.count()).select_from(ChatMessage).where(ChatMessage.role == "user")) or 0
    ai_orders = await db.scalar(
        select(func.count()).select_from(Order).where(Order.ai_assisted.is_(True))
    ) or 0
    revenue = float(
        await db.scalar(
            select(func.coalesce(func.sum(Order.total), 0)).where(Order.ai_assisted.is_(True))
        )
        or 0
    )
    failed = await db.scalar(
        select(func.count()).select_from(AIUsageLog).where(AIUsageLog.success.is_(False))
    ) or 0
    total_calls = await db.scalar(select(func.count()).select_from(AIUsageLog)) or 0
    accuracy = round(100 * (1 - (failed / total_calls)), 2) if total_calls else None

    intents = await db.execute(
        select(ChatMessage.intent, func.count(ChatMessage.id))
        .where(ChatMessage.role == "user")
        .group_by(ChatMessage.intent)
        .order_by(desc(func.count(ChatMessage.id)))
        .limit(15)
    )
    top_books = await db.execute(select(Book).order_by(desc(Book.ai_sales_count)).limit(10))
    recs = await db.scalar(select(func.count()).select_from(Recommendation)) or 0

    return APIResponse(
        data={
            "chat_sessions_proxy": int(sessions),
            "ai_assisted_orders": int(ai_orders),
            "revenue_from_chatbot": revenue,
            "conversion_rate_proxy": round(100 * ai_orders / sessions, 2) if sessions else 0,
            "ai_accuracy_proxy": accuracy,
            "failed_responses": int(failed),
            "recommendations_logged": int(recs),
            "popular_intents": [
                {"intent": i or "general", "count": int(c)} for i, c in intents.all()
            ],
            "books_sold_via_ai": [
                {
                    "id": b.id,
                    "title": b.title,
                    "ai_sales_count": b.ai_sales_count,
                    "category": b.category,
                }
                for b in top_books.scalars().all()
            ],
            "roles": {
                "customer": "chat + own commerce",
                "staff": "reserved",
                "admin": "X-API-Key only — never in chat context",
            },
        }
    )
