"""Admin panel APIs (API-key protected)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_admin
from app.schemas.common import APIResponse
from app.services.admin_service import AdminService

router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/chat-history")
async def admin_chat_history(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    data = await AdminService(db).chat_history(limit)
    return APIResponse(data=data)


@router.get("/ai-usage")
async def admin_ai_usage(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    data = await AdminService(db).ai_usage(limit)
    return APIResponse(data=data)


@router.get("/ai-sales")
async def admin_ai_sales(db: AsyncSession = Depends(get_db)):
    data = await AdminService(db).ai_sales()
    return APIResponse(data=data)


@router.get("/popular-books")
async def admin_popular_books(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    data = await AdminService(db).popular_books(limit)
    return APIResponse(data=data)


@router.get("/popular-questions")
async def admin_popular_questions(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    data = await AdminService(db).popular_questions(limit)
    return APIResponse(data=data)


@router.get("/satisfaction")
async def admin_satisfaction(db: AsyncSession = Depends(get_db)):
    data = await AdminService(db).customer_satisfaction()
    return APIResponse(data=data)


@router.get("/dashboard")
async def admin_dashboard(db: AsyncSession = Depends(get_db)):
    svc = AdminService(db)
    return APIResponse(
        data={
            "ai_usage": await svc.ai_usage(20),
            "ai_sales": await svc.ai_sales(),
            "popular_books": await svc.popular_books(5),
            "popular_questions": await svc.popular_questions(10),
            "satisfaction": await svc.customer_satisfaction(),
        }
    )
