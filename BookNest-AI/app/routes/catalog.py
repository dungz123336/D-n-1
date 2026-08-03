"""Books, authors, customer, search."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.memory.customer_memory import CustomerMemoryService
from app.schemas.catalog import BookSearchRequest, CustomerOut
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.catalog_service import CatalogService

router = APIRouter()


@router.get("/books")
async def list_books(
    query: Optional[str] = None,
    category: Optional[str] = None,
    author: Optional[str] = None,
    language: Optional[str] = None,
    format: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    service = CatalogService(db)
    req = BookSearchRequest(
        query=query,
        category=category,
        author=author,
        language=language,
        format=format,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        page=page,
        page_size=page_size,
    )
    books, total = await service.search(req)
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[service.to_out(b).model_dump() for b in books],
    )


@router.post("/book-search")
async def book_search(body: BookSearchRequest, db: AsyncSession = Depends(get_db)):
    service = CatalogService(db)
    books, total = await service.search(body)
    return PaginatedResponse(
        total=total,
        page=body.page,
        page_size=body.page_size,
        items=[service.to_out(b).model_dump() for b in books],
    )


@router.get("/books/{book_id}")
async def get_book(book_id: int, db: AsyncSession = Depends(get_db)):
    service = CatalogService(db)
    book = await service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return APIResponse(data=service.to_out(book).model_dump())


@router.get("/authors")
async def list_authors(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    service = CatalogService(db)
    authors, total = await service.list_authors(page, page_size)
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[
            {
                "id": a.id,
                "name": a.name,
                "bio": a.bio,
                "nationality": a.nationality,
                "genres": a.genres,
                "image_url": a.image_url,
            }
            for a in authors
        ],
    )


@router.get("/customer")
async def get_customer(
    customer_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    mem_svc = CustomerMemoryService(db)
    customer = await mem_svc.get_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    memory = await mem_svc.as_dict(customer_id)
    out = CustomerOut(
        id=customer.id,
        external_id=customer.external_id,
        email=customer.email,
        name=customer.name,
        membership_tier=customer.membership_tier,
        language=customer.language,
        budget_preference=customer.budget_preference,
        memory=memory,
    )
    return APIResponse(data=out.model_dump())
