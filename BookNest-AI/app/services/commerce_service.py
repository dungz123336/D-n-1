"""Cart, checkout, vouchers, and order tracking."""

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.book import Book
from app.models.cart import CartItem
from app.models.coupon import Coupon
from app.models.order import Order, OrderItem


class CommerceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_cart(self, customer_id: int) -> List[CartItem]:
        result = await self.db.execute(
            select(CartItem)
            .options(selectinload(CartItem.book))
            .where(CartItem.customer_id == customer_id)
        )
        return list(result.scalars().all())

    async def cart_summary(self, customer_id: int) -> dict[str, Any]:
        items = await self.get_cart(customer_id)
        lines = []
        subtotal = 0.0
        for item in items:
            line_total = item.unit_price * item.quantity
            subtotal += line_total
            lines.append(
                {
                    "book_id": item.book_id,
                    "title": item.book.title if item.book else None,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "line_total": round(line_total, 2),
                }
            )
        return {"items": lines, "subtotal": round(subtotal, 2), "item_count": sum(i.quantity for i in items)}

    async def add_to_cart(self, customer_id: int, book_id: int, quantity: int = 1) -> CartItem:
        book = await self.db.get(Book, book_id)
        if not book or not book.is_active:
            raise ValueError("Book not found or inactive")
        if book.stock < quantity:
            raise ValueError(f"Insufficient stock (available: {book.stock})")

        result = await self.db.execute(
            select(CartItem).where(
                CartItem.customer_id == customer_id, CartItem.book_id == book_id
            )
        )
        item = result.scalar_one_or_none()
        if item:
            item.quantity += quantity
            item.unit_price = book.price
        else:
            item = CartItem(
                customer_id=customer_id,
                book_id=book_id,
                quantity=quantity,
                unit_price=book.price,
            )
            self.db.add(item)
        await self.db.flush()
        return item

    async def remove_from_cart(
        self, customer_id: int, book_id: int, quantity: Optional[int] = None
    ) -> dict[str, Any]:
        result = await self.db.execute(
            select(CartItem).where(
                CartItem.customer_id == customer_id, CartItem.book_id == book_id
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            return {"removed": False, "message": "Item not in cart"}
        if quantity is None or quantity >= item.quantity:
            await self.db.delete(item)
            await self.db.flush()
            return {"removed": True, "message": "Item removed"}
        item.quantity -= quantity
        await self.db.flush()
        return {"removed": False, "message": "Quantity decreased", "quantity": item.quantity}

    async def validate_voucher(
        self, code: str, subtotal: float
    ) -> tuple[Coupon, float]:
        result = await self.db.execute(select(Coupon).where(Coupon.code == code.upper()))
        coupon = result.scalar_one_or_none()
        if not coupon or not coupon.is_active:
            raise ValueError("Invalid or inactive voucher")
        now = datetime.now(timezone.utc)
        if coupon.valid_from and coupon.valid_from.replace(tzinfo=timezone.utc) > now:
            raise ValueError("Voucher not yet valid")
        if coupon.valid_until and coupon.valid_until.replace(tzinfo=timezone.utc) < now:
            raise ValueError("Voucher expired")
        if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
            raise ValueError("Voucher usage limit reached")
        if subtotal < coupon.min_order:
            raise ValueError(f"Minimum order ${coupon.min_order:.2f} required")

        if coupon.discount_type == "percent":
            discount = subtotal * (coupon.discount_value / 100.0)
            if coupon.max_discount is not None:
                discount = min(discount, coupon.max_discount)
        else:
            discount = coupon.discount_value
        discount = min(discount, subtotal)
        return coupon, round(discount, 2)

    async def apply_voucher(
        self, customer_id: int, code: str, order_subtotal: Optional[float] = None
    ) -> dict[str, Any]:
        if order_subtotal is None:
            summary = await self.cart_summary(customer_id)
            order_subtotal = summary["subtotal"]
        coupon, discount = await self.validate_voucher(code, order_subtotal)
        return {
            "code": coupon.code,
            "description": coupon.description,
            "discount_type": coupon.discount_type,
            "discount_value": coupon.discount_value,
            "discount_amount": discount,
            "subtotal": order_subtotal,
            "total_after_discount": round(order_subtotal - discount, 2),
        }

    async def checkout(
        self,
        customer_id: int,
        shipping_address: Optional[str] = None,
        voucher_code: Optional[str] = None,
        notes: Optional[str] = None,
        ai_assisted: bool = True,
    ) -> Order:
        items = await self.get_cart(customer_id)
        if not items:
            raise ValueError("Cart is empty")

        subtotal = sum(i.unit_price * i.quantity for i in items)
        discount = 0.0
        applied_code = None
        if voucher_code:
            coupon, discount = await self.validate_voucher(voucher_code, subtotal)
            coupon.used_count += 1
            applied_code = coupon.code

        shipping = 0.0 if subtotal - discount >= 40 else 4.99
        total = round(subtotal - discount + shipping, 2)
        order_number = f"BN-{uuid.uuid4().hex[:10].upper()}"

        order = Order(
            order_number=order_number,
            customer_id=customer_id,
            status="confirmed",
            subtotal=round(subtotal, 2),
            discount=discount,
            shipping=shipping,
            total=total,
            voucher_code=applied_code,
            shipping_address=shipping_address,
            tracking_number=f"TRK{uuid.uuid4().hex[:12].upper()}",
            tracking_status="Order confirmed — preparing shipment",
            notes=notes,
            ai_assisted=ai_assisted,
        )
        self.db.add(order)
        await self.db.flush()

        for item in items:
            self.db.add(
                OrderItem(
                    order_id=order.id,
                    book_id=item.book_id,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    title_snapshot=item.book.title if item.book else None,
                )
            )
            book = item.book
            if book:
                book.stock = max(0, book.stock - item.quantity)
                book.sales_count += item.quantity
                if ai_assisted:
                    book.ai_sales_count += item.quantity
            await self.db.delete(item)

        await self.db.flush()
        return order

    async def track_order(
        self,
        order_number: Optional[str] = None,
        customer_id: Optional[int] = None,
        order_id: Optional[int] = None,
    ) -> Optional[Order]:
        q = select(Order).options(selectinload(Order.items))
        if order_id:
            q = q.where(Order.id == order_id)
        elif order_number:
            q = q.where(Order.order_number == order_number)
        elif customer_id:
            q = q.where(Order.customer_id == customer_id).order_by(Order.id.desc()).limit(1)
        else:
            return None
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def request_refund(self, order_number: str, customer_id: int, reason: str) -> Order:
        order = await self.track_order(order_number=order_number)
        if not order or order.customer_id != customer_id:
            raise ValueError("Order not found")
        if order.status in ("refunded", "cancelled"):
            raise ValueError(f"Order already {order.status}")
        order.status = "refunded"
        order.notes = (order.notes or "") + f"\nRefund requested: {reason}"
        order.tracking_status = "Refund approved — processing"
        await self.db.flush()
        return order

    async def request_return(
        self, order_number: str, customer_id: int, reason: str
    ) -> Order:
        order = await self.track_order(order_number=order_number)
        if not order or order.customer_id != customer_id:
            raise ValueError("Order not found")
        order.status = "return_requested"
        order.notes = (order.notes or "") + f"\nReturn requested: {reason}"
        order.tracking_status = "Return requested — await instructions"
        await self.db.flush()
        return order
