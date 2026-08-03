"""Commerce operation schemas."""

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class RecommendRequest(BaseModel):
    customer_id: Optional[int] = None
    session_id: Optional[str] = None
    purpose: Optional[str] = None
    budget: Optional[float] = None
    reading_level: Optional[str] = None
    favorite_author: Optional[str] = None
    language: Optional[str] = None
    format: Optional[str] = None  # paperback | ebook | hardcover
    category: Optional[str] = None
    message: Optional[str] = None
    # When criteria incomplete, AI asks clarifying questions instead of recommending
    force: bool = False


class CompareRequest(BaseModel):
    book_ids: List[int] = Field(..., min_length=2, max_length=5)
    customer_id: Optional[int] = None
    language: str = "en"


class AddCartRequest(BaseModel):
    customer_id: int
    book_id: int
    quantity: int = Field(default=1, ge=1, le=99)


class RemoveCartRequest(BaseModel):
    customer_id: int
    book_id: int
    quantity: Optional[int] = None  # None = remove all


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
    items: Optional[List[int]] = None


class ReturnRequest(BaseModel):
    order_number: str
    customer_id: int
    reason: str
    book_ids: Optional[List[int]] = None
