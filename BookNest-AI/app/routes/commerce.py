"""Recommend, compare, cart, checkout, voucher, track order."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.commerce import (
    AddCartRequest,
    ApplyVoucherRequest,
    CheckoutRequest,
    CompareRequest,
    RecommendRequest,
    RefundRequest,
    RemoveCartRequest,
    ReturnRequest,
    TrackOrderRequest,
)
from app.schemas.common import APIResponse
from app.services.commerce_service import CommerceService
from app.services.compare_service import CompareService
from app.services.recommend_service import RecommendService

router = APIRouter()


@router.post("/recommend")
async def recommend(body: RecommendRequest, db: AsyncSession = Depends(get_db)):
    service = RecommendService(db)
    try:
        data = await service.recommend(body)
        return APIResponse(message=data.get("status", "ok"), data=data)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/compare")
async def compare(body: CompareRequest, db: AsyncSession = Depends(get_db)):
    service = CompareService(db)
    try:
        data = await service.compare(body.book_ids, body.language)
        return APIResponse(data=data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/add-cart")
async def add_cart(body: AddCartRequest, db: AsyncSession = Depends(get_db)):
    service = CommerceService(db)
    try:
        item = await service.add_to_cart(body.customer_id, body.book_id, body.quantity)
        cart = await service.cart_summary(body.customer_id)
        return APIResponse(
            message="Added to cart",
            data={"cart_item_id": item.id, "book_id": item.book_id, "quantity": item.quantity, "cart": cart},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/remove-cart")
async def remove_cart(body: RemoveCartRequest, db: AsyncSession = Depends(get_db)):
    service = CommerceService(db)
    result = await service.remove_from_cart(body.customer_id, body.book_id, body.quantity)
    cart = await service.cart_summary(body.customer_id)
    return APIResponse(message=result.get("message", "ok"), data={"result": result, "cart": cart})


@router.post("/apply-voucher")
async def apply_voucher(body: ApplyVoucherRequest, db: AsyncSession = Depends(get_db)):
    service = CommerceService(db)
    try:
        data = await service.apply_voucher(body.customer_id, body.code, body.order_subtotal)
        return APIResponse(message="Voucher applied", data=data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/checkout")
async def checkout(body: CheckoutRequest, db: AsyncSession = Depends(get_db)):
    service = CommerceService(db)
    try:
        order = await service.checkout(
            customer_id=body.customer_id,
            shipping_address=body.shipping_address,
            voucher_code=body.voucher_code,
            notes=body.notes,
            ai_assisted=body.ai_assisted,
        )
        return APIResponse(
            message="Order placed",
            data={
                "order_id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "subtotal": order.subtotal,
                "discount": order.discount,
                "shipping": order.shipping,
                "total": order.total,
                "tracking_number": order.tracking_number,
                "tracking_status": order.tracking_status,
                "voucher_code": order.voucher_code,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/track-order")
async def track_order(body: TrackOrderRequest, db: AsyncSession = Depends(get_db)):
    service = CommerceService(db)
    order = await service.track_order(
        order_number=body.order_number,
        customer_id=body.customer_id,
        order_id=body.order_id,
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return APIResponse(
        data={
            "order_id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "tracking_number": order.tracking_number,
            "tracking_status": order.tracking_status,
            "total": order.total,
            "items": [
                {
                    "book_id": i.book_id,
                    "title": i.title_snapshot,
                    "quantity": i.quantity,
                    "unit_price": i.unit_price,
                }
                for i in (order.items or [])
            ],
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }
    )


@router.post("/refund")
async def refund(body: RefundRequest, db: AsyncSession = Depends(get_db)):
    service = CommerceService(db)
    try:
        order = await service.request_refund(body.order_number, body.customer_id, body.reason)
        return APIResponse(
            message="Refund processed",
            data={"order_number": order.order_number, "status": order.status},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/return")
async def return_order(body: ReturnRequest, db: AsyncSession = Depends(get_db)):
    service = CommerceService(db)
    try:
        order = await service.request_return(body.order_number, body.customer_id, body.reason)
        return APIResponse(
            message="Return requested",
            data={"order_number": order.order_number, "status": order.status},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
