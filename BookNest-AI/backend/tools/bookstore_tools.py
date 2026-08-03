"""
Domain tools the concierge uses for recommendations, cart, orders, vouchers.

These are pure service functions — callable from chat orchestration or REST.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.entities import Author, Book, CartItem, Coupon, Order, OrderItem


class BookstoreTools:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ----- Catalog -----
    async def search_books(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        max_price: Optional[float] = None,
        language: Optional[str] = None,
        limit: int = 10,
    ) -> List[dict[str, Any]]:
        q = select(Book).options(selectinload(Book.author)).where(Book.is_active.is_(True))
        if query:
            like = f"%{query}%"
            q = q.where(or_(Book.title.ilike(like), Book.description.ilike(like), Book.isbn.ilike(like)))
        if category:
            q = q.where(Book.category.ilike(f"%{category}%"))
        if max_price is not None:
            q = q.where(Book.price <= max_price)
        if language:
            q = q.where(Book.language == language)
        q = q.order_by(Book.rating.desc()).limit(limit)
        result = await self.db.execute(q)
        return [self._book_dict(b) for b in result.scalars().all()]

    async def get_book(self, book_id: int) -> Optional[dict[str, Any]]:
        result = await self.db.execute(
            select(Book).options(selectinload(Book.author)).where(Book.id == book_id)
        )
        book = result.scalar_one_or_none()
        return self._book_dict(book) if book else None

    async def get_books(self, ids: List[int]) -> List[dict[str, Any]]:
        if not ids:
            return []
        result = await self.db.execute(
            select(Book).options(selectinload(Book.author)).where(Book.id.in_(ids))
        )
        return [self._book_dict(b) for b in result.scalars().all()]

    async def find_barcode(self, code: str) -> Optional[dict[str, Any]]:
        result = await self.db.execute(
            select(Book)
            .options(selectinload(Book.author))
            .where(or_(Book.barcode == code, Book.isbn == code))
        )
        book = result.scalar_one_or_none()
        return self._book_dict(book) if book else None

    async def catalog_snippet(self, limit: int = 12, category: Optional[str] = None) -> str:
        books = await self.search_books(category=category, limit=limit)
        lines = []
        for b in books:
            lines.append(
                f"- id={b['id']} | {b['title']} by {b.get('author_name')} | "
                f"${b['price']:.2f} | {b['format']} | {b['language']} | "
                f"rating={b['rating']} | stock={b['stock']} | difficulty={b.get('difficulty')}"
            )
        return "\n".join(lines)

    async def compare_books(self, book_ids: List[int]) -> dict[str, Any]:
        books = await self.get_books(book_ids)
        if len(books) < 2:
            raise ValueError("Cần ít nhất 2 cuốn sách để so sánh")
        return {
            "books": books,
            "fields": ["difficulty", "price", "target_reader", "rating", "format", "language"],
        }

    # ----- Cart / checkout -----
    async def cart_summary(self, customer_id: int) -> dict[str, Any]:
        result = await self.db.execute(
            select(CartItem).options(selectinload(CartItem.book)).where(CartItem.customer_id == customer_id)
        )
        items = list(result.scalars().all())
        lines = []
        subtotal = 0.0
        for item in items:
            lt = item.unit_price * item.quantity
            subtotal += lt
            lines.append(
                {
                    "book_id": item.book_id,
                    "title": item.book.title if item.book else None,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "line_total": round(lt, 2),
                }
            )
        return {"items": lines, "subtotal": round(subtotal, 2), "item_count": sum(i.quantity for i in items)}

    async def add_to_cart(self, customer_id: int, book_id: int, quantity: int = 1) -> dict[str, Any]:
        book = await self.db.get(Book, book_id)
        if not book or not book.is_active:
            raise ValueError("Không tìm thấy sách này")
        if book.stock < quantity:
            raise ValueError(f"Sách không đủ hàng (còn {book.stock} cuốn)")
        result = await self.db.execute(
            select(CartItem).where(CartItem.customer_id == customer_id, CartItem.book_id == book_id)
        )
        item = result.scalar_one_or_none()
        if item:
            item.quantity += quantity
            item.unit_price = book.price
        else:
            item = CartItem(customer_id=customer_id, book_id=book_id, quantity=quantity, unit_price=book.price)
            self.db.add(item)
        await self.db.flush()
        return await self.cart_summary(customer_id)

    async def remove_from_cart(self, customer_id: int, book_id: int, quantity: Optional[int] = None) -> dict[str, Any]:
        result = await self.db.execute(
            select(CartItem).where(CartItem.customer_id == customer_id, CartItem.book_id == book_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            return {"message": "Item not in cart", **await self.cart_summary(customer_id)}
        if quantity is None or quantity >= item.quantity:
            await self.db.delete(item)
        else:
            item.quantity -= quantity
        await self.db.flush()
        return await self.cart_summary(customer_id)

    async def apply_voucher(self, customer_id: int, code: str, subtotal: Optional[float] = None) -> dict[str, Any]:
        if subtotal is None:
            subtotal = (await self.cart_summary(customer_id))["subtotal"]
        coupon, discount = await self._validate_voucher(code, subtotal)
        return {
            "code": coupon.code,
            "description": coupon.description,
            "discount_amount": discount,
            "subtotal": subtotal,
            "total_after_discount": round(subtotal - discount, 2),
        }

    async def checkout(
        self,
        customer_id: int,
        shipping_address: Optional[str] = None,
        voucher_code: Optional[str] = None,
        notes: Optional[str] = None,
        ai_assisted: bool = True,
    ) -> dict[str, Any]:
        result = await self.db.execute(
            select(CartItem).options(selectinload(CartItem.book)).where(CartItem.customer_id == customer_id)
        )
        items = list(result.scalars().all())
        if not items:
            raise ValueError("Giỏ hàng đang trống")
        subtotal = sum(i.unit_price * i.quantity for i in items)
        discount = 0.0
        applied = None
        if voucher_code:
            coupon, discount = await self._validate_voucher(voucher_code, subtotal)
            coupon.used_count += 1
            applied = coupon.code
        shipping = 0.0 if subtotal - discount >= 40 else 4.99
        total = round(subtotal - discount + shipping, 2)
        order = Order(
            order_number=f"BN-{uuid.uuid4().hex[:10].upper()}",
            customer_id=customer_id,
            status="confirmed",
            subtotal=round(subtotal, 2),
            discount=discount,
            shipping=shipping,
            total=total,
            voucher_code=applied,
            shipping_address=shipping_address,
            tracking_number=f"TRK{uuid.uuid4().hex[:12].upper()}",
            tracking_status="Đã xác nhận — đang chuẩn bị giao hàng",
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
            if item.book:
                item.book.stock = max(0, item.book.stock - item.quantity)
                item.book.sales_count += item.quantity
                if ai_assisted:
                    item.book.ai_sales_count += item.quantity
            await self.db.delete(item)
        await self.db.flush()
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "total": order.total,
            "tracking_number": order.tracking_number,
            "tracking_status": order.tracking_status,
        }

    async def track_order(
        self,
        order_number: Optional[str] = None,
        customer_id: Optional[int] = None,
        order_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
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
        order = result.scalar_one_or_none()
        if not order:
            return None
        return {
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
        }

    async def request_refund(self, order_number: str, customer_id: int, reason: str) -> dict[str, Any]:
        order = await self._get_order(order_number)
        if not order or order.customer_id != customer_id:
            raise ValueError("Không tìm thấy đơn hàng")
        order.status = "refunded"
        order.tracking_status = "Đã duyệt hoàn tiền — đang xử lý"
        order.notes = (order.notes or "") + f"\nHoàn tiền: {reason}"
        await self.db.flush()
        return {"order_number": order.order_number, "status": order.status, "message": "Yêu cầu hoàn tiền đã được ghi nhận."}

    async def request_exchange(self, order_number: str, customer_id: int, reason: str) -> dict[str, Any]:
        order = await self._get_order(order_number)
        if not order or order.customer_id != customer_id:
            raise ValueError("Không tìm thấy đơn hàng")
        order.status = "return_requested"
        order.tracking_status = "Đã tiếp nhận yêu cầu đổi/trả"
        order.notes = (order.notes or "") + f"\nĐổi trả: {reason}"
        await self.db.flush()
        return {"order_number": order.order_number, "status": order.status, "message": "Yêu cầu đổi/trả đã được ghi nhận."}

    async def list_authors(self, limit: int = 50) -> List[dict[str, Any]]:
        result = await self.db.execute(select(Author).order_by(Author.name).limit(limit))
        return [
            {"id": a.id, "name": a.name, "bio": a.bio, "nationality": a.nationality, "genres": a.genres}
            for a in result.scalars().all()
        ]

    async def faq_answer(self, topic: str) -> str:
        faqs = {
            "shipping": "Đơn từ 400.000đ được miễn phí vận chuyển. Giao tiêu chuẩn khoảng 2–5 ngày làm việc.",
            "vận chuyển": "Đơn từ 400.000đ được miễn phí vận chuyển. Giao tiêu chuẩn khoảng 2–5 ngày làm việc.",
            "returns": "Đổi/trả trong 14 ngày nếu sách còn nguyên. Bạn có thể nhờ mình hỗ trợ tạo yêu cầu đổi trả.",
            "đổi": "Đổi/trả trong 14 ngày nếu sách còn nguyên. Bạn có thể nhờ mình hỗ trợ tạo yêu cầu đổi trả.",
            "payment": "Hỗ trợ thanh toán ngay, COD, MoMo, VNPay, ZaloPay, Visa/Mastercard. Đừng chia sẻ số thẻ trong chat nhé.",
            "thanh toán": "Hỗ trợ thanh toán ngay, COD, MoMo, VNPay, ZaloPay, Visa/Mastercard. Đừng chia sẻ số thẻ trong chat nhé.",
            "cod": "COD: bạn nhận sách rồi thanh toán cho đơn vị vận chuyển.",
            "membership": "Thành viên Gold được vào Flash Sale sớm và có voucher riêng như READMORE20.",
            "voucher": "Mã demo: WELCOME10 (giảm 10%), BOOKNEST15 (giảm cố định), READMORE20 (thành viên).",
            "mã giảm": "Mã demo: WELCOME10 (giảm 10%), BOOKNEST15 (giảm cố định), READMORE20 (thành viên).",
        }
        t = topic.lower()
        for k, v in faqs.items():
            if k in t:
                return v
        return (
            "Mình có thể hỗ trợ về vận chuyển, đổi/trả, thanh toán, thành viên và mã giảm giá. "
            "Bạn muốn hỏi phần nào ạ?"
        )

    # ----- helpers -----
    async def _get_order(self, order_number: str) -> Optional[Order]:
        result = await self.db.execute(select(Order).where(Order.order_number == order_number))
        return result.scalar_one_or_none()

    async def _validate_voucher(self, code: str, subtotal: float) -> tuple[Coupon, float]:
        result = await self.db.execute(select(Coupon).where(Coupon.code == code.upper()))
        coupon = result.scalar_one_or_none()
        if not coupon or not coupon.is_active:
            raise ValueError("Mã giảm giá không hợp lệ hoặc đã hết hiệu lực")
        if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
            raise ValueError("Mã giảm giá đã hết lượt sử dụng")
        if subtotal < coupon.min_order:
            raise ValueError(f"Đơn tối thiểu {coupon.min_order:,.0f} để dùng mã này")
        if coupon.discount_type == "percent":
            discount = subtotal * (coupon.discount_value / 100.0)
            if coupon.max_discount is not None:
                discount = min(discount, coupon.max_discount)
        else:
            discount = coupon.discount_value
        return coupon, round(min(discount, subtotal), 2)

    def _book_dict(self, book: Book) -> dict[str, Any]:
        return {
            "id": book.id,
            "isbn": book.isbn,
            "barcode": book.barcode,
            "title": book.title,
            "description": book.description,
            "author_id": book.author_id,
            "author_name": book.author.name if book.author else None,
            "category": book.category,
            "genres": book.genres or [],
            "language": book.language,
            "format": book.format,
            "price": book.price,
            "original_price": book.original_price,
            "currency": book.currency,
            "stock": book.stock,
            "rating": book.rating,
            "review_count": book.review_count,
            "difficulty": book.difficulty,
            "target_reader": book.target_reader,
            "page_count": book.page_count,
            "published_year": book.published_year,
            "cover_url": book.cover_url,
            "tags": book.tags or [],
        }
