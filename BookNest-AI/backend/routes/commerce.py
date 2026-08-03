"""Recommend, compare, cart, checkout, voucher, track, refund, exchange."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.llm.base import LLMMessage
from backend.llm.factory import get_llm_provider
from backend.prompts.system import CONCIERGE_SYSTEM_PROMPT
from backend.schemas.commerce import (
    AddCartRequest,
    ApplyVoucherRequest,
    CheckoutRequest,
    CompareRequest,
    ExchangeRequest,
    RecommendRequest,
    RefundRequest,
    RemoveCartRequest,
    TrackOrderRequest,
)
from backend.schemas.common import APIResponse
from backend.services.recommend_service import RecommendService
from backend.tools.bookstore_tools import BookstoreTools

router = APIRouter()


@router.post("/recommend")
async def recommend(body: RecommendRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = await RecommendService(db).recommend(body)
        return APIResponse(message=data.get("status", "ok"), data=data)
    except Exception as exc:
        raise HTTPException(502, str(exc)) from exc


@router.post("/compare")
async def compare(body: CompareRequest, db: AsyncSession = Depends(get_db)):
    tools = BookstoreTools(db)
    try:
        structured = await tools.compare_books(body.book_ids)
        prompt = (
            "So sánh các cuốn sách sau bằng tiếng Việt tự nhiên (xưng hô mình/bạn). "
            "Tạo bảng markdown gồm: Độ khó, Giá, Đối tượng, Ưu điểm, Nhược điểm, "
            f"Thứ tự nên đọc, Đánh giá.\nSách:\n{structured['books']}"
        )
        llm = get_llm_provider()
        result = await llm.complete(
            [
                LLMMessage(role="system", content=CONCIERGE_SYSTEM_PROMPT),
                LLMMessage(role="user", content=prompt),
            ]
        )
        return APIResponse(
            data={
                "books": structured["books"],
                "comparison": result.content,
                "provider": result.provider,
                "model": result.model,
            }
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, str(exc)) from exc


@router.post("/add-cart")
async def add_cart(body: AddCartRequest, db: AsyncSession = Depends(get_db)):
    try:
        cart = await BookstoreTools(db).add_to_cart(body.customer_id, body.book_id, body.quantity)
        return APIResponse(message="Added to cart", data=cart)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/remove-cart")
async def remove_cart(body: RemoveCartRequest, db: AsyncSession = Depends(get_db)):
    cart = await BookstoreTools(db).remove_from_cart(body.customer_id, body.book_id, body.quantity)
    return APIResponse(data=cart)


@router.post("/apply-voucher")
async def apply_voucher(body: ApplyVoucherRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = await BookstoreTools(db).apply_voucher(body.customer_id, body.code, body.order_subtotal)
        return APIResponse(message="Voucher applied", data=data)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/checkout")
async def checkout(body: CheckoutRequest, db: AsyncSession = Depends(get_db)):
    try:
        order = await BookstoreTools(db).checkout(
            customer_id=body.customer_id,
            shipping_address=body.shipping_address,
            voucher_code=body.voucher_code,
            notes=body.notes,
            ai_assisted=body.ai_assisted,
        )
        return APIResponse(message="Order placed", data=order)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/track-order")
async def track_order(body: TrackOrderRequest, db: AsyncSession = Depends(get_db)):
    order = await BookstoreTools(db).track_order(
        order_number=body.order_number,
        customer_id=body.customer_id,
        order_id=body.order_id,
    )
    if not order:
        raise HTTPException(404, "Order not found")
    return APIResponse(data=order)


@router.post("/refund")
async def refund(body: RefundRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = await BookstoreTools(db).request_refund(body.order_number, body.customer_id, body.reason)
        return APIResponse(message="Refund processed", data=data)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/exchange")
async def exchange(body: ExchangeRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = await BookstoreTools(db).request_exchange(body.order_number, body.customer_id, body.reason)
        return APIResponse(message="Exchange requested", data=data)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
