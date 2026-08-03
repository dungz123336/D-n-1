"""SQLAlchemy domain models for BookNest Concierge."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.session import Base


class Author(Base):
    __tablename__ = "authors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(100))
    genres: Mapped[Optional[str]] = mapped_column(String(255))

    books = relationship("Book", back_populates="author")


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    isbn: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(500), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey("authors.id"), index=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    genres: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    language: Mapped[str] = mapped_column(String(10), default="en")
    format: Mapped[str] = mapped_column(String(50), default="paperback")
    price: Mapped[float] = mapped_column(Float, default=0.0)
    original_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    stock: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    difficulty: Mapped[Optional[str]] = mapped_column(String(50))
    target_reader: Mapped[Optional[str]] = mapped_column(String(255))
    page_count: Mapped[Optional[int]] = mapped_column(Integer)
    published_year: Mapped[Optional[int]] = mapped_column(Integer)
    cover_url: Mapped[Optional[str]] = mapped_column(String(500))
    tags: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sales_count: Mapped[int] = mapped_column(Integer, default=0)
    ai_sales_count: Mapped[int] = mapped_column(Integer, default=0)

    author = relationship("Author", back_populates="books")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    membership_tier: Mapped[str] = mapped_column(String(50), default="standard")
    language: Mapped[str] = mapped_column(String(10), default="en")
    budget_preference: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    meta: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memory: Mapped[Optional["CustomerMemory"]] = relationship(
        "CustomerMemory", back_populates="customer", uselist=False, cascade="all, delete-orphan"
    )
    cart_items = relationship("CartItem", back_populates="customer", cascade="all, delete-orphan")
    wishlist_items = relationship("WishlistItem", back_populates="customer", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="customer", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="customer", cascade="all, delete-orphan")


class CustomerMemory(Base):
    """Long-term personalization memory for the concierge."""

    __tablename__ = "customer_memory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), unique=True, index=True)
    favorite_genres: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    favorite_authors: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    reading_goals: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    budget: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    preferred_format: Mapped[Optional[str]] = mapped_column(String(50))
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


class CartItem(Base):
    __tablename__ = "cart_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)

    customer = relationship("Customer", back_populates="cart_items")
    book = relationship("Book")


class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), index=True)

    customer = relationship("Customer", back_populates="wishlist_items")
    book = relationship("Book")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    discount: Mapped[float] = mapped_column(Float, default=0.0)
    shipping: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    voucher_code: Mapped[Optional[str]] = mapped_column(String(50))
    shipping_address: Mapped[Optional[str]] = mapped_column(Text)
    tracking_number: Mapped[Optional[str]] = mapped_column(String(100))
    tracking_status: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    ai_assisted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    title_snapshot: Mapped[Optional[str]] = mapped_column(String(500))

    order = relationship("Order", back_populates="items")
    book = relationship("Book")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"), index=True)
    language: Mapped[str] = mapped_column(String(10), default="en")
    current_page: Mapped[Optional[str]] = mapped_column(String(255))
    context: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="chat_sessions")
    messages = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.id"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    intent: Mapped[Optional[str]] = mapped_column(String(100))
    provider: Mapped[Optional[str]] = mapped_column(String(50))
    model: Mapped[Optional[str]] = mapped_column(String(100))
    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    latency_ms: Mapped[Optional[float]] = mapped_column(Float)
    meta: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    discount_type: Mapped[str] = mapped_column(String(20), default="percent")
    discount_value: Mapped[float] = mapped_column(Float, default=0.0)
    min_order: Mapped[float] = mapped_column(Float, default=0.0)
    max_discount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    usage_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"), index=True)
    book_ids: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    criteria: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    session_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    endpoint: Mapped[Optional[str]] = mapped_column(String(100))
    provider: Mapped[str] = mapped_column(String(50), index=True)
    model: Mapped[str] = mapped_column(String(100))
    prompt: Mapped[Optional[str]] = mapped_column(Text)
    response: Mapped[Optional[str]] = mapped_column(Text)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
