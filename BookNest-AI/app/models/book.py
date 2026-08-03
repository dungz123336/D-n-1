"""Book catalog model."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    isbn: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(500), index=True)
    subtitle: Mapped[Optional[str]] = mapped_column(String(500))
    description: Mapped[Optional[str]] = mapped_column(Text)
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey("authors.id"), index=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    genres: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    language: Mapped[str] = mapped_column(String(10), default="en")
    format: Mapped[str] = mapped_column(String(50), default="paperback")  # paperback|ebook|hardcover|audiobook
    price: Mapped[float] = mapped_column(Float, default=0.0)
    original_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    stock: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    difficulty: Mapped[Optional[str]] = mapped_column(String(50))  # beginner|intermediate|advanced
    target_reader: Mapped[Optional[str]] = mapped_column(String(255))
    page_count: Mapped[Optional[int]] = mapped_column(Integer)
    published_year: Mapped[Optional[int]] = mapped_column(Integer)
    cover_url: Mapped[Optional[str]] = mapped_column(String(500))
    tags: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sales_count: Mapped[int] = mapped_column(Integer, default=0)
    ai_sales_count: Mapped[int] = mapped_column(Integer, default=0)
    meta: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    author = relationship("Author", back_populates="books")
