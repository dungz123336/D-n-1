from typing import List, Optional

from pydantic import BaseModel, Field


class RecommendRequest(BaseModel):
    customer_id: Optional[int] = None
    purpose: Optional[str] = None
    budget: Optional[float] = None
    reading_level: Optional[str] = None
    favorite_author: Optional[str] = None
    language: Optional[str] = None
    format: Optional[str] = None
    category: Optional[str] = None
    message: Optional[str] = None
    force: bool = False


class CompareRequest(BaseModel):
    book_ids: List[int] = Field(..., min_length=2, max_length=5)
    language: str = "en"
    customer_id: Optional[int] = None


class AddCartRequest(BaseModel):
    customer_id: int
    book_id: int
    quantity: int = Field(default=1, ge=1, le=99)


class RemoveCartRequest(BaseModel):
    customer_id: int
    book_id: int
    quantity: Optional[int] = None


class ApplyVoucherRequest(BaseModel):
    customer_id: int
    code: str
    order_subtotal: Optional[float] = None


class CheckoutRequest(BaseModel):
    customer_id: int
    shipping_address: Optional[str] = None
    voucher_code: Optional[str] = None
    notes: Optional[str] = None
    ai_assisted: bool = True


class TrackOrderRequest(BaseModel):
    order_number: Optional[str] = None
    customer_id: Optional[int] = None
    order_id: Optional[int] = None


class RefundRequest(BaseModel):
    order_number: str
    customer_id: int
    reason: str


class ExchangeRequest(BaseModel):
    order_number: str
    customer_id: int
    reason: str


class BarcodeRequest(BaseModel):
    barcode: Optional[str] = None
    isbn: Optional[str] = None


class BookSearchRequest(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    max_price: Optional[float] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
