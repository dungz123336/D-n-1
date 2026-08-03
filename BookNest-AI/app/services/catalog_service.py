"""Book and author catalog operations."""

from typing import Any, List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.author import Author
from app.models.book import Book
from app.schemas.catalog import BookOut, BookSearchRequest


class CatalogService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def to_out(self, book: Book) -> BookOut:
        author_name = book.author.name if book.author else None
        data = BookOut.model_validate(book)
        data.author_name = author_name
        return data

    async def get_book(self, book_id: int) -> Optional[Book]:
        result = await self.db.execute(
            select(Book).options(selectinload(Book.author)).where(Book.id == book_id)
        )
        return result.scalar_one_or_none()

    async def get_books_by_ids(self, ids: List[int]) -> List[Book]:
        if not ids:
            return []
        result = await self.db.execute(
            select(Book).options(selectinload(Book.author)).where(Book.id.in_(ids))
        )
        return list(result.scalars().all())

    async def find_by_barcode_or_isbn(
        self, barcode: Optional[str] = None, isbn: Optional[str] = None
    ) -> Optional[Book]:
        clauses = []
        if barcode:
            clauses.append(Book.barcode == barcode)
            clauses.append(Book.isbn == barcode)
        if isbn:
            clauses.append(Book.isbn == isbn)
            clauses.append(Book.barcode == isbn)
        if not clauses:
            return None
        result = await self.db.execute(
            select(Book).options(selectinload(Book.author)).where(or_(*clauses))
        )
        return result.scalar_one_or_none()

    async def search(self, req: BookSearchRequest) -> Tuple[List[Book], int]:
        q = select(Book).options(selectinload(Book.author)).where(Book.is_active.is_(True))
        count_q = select(func.count()).select_from(Book).where(Book.is_active.is_(True))

        if req.query:
            like = f"%{req.query}%"
            filter_expr = or_(Book.title.ilike(like), Book.description.ilike(like), Book.isbn.ilike(like))
            q = q.where(filter_expr)
            count_q = count_q.where(filter_expr)
        if req.category:
            q = q.where(Book.category.ilike(f"%{req.category}%"))
            count_q = count_q.where(Book.category.ilike(f"%{req.category}%"))
        if req.language:
            q = q.where(Book.language == req.language)
            count_q = count_q.where(Book.language == req.language)
        if req.format:
            q = q.where(Book.format == req.format)
            count_q = count_q.where(Book.format == req.format)
        if req.min_price is not None:
            q = q.where(Book.price >= req.min_price)
            count_q = count_q.where(Book.price >= req.min_price)
        if req.max_price is not None:
            q = q.where(Book.price <= req.max_price)
            count_q = count_q.where(Book.price <= req.max_price)
        if req.min_rating is not None:
            q = q.where(Book.rating >= req.min_rating)
            count_q = count_q.where(Book.rating >= req.min_rating)
        if req.author:
            q = q.join(Author).where(Author.name.ilike(f"%{req.author}%"))
            count_q = count_q.join(Author).where(Author.name.ilike(f"%{req.author}%"))

        total = int(await self.db.scalar(count_q) or 0)
        offset = (req.page - 1) * req.page_size
        result = await self.db.execute(
            q.order_by(Book.rating.desc(), Book.sales_count.desc()).offset(offset).limit(req.page_size)
        )
        return list(result.scalars().all()), total

    async def list_authors(self, page: int = 1, page_size: int = 50) -> Tuple[List[Author], int]:
        total = int(await self.db.scalar(select(func.count()).select_from(Author)) or 0)
        result = await self.db.execute(
            select(Author).order_by(Author.name).offset((page - 1) * page_size).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def catalog_snippet(self, limit: int = 12, category: Optional[str] = None) -> str:
        q = select(Book).options(selectinload(Book.author)).where(Book.is_active.is_(True))
        if category:
            q = q.where(Book.category.ilike(f"%{category}%"))
        q = q.order_by(Book.rating.desc()).limit(limit)
        result = await self.db.execute(q)
        books = result.scalars().all()
        lines = []
        for b in books:
            author = b.author.name if b.author else "Unknown"
            lines.append(
                f"- id={b.id} | {b.title} by {author} | ${b.price:.2f} | "
                f"{b.format} | {b.language} | rating={b.rating} | stock={b.stock} | "
                f"difficulty={b.difficulty} | category={b.category}"
            )
        return "\n".join(lines)

    async def books_as_dicts(self, books: List[Book]) -> List[dict[str, Any]]:
        return [self.to_out(b).model_dump() for b in books]
