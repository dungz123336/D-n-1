"""Books, authors, customer, search."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.memory.customer_store import CustomerMemoryStore
from backend.schemas.commerce import BookSearchRequest
from backend.schemas.common import APIResponse, PaginatedResponse
from backend.tools.bookstore_tools import BookstoreTools

router = APIRouter()


@router.get("/books")
async def list_books(
    query: Optional[str] = None,
    category: Optional[str] = None,
    language: Optional[str] = None,
    max_price: Optional[float] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    tools = BookstoreTools(db)
    # simple page via larger fetch for demo
    items = await tools.search_books(
        query=query, category=category, language=language, max_price=max_price, limit=page * page_size
    )
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]
    return PaginatedResponse(total=len(items), page=page, page_size=page_size, items=page_items)


@router.post("/book-search")
async def book_search(body: BookSearchRequest, db: AsyncSession = Depends(get_db)):
    tools = BookstoreTools(db)
    items = await tools.search_books(
        query=body.query,
        category=body.category,
        language=body.language,
        max_price=body.max_price,
        limit=body.page * body.page_size,
    )
    start = (body.page - 1) * body.page_size
    return PaginatedResponse(
        total=len(items),
        page=body.page,
        page_size=body.page_size,
        items=items[start : start + body.page_size],
    )


@router.get("/books/{book_id}")
async def get_book(book_id: int, db: AsyncSession = Depends(get_db)):
    book = await BookstoreTools(db).get_book(book_id)
    if not book:
        raise HTTPException(404, "Book not found")
    return APIResponse(data=book)


@router.get("/authors")
async def authors(db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await BookstoreTools(db).list_authors())


@router.get("/customer")
async def customer(customer_id: int = Query(...), db: AsyncSession = Depends(get_db)):
    store = CustomerMemoryStore(db)
    c = await store.get_customer(customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    memory = await store.as_dict(customer_id)
    return APIResponse(
        data={
            "id": c.id,
            "email": c.email,
            "name": c.name,
            "membership_tier": c.membership_tier,
            "language": c.language,
            "budget_preference": c.budget_preference,
            "memory": memory,
        }
    )
