"""Catalog and customer DTOs."""

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class BookOut(BaseModel):
    id: int
    isbn: Optional[str] = None
    barcode: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    category: Optional[str] = None
    genres: Optional[List[str]] = None
    language: str = "en"
    format: str = "paperback"
    price: float
    original_price: Optional[float] = None
    currency: str = "USD"
    stock: int = 0
    rating: float = 0.0
    review_count: int = 0
    difficulty: Optional[str] = None
    target_reader: Optional[str] = None
    page_count: Optional[int] = None
    published_year: Optional[int] = None
    cover_url: Optional[str] = None
    tags: Optional[List[str]] = None

    model_config = {"from_attributes": True}


class AuthorOut(BaseModel):
    id: int
    name: str
    bio: Optional[str] = None
    nationality: Optional[str] = None
    genres: Optional[str] = None
    image_url: Optional[str] = None

    model_config = {"from_attributes": True}


class CustomerOut(BaseModel):
    id: int
    external_id: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    membership_tier: str = "standard"
    language: str = "en"
    budget_preference: Optional[float] = None
    memory: Optional[dict[str, Any]] = None

    model_config = {"from_attributes": True}


class BookSearchRequest(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    author: Optional[str] = None
    language: Optional[str] = None
    format: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    min_rating: Optional[float] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class BarcodeRequest(BaseModel):
    barcode: Optional[str] = None
    isbn: Optional[str] = None


class VoiceRequest(BaseModel):
    """Voice transcript already converted client-side, or request STT path."""

    transcript: Optional[str] = None
    customer_id: Optional[int] = None
    session_id: Optional[str] = None
    language: str = "en"
    command: bool = True  # treat as voice command when True
