from typing import Any, List, Optional

from pydantic import BaseModel, Field


class WebsiteBookSnapshot(BaseModel):
    """Live book row from BookNest-Store (source of truth for price/stock)."""

    id: int
    title: str
    slug: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None  # original
    sale_price: Optional[float] = None
    stock: int = 0
    rating: Optional[float] = None
    review_count: Optional[int] = None
    isbn: Optional[str] = None
    language: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None


class ChatContext(BaseModel):
    """Client-supplied browsing context for personalization."""

    customer_id: Optional[int] = None
    current_page: Optional[str] = None
    current_book_id: Optional[int] = None
    current_category: Optional[str] = None
    # Full current book from website (preferred over AI-local DB)
    current_book: Optional[dict[str, Any]] = None
    # Live inventory snapshot from website catalog — absolute source of truth
    website_inventory: Optional[List[dict[str, Any]]] = None
    inventory_source: Optional[str] = "website"
    cart: Optional[List[dict[str, Any]]] = None
    wishlist: Optional[List[int]] = None
    wishlist_books: Optional[List[dict[str, Any]]] = None
    orders: Optional[List[dict[str, Any]]] = None
    viewed_books: Optional[List[int]] = None
    viewed_book_details: Optional[List[dict[str, Any]]] = None
    search_history: Optional[List[str]] = None
    coupons: Optional[List[str]] = None
    membership: Optional[str] = None
    language: str = "vi"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    session_id: Optional[str] = None
    customer_id: Optional[int] = None
    context: Optional[ChatContext] = None
    stream: bool = False
    language: Optional[str] = None
    response_format: str = "markdown"  # markdown | json


class ChatResponse(BaseModel):
    session_id: str
    message: str
    role: str = "assistant"
    intent: Optional[str] = None
    books: Optional[List[dict[str, Any]]] = None
    actions: Optional[List[dict[str, Any]]] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    latency_ms: Optional[float] = None
    usage: Optional[dict[str, int]] = None
