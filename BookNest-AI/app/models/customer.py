"""Customer and long-term preference memory models."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    membership_tier: Mapped[str] = mapped_column(String(50), default="standard")
    language: Mapped[str] = mapped_column(String(10), default="en")
    budget_preference: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    satisfaction_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    meta: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    memory: Mapped[Optional["CustomerMemory"]] = relationship(
        "CustomerMemory", back_populates="customer", uselist=False, cascade="all, delete-orphan"
    )
    chat_sessions = relationship("ChatSession", back_populates="customer", cascade="all, delete-orphan")
    cart_items = relationship("CartItem", back_populates="customer", cascade="all, delete-orphan")
    wishlist_items = relationship("WishlistItem", back_populates="customer", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="customer", cascade="all, delete-orphan")


class CustomerMemory(Base):
    """Persistent preferences the AI uses for personalization."""

    __tablename__ = "customer_memory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True, unique=True)
    favorite_genres: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    favorite_authors: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    reading_goals: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    budget: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    preferred_format: Mapped[Optional[str]] = mapped_column(String(50))  # paperback | ebook | hardcover
    reading_level: Mapped[Optional[str]] = mapped_column(String(50))
    language: Mapped[Optional[str]] = mapped_column(String(10))
    viewed_books: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    search_history: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    customer: Mapped["Customer"] = relationship("Customer", back_populates="memory")
