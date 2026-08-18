"""
BookNest Store data service — single source of truth for Store + AI Concierge.

All book/price/stock/cart/order/voucher data is loaded from the database
(or future BookNest remote API), never hardcoded in chatbot replies.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.entities import (
    Author,
    Book,
    CartItem,
    Coupon,
    Customer,
    Order,
    OrderItem,
    WishlistItem,
)
from backend.models.store_entities import (
    BookExtra,
    Category,
    InventoryLog,
    Payment,
    Publisher,
    Review,
    StudentProfile,
)


class StoreService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------ books
    async def _serialize_book(self, book: Book, extra: Optional[BookExtra] = None) -> dict[str, Any]:
        if extra is None:
            result = await self.db.execute(select(BookExtra).where(BookExtra.book_id == book.id))
            extra = result.scalar_one_or_none()
        # Never touch lazy relationships in async — load author explicitly
        author_name = None
        if book.author_id:
            author = await self.db.get(Author, book.author_id)
            author_name = author.name if author else None
        price_usd = book.price
        # VND truth lives in BookExtra. Fall back only when extra is missing;
        # if book.price already looks like VND (>1000) don't multiply again.
        if extra and extra.price_vnd is not None:
            price_vnd: float = float(extra.price_vnd)
        else:
            price_vnd = float(price_usd) if float(price_usd) > 1000 else float(price_usd) * 24000
        if extra and extra.sale_price_vnd is not None:
            sale_vnd: float | None = float(extra.sale_price_vnd)
        elif book.original_price:
            op = float(book.original_price)
            sale_vnd = op if op > 1000 else op * 24000
        else:
            sale_vnd = None
        # Prefer VND as store currency
        display_price = extra.sale_price_vnd if extra and extra.sale_price_vnd else price_vnd
        original = extra.price_vnd if extra and extra.price_vnd else (sale_vnd or price_vnd)
        if extra and extra.sale_price_vnd and extra.price_vnd:
            original = extra.price_vnd
            display_price = extra.sale_price_vnd
        discount = 0
        if original and display_price and original > display_price:
            discount = int(round((1 - display_price / original) * 100))
        return {
            "id": book.id,
            "isbn": book.isbn,
            "barcode": book.barcode,
            "title": book.title,
            "slug": extra.slug if extra else None,
            "description": book.description,
            "author_id": book.author_id,
            "author_name": author_name,
            "category": book.category,
            "category_id": extra.category_id if extra else None,
            "publisher_id": extra.publisher_id if extra else None,
            "genres": book.genres or [],
            "language": book.language,
            "format": book.format,
            "price": float(display_price),
            "original_price": float(original) if original else None,
            "currency": "VND",
            "price_usd": price_usd,
            "discount_percent": discount,
            "stock": book.stock,
            "available_stock": max(0, book.stock - (extra.reserved_stock if extra else 0)),
            "rating": book.rating,
            "review_count": book.review_count,
            "difficulty": book.difficulty,
            "target_reader": book.target_reader,
            "page_count": book.page_count,
            "published_year": book.published_year,
            "cover_url": book.cover_url,
            "tags": book.tags or [],
            "is_bestseller": bool(extra.is_bestseller) if extra else book.sales_count > 50,
            "is_trending": bool(extra.is_trending) if extra else book.rating >= 4.5,
            "is_new": bool(extra.is_new) if extra else False,
            "is_featured": bool(extra.is_featured) if extra else False,
            "flash_sale": bool(extra.flash_sale) if extra else False,
            "sales_count": book.sales_count,
            "warehouse_location": extra.warehouse_location if extra else None,
        }

    async def list_books(
        self,
        *,
        query: Optional[str] = None,
        category: Optional[str] = None,
        category_id: Optional[int] = None,
        author: Optional[str] = None,
        language: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        bestseller: bool = False,
        trending: bool = False,
        new_arrival: bool = False,
        featured: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        q = select(Book).where(Book.is_active.is_(True))
        if query:
            like = f"%{query}%"
            q = q.where(
                or_(
                    Book.title.ilike(like),
                    Book.description.ilike(like),
                    Book.isbn.ilike(like),
                    Book.barcode.ilike(like),
                )
            )
        if category:
            q = q.where(Book.category.ilike(f"%{category}%"))
        if language:
            q = q.where(Book.language == language)
        if min_price is not None:
            q = q.where(Book.price * 24000 >= min_price) if False else q  # keep to avoid double-VND; filter via display_price after fetch if needed
        if max_price is not None:
            q = q.where(Book.price * 24000 <= max_price) if False else q
        if author:
            q = q.join(Author).where(Author.name.ilike(f"%{author}%"))

        # Flags via BookExtra
        if bestseller or trending or new_arrival or featured or category_id:
            q = q.join(BookExtra, BookExtra.book_id == Book.id)
            if bestseller:
                q = q.where(BookExtra.is_bestseller.is_(True))
            if trending:
                q = q.where(BookExtra.is_trending.is_(True))
            if new_arrival:
                q = q.where(BookExtra.is_new.is_(True))
            if featured:
                q = q.where(BookExtra.is_featured.is_(True))
            if category_id:
                q = q.where(BookExtra.category_id == category_id)

        count_q = select(func.count()).select_from(q.subquery())
        total = int(await self.db.scalar(count_q) or 0)
        result = await self.db.execute(
            q.order_by(Book.rating.desc(), Book.sales_count.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        books = list(result.scalars().unique().all())
        items = [await self._serialize_book(b) for b in books]
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    async def get_book(self, book_id: int) -> Optional[dict[str, Any]]:
        result = await self.db.execute(select(Book).where(Book.id == book_id))
        book = result.scalar_one_or_none()
        if not book:
            return None
        return await self._serialize_book(book)

    async def find_by_barcode(self, code: str) -> Optional[dict[str, Any]]:
        result = await self.db.execute(
            select(Book)
            .options(selectinload(Book.author))
            .where(or_(Book.barcode == code, Book.isbn == code, Book.isbn.ilike(f"%{code}%")))
        )
        book = result.scalar_one_or_none()
        return await self._serialize_book(book) if book else None

    async def trending(self, limit: int = 10) -> List[dict[str, Any]]:
        data = await self.list_books(trending=True, page_size=limit)
        if data["items"]:
            return data["items"]
        # fallback by rating/sales
        data = await self.list_books(page_size=limit)
        return data["items"]

    async def bestseller(self, limit: int = 10) -> List[dict[str, Any]]:
        data = await self.list_books(bestseller=True, page_size=limit)
        if data["items"]:
            return data["items"]
        result = await self.db.execute(
            select(Book)
            .options(selectinload(Book.author))
            .where(Book.is_active.is_(True))
            .order_by(Book.sales_count.desc())
            .limit(limit)
        )
        return [await self._serialize_book(b) for b in result.scalars().all()]

    async def new_arrivals(self, limit: int = 10) -> List[dict[str, Any]]:
        data = await self.list_books(new_arrival=True, page_size=limit)
        if data["items"]:
            return data["items"]
        result = await self.db.execute(
            select(Book)
            .options(selectinload(Book.author))
            .where(Book.is_active.is_(True))
            .order_by(Book.id.desc())
            .limit(limit)
        )
        return [await self._serialize_book(b) for b in result.scalars().all()]

    async def recommend_for_user(
        self,
        customer_id: Optional[int] = None,
        category: Optional[str] = None,
        max_price: Optional[float] = None,
        limit: int = 5,
    ) -> List[dict[str, Any]]:
        # Use history/tags when available; otherwise bestsellers
        data = await self.list_books(
            category=category, max_price=max_price, page_size=limit, bestseller=True
        )
        if data["items"]:
            return data["items"]
        data = await self.list_books(category=category, max_price=max_price, page_size=limit)
        return data["items"]

    async def catalog_for_ai(self, limit: int = 20, category: Optional[str] = None) -> str:
        data = await self.list_books(category=category, page_size=limit)
        lines = []
        for b in data["items"]:
            lines.append(
                f"- id={b['id']} | {b['title']} | {b.get('author_name')} | "
                f"{b['price']:,.0f} {b['currency']} | stock={b['stock']} | "
                f"rating={b['rating']} | category={b.get('category')} | "
                f"bestseller={b.get('is_bestseller')} | format={b.get('format')}"
            )
        return "\n".join(lines) if lines else "(catalog trống)"

    # -------------------------------------------------------------- taxonomy
    async def list_categories(self) -> List[dict[str, Any]]:
        result = await self.db.execute(
            select(Category).where(Category.is_active.is_(True)).order_by(Category.sort_order, Category.name)
        )
        return [
            {
                "id": c.id,
                "slug": c.slug,
                "name": c.name,
                "description": c.description,
                "parent_id": c.parent_id,
                "image_url": c.image_url,
            }
            for c in result.scalars().all()
        ]

    async def list_authors(self, page: int = 1, page_size: int = 50) -> dict[str, Any]:
        total = int(await self.db.scalar(select(func.count()).select_from(Author)) or 0)
        result = await self.db.execute(
            select(Author).order_by(Author.name).offset((page - 1) * page_size).limit(page_size)
        )
        items = [
            {
                "id": a.id,
                "name": a.name,
                "bio": a.bio,
                "nationality": a.nationality,
                "genres": a.genres,
            }
            for a in result.scalars().all()
        ]
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    async def author_books(self, author_id: int) -> List[dict[str, Any]]:
        result = await self.db.execute(
            select(Book)
            .options(selectinload(Book.author))
            .where(Book.author_id == author_id, Book.is_active.is_(True))
        )
        return [await self._serialize_book(b) for b in result.scalars().all()]

    async def list_publishers(self) -> List[dict[str, Any]]:
        result = await self.db.execute(select(Publisher).order_by(Publisher.name))
        return [
            {
                "id": p.id,
                "slug": p.slug,
                "name": p.name,
                "description": p.description,
                "country": p.country,
                "website": p.website,
            }
            for p in result.scalars().all()
        ]

    async def inventory(self, book_id: Optional[int] = None) -> List[dict[str, Any]]:
        q = select(Book).where(Book.is_active.is_(True))
        if book_id:
            q = q.where(Book.id == book_id)
        result = await self.db.execute(q.order_by(Book.id))
        out = []
        for b in result.scalars().all():
            ser = await self._serialize_book(b)
            out.append(
                {
                    "book_id": b.id,
                    "title": b.title,
                    "stock": b.stock,
                    "available_stock": ser["available_stock"],
                    "warehouse_location": ser.get("warehouse_location"),
                    "is_low_stock": b.stock < 10,
                }
            )
        return out

    # ------------------------------------------------------------- wishlist
    async def wishlist_list(self, customer_id: int) -> List[dict[str, Any]]:
        result = await self.db.execute(
            select(WishlistItem).where(WishlistItem.customer_id == customer_id)
        )
        items = list(result.scalars().all())
        books = []
        for it in items:
            book = await self.get_book(it.book_id)
            if book:
                books.append({"wishlist_item_id": it.id, **book})
        return books

    async def wishlist_add(self, customer_id: int, book_id: int) -> dict[str, Any]:
        existing = await self.db.execute(
            select(WishlistItem).where(
                WishlistItem.customer_id == customer_id, WishlistItem.book_id == book_id
            )
        )
        if existing.scalar_one_or_none():
            return {"added": False, "message": "Sách đã có trong wishlist", "items": await self.wishlist_list(customer_id)}
        self.db.add(WishlistItem(customer_id=customer_id, book_id=book_id))
        await self.db.flush()
        return {"added": True, "message": "Đã thêm vào wishlist", "items": await self.wishlist_list(customer_id)}

    async def wishlist_remove(self, customer_id: int, book_id: int) -> dict[str, Any]:
        result = await self.db.execute(
            select(WishlistItem).where(
                WishlistItem.customer_id == customer_id, WishlistItem.book_id == book_id
            )
        )
        item = result.scalar_one_or_none()
        if item:
            await self.db.delete(item)
            await self.db.flush()
        return {"removed": bool(item), "items": await self.wishlist_list(customer_id)}

    # ----------------------------------------------------------------- cart
    async def cart_get(self, customer_id: int) -> dict[str, Any]:
        result = await self.db.execute(
            select(CartItem).where(CartItem.customer_id == customer_id)
        )
        items = list(result.scalars().all())
        lines = []
        subtotal = 0.0
        for item in items:
            # Always load book via async get_book (avoids lazy-load / greenlet issues)
            book_data = await self.get_book(item.book_id)
            unit = book_data["price"] if book_data else float(item.unit_price or 0)
            line_total = unit * item.quantity
            subtotal += line_total
            lines.append(
                {
                    "cart_item_id": item.id,
                    "book_id": item.book_id,
                    "title": book_data["title"] if book_data else None,
                    "quantity": item.quantity,
                    "unit_price": unit,
                    "line_total": round(line_total, 0),
                    "currency": "VND",
                    "stock": book_data["stock"] if book_data else 0,
                    "book": book_data,
                }
            )
        return {
            "customer_id": customer_id,
            "items": lines,
            "item_count": sum(i["quantity"] for i in lines),
            "subtotal": round(subtotal, 0),
            "currency": "VND",
        }

    async def cart_add(self, customer_id: int, book_id: int, quantity: int = 1) -> dict[str, Any]:
        ser = await self.get_book(book_id)
        if not ser:
            raise ValueError("Không tìm thấy sách")
        if ser["stock"] < quantity:
            raise ValueError(f"Không đủ hàng (còn {ser['stock']})")
        result = await self.db.execute(
            select(CartItem).where(CartItem.customer_id == customer_id, CartItem.book_id == book_id)
        )
        item = result.scalar_one_or_none()
        if item:
            item.quantity += quantity
            item.unit_price = ser["price"]
        else:
            self.db.add(
                CartItem(
                    customer_id=customer_id,
                    book_id=book_id,
                    quantity=quantity,
                    unit_price=ser["price"],
                )
            )
        await self.db.flush()
        cart = await self.cart_get(customer_id)
        cart["message"] = "Đã thêm vào giỏ hàng."
        return cart

    async def cart_update(self, customer_id: int, book_id: int, quantity: int) -> dict[str, Any]:
        result = await self.db.execute(
            select(CartItem).where(CartItem.customer_id == customer_id, CartItem.book_id == book_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise ValueError("Sản phẩm không có trong giỏ")
        if quantity <= 0:
            await self.db.delete(item)
        else:
            item.quantity = quantity
        await self.db.flush()
        return await self.cart_get(customer_id)

    async def cart_remove(self, customer_id: int, book_id: int) -> dict[str, Any]:
        return await self.cart_update(customer_id, book_id, 0)

    async def cart_total(
        self, customer_id: int, voucher_code: Optional[str] = None
    ) -> dict[str, Any]:
        cart = await self.cart_get(customer_id)
        subtotal = cart["subtotal"]
        discount = 0.0
        voucher = None
        if voucher_code:
            voucher, discount = await self.validate_voucher(voucher_code, subtotal, customer_id)
        shipping = 0.0 if subtotal - discount >= 400_000 else 30_000
        total = max(0, subtotal - discount + shipping)
        return {
            **cart,
            "discount": round(discount, 0),
            "shipping": shipping,
            "total": round(total, 0),
            "voucher": voucher,
        }

    # -------------------------------------------------------------- vouchers
    async def vouchers_available(self, customer_id: Optional[int] = None) -> List[dict[str, Any]]:
        result = await self.db.execute(select(Coupon).where(Coupon.is_active.is_(True)))
        items = []
        for c in result.scalars().all():
            items.append(
                {
                    "id": c.id,
                    "code": c.code,
                    "description": c.description,
                    "discount_type": c.discount_type,
                    "discount_value": c.discount_value,
                    "min_order": c.min_order,
                    "max_discount": c.max_discount,
                    "usage_limit": c.usage_limit,
                    "used_count": c.used_count,
                }
            )
        # Membership / student virtual vouchers
        if customer_id:
            cust = await self.db.get(Customer, customer_id)
            if cust and cust.membership_tier in ("gold", "platinum", "vip"):
                items.append(
                    {
                        "code": "MEMBER15",
                        "description": "Ưu đãi thành viên 15%",
                        "discount_type": "percent",
                        "discount_value": 15,
                        "min_order": 100_000,
                        "max_discount": 100_000,
                        "virtual": True,
                        "type": "membership",
                    }
                )
            student = await self.db.execute(
                select(StudentProfile).where(
                    StudentProfile.customer_id == customer_id, StudentProfile.verified.is_(True)
                )
            )
            if student.scalar_one_or_none():
                items.append(
                    {
                        "code": "STUDENT10",
                        "description": "Ưu đãi sinh viên 10%",
                        "discount_type": "percent",
                        "discount_value": 10,
                        "min_order": 0,
                        "max_discount": 50_000,
                        "virtual": True,
                        "type": "student",
                    }
                )
        return items

    async def validate_voucher(
        self, code: str, subtotal: float, customer_id: Optional[int] = None
    ) -> tuple[dict[str, Any], float]:
        code_u = code.upper().strip()
        # Virtual vouchers
        if code_u == "MEMBER15" and customer_id:
            cust = await self.db.get(Customer, customer_id)
            if not cust or cust.membership_tier not in ("gold", "platinum", "vip"):
                raise ValueError("Mã thành viên không áp dụng cho tài khoản này")
            discount = min(subtotal * 0.15, 100_000)
            return {"code": code_u, "type": "membership"}, round(discount, 0)
        if code_u == "STUDENT10" and customer_id:
            st = await self.db.execute(
                select(StudentProfile).where(
                    StudentProfile.customer_id == customer_id, StudentProfile.verified.is_(True)
                )
            )
            if not st.scalar_one_or_none():
                raise ValueError("Mã sinh viên chưa được xác thực")
            discount = min(subtotal * 0.10, 50_000)
            return {"code": code_u, "type": "student"}, round(discount, 0)
        if code_u == "BULK5":
            # bulk: 5% when subtotal high
            if subtotal < 500_000:
                raise ValueError("Mã mua nhiều cần đơn tối thiểu 500.000đ")
            return {"code": code_u, "type": "bulk"}, round(subtotal * 0.05, 0)

        result = await self.db.execute(select(Coupon).where(Coupon.code == code_u))
        coupon = result.scalar_one_or_none()
        if not coupon or not coupon.is_active:
            raise ValueError("Mã giảm giá không hợp lệ")
        if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
            raise ValueError("Mã đã hết lượt sử dụng")
        # min_order in seed may be USD-like; support both scales
        min_order = coupon.min_order
        if min_order < 1000:
            min_order = min_order * 24000
        if subtotal < min_order:
            raise ValueError(f"Đơn tối thiểu {min_order:,.0f}đ")
        if coupon.discount_type == "percent":
            discount = subtotal * (coupon.discount_value / 100.0)
            max_d = coupon.max_discount
            if max_d is not None:
                if max_d < 1000:
                    max_d = max_d * 24000
                discount = min(discount, max_d)
        else:
            discount = coupon.discount_value
            if discount < 1000:
                discount = discount * 24000
        discount = min(discount, subtotal)
        return {
            "code": coupon.code,
            "description": coupon.description,
            "discount_type": coupon.discount_type,
            "discount_value": coupon.discount_value,
        }, round(discount, 0)

    async def auto_apply_best_voucher(self, customer_id: int) -> dict[str, Any]:
        cart = await self.cart_get(customer_id)
        subtotal = cart["subtotal"]
        best = None
        best_discount = 0.0
        for v in await self.vouchers_available(customer_id):
            try:
                info, disc = await self.validate_voucher(v["code"], subtotal, customer_id)
                if disc > best_discount:
                    best_discount = disc
                    best = info
            except ValueError:
                continue
        total = await self.cart_total(customer_id, best["code"] if best else None)
        return {
            "best_voucher": best,
            "discount": best_discount,
            "cart_total": total,
            "message": (
                f"Đã chọn mã tốt nhất {best['code']} (tiết kiệm {best_discount:,.0f}đ)."
                if best
                else "Hiện chưa có mã phù hợp với giỏ hàng."
            ),
        }

    # --------------------------------------------------------------- orders
    async def order_create(
        self,
        customer_id: int,
        *,
        shipping_address: Optional[str] = None,
        voucher_code: Optional[str] = None,
        payment_method: str = "cod",
        notes: Optional[str] = None,
        ai_assisted: bool = True,
    ) -> dict[str, Any]:
        totals = await self.cart_total(customer_id, voucher_code)
        if not totals["items"]:
            raise ValueError("Giỏ hàng đang trống")
        order = Order(
            order_number=f"BN-{uuid.uuid4().hex[:10].upper()}",
            customer_id=customer_id,
            status="confirmed",
            subtotal=totals["subtotal"],
            discount=totals["discount"],
            shipping=totals["shipping"],
            total=totals["total"],
            voucher_code=totals["voucher"]["code"] if totals.get("voucher") else None,
            shipping_address=shipping_address,
            tracking_number=f"TRK{uuid.uuid4().hex[:12].upper()}",
            tracking_status="Đã xác nhận — đang chuẩn bị giao hàng",
            notes=notes,
            ai_assisted=ai_assisted,
        )
        self.db.add(order)
        await self.db.flush()

        for line in totals["items"]:
            self.db.add(
                OrderItem(
                    order_id=order.id,
                    book_id=line["book_id"],
                    quantity=line["quantity"],
                    unit_price=line["unit_price"],
                    title_snapshot=line.get("title"),
                )
            )
            book = await self.db.get(Book, line["book_id"])
            if book:
                book.stock = max(0, book.stock - line["quantity"])
                book.sales_count += line["quantity"]
                if ai_assisted:
                    book.ai_sales_count += line["quantity"]
                self.db.add(
                    InventoryLog(
                        book_id=book.id,
                        change=-line["quantity"],
                        reason=f"order {order.order_number}",
                        stock_after=book.stock,
                    )
                )
            # clear cart line
            result = await self.db.execute(
                select(CartItem).where(
                    CartItem.customer_id == customer_id, CartItem.book_id == line["book_id"]
                )
            )
            item = result.scalar_one_or_none()
            if item:
                await self.db.delete(item)

        if voucher_code:
            try:
                result = await self.db.execute(select(Coupon).where(Coupon.code == voucher_code.upper()))
                coupon = result.scalar_one_or_none()
                if coupon:
                    coupon.used_count += 1
            except Exception:
                pass

        payment = await self.payment_create(
            order_id=order.id,
            customer_id=customer_id,
            method=payment_method,
            amount=order.total,
        )
        await self.db.flush()
        return {
            "order": await self.order_get(order_number=order.order_number),
            "payment": payment,
            "message": "Đơn hàng đã được tạo.",
        }

    async def order_get(
        self,
        order_number: Optional[str] = None,
        order_id: Optional[int] = None,
        customer_id: Optional[int] = None,
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
            "id": order.id,
            "order_number": order.order_number,
            "customer_id": order.customer_id,
            "status": order.status,
            "subtotal": order.subtotal,
            "discount": order.discount,
            "shipping": order.shipping,
            "total": order.total,
            "currency": "VND",
            "voucher_code": order.voucher_code,
            "shipping_address": order.shipping_address,
            "tracking_number": order.tracking_number,
            "tracking_status": order.tracking_status,
            "notes": order.notes,
            "ai_assisted": order.ai_assisted,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "items": [
                {
                    "book_id": i.book_id,
                    "title": i.title_snapshot,
                    "quantity": i.quantity,
                    "unit_price": i.unit_price,
                    "line_total": i.unit_price * i.quantity,
                }
                for i in (order.items or [])
            ],
            "timeline": self._order_timeline(order.status),
        }

    def _order_timeline(self, status: str) -> List[dict[str, Any]]:
        steps = [
            ("confirmed", "Đã xác nhận"),
            ("processing", "Đang xử lý"),
            ("packed", "Đã đóng gói"),
            ("shipping", "Đang giao"),
            ("delivered", "Đã giao"),
        ]
        status_rank = {
            "pending": 0,
            "confirmed": 1,
            "processing": 2,
            "packed": 3,
            "shipping": 4,
            "delivered": 5,
            "cancelled": -1,
            "refunded": -1,
            "return_requested": 2,
        }
        rank = status_rank.get(status, 1)
        out = []
        for i, (key, label) in enumerate(steps, start=1):
            state = "done" if i <= rank else ("active" if i == rank + 1 else "pending")
            if status == "cancelled":
                state = "pending"
            out.append({"key": key, "label": label, "state": state})
        if status == "cancelled":
            out.append({"key": "cancelled", "label": "Đã hủy", "state": "active"})
        return out

    async def order_history(self, customer_id: int, limit: int = 20) -> List[dict[str, Any]]:
        result = await self.db.execute(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.customer_id == customer_id)
            .order_by(Order.id.desc())
            .limit(limit)
        )
        orders = []
        for o in result.scalars().all():
            orders.append(await self.order_get(order_id=o.id))
        return orders

    async def order_cancel(self, order_number: str, customer_id: int, reason: str = "") -> dict[str, Any]:
        order = await self._raw_order(order_number)
        if not order or order.customer_id != customer_id:
            raise ValueError("Không tìm thấy đơn hàng")
        if order.status in ("delivered", "cancelled", "refunded"):
            raise ValueError(f"Không thể hủy đơn ở trạng thái {order.status}")
        order.status = "cancelled"
        order.tracking_status = "Đơn hàng đã hủy"
        order.notes = (order.notes or "") + f"\nHủy: {reason}"
        await self.db.flush()
        return {"message": "Đơn hàng đã được hủy.", "order": await self.order_get(order_number=order_number)}

    async def order_update_address(
        self, order_number: str, customer_id: int, address: str
    ) -> dict[str, Any]:
        order = await self._raw_order(order_number)
        if not order or order.customer_id != customer_id:
            raise ValueError("Không tìm thấy đơn hàng")
        if order.status in ("shipping", "delivered", "cancelled"):
            raise ValueError("Không thể đổi địa chỉ khi đơn đang giao / đã giao")
        order.shipping_address = address
        order.notes = (order.notes or "") + "\nĐã cập nhật địa chỉ giao hàng"
        await self.db.flush()
        return {"message": "Đã đổi địa chỉ giao hàng.", "order": await self.order_get(order_number=order_number)}

    async def order_invoice(self, order_number: str, customer_id: int) -> dict[str, Any]:
        order = await self.order_get(order_number=order_number)
        if not order or order["customer_id"] != customer_id:
            raise ValueError("Không tìm thấy hóa đơn")
        return {
            "invoice_number": f"INV-{order['order_number']}",
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "seller": "BookNest Store",
            "order": order,
        }

    async def _raw_order(self, order_number: str) -> Optional[Order]:
        result = await self.db.execute(select(Order).where(Order.order_number == order_number))
        return result.scalar_one_or_none()

    # ------------------------------------------------------------- payments
    SUPPORTED_METHODS = ("cod", "momo", "vnpay", "zalopay", "visa", "mastercard")

    async def payment_create(
        self,
        order_id: int,
        customer_id: int,
        method: str,
        amount: float,
    ) -> dict[str, Any]:
        method = method.lower().strip()
        if method not in self.SUPPORTED_METHODS:
            raise ValueError(f"Phương thức không hỗ trợ. Chọn: {', '.join(self.SUPPORTED_METHODS)}")
        status = "paid" if method == "cod" else "pending"
        # COD: paid-on-delivery conceptually pending cash, mark as awaiting_cod
        if method == "cod":
            status = "awaiting_cod"
        payment = Payment(
            order_id=order_id,
            customer_id=customer_id,
            method=method,
            status=status,
            amount=amount,
            currency="VND",
            transaction_id=f"PAY-{uuid.uuid4().hex[:12].upper()}",
            provider_payload={
                "redirect_url": None
                if method in ("cod", "visa", "mastercard")
                else f"https://pay.booknest.local/{method}/checkout"
            },
            paid_at=datetime.now(timezone.utc) if status == "paid" else None,
        )
        self.db.add(payment)
        await self.db.flush()
        return {
            "payment_id": payment.id,
            "transaction_id": payment.transaction_id,
            "method": payment.method,
            "status": payment.status,
            "amount": payment.amount,
            "currency": payment.currency,
            "provider_payload": payment.provider_payload,
            "message": self._payment_message(method, status),
        }

    def _payment_message(self, method: str, status: str) -> str:
        if method == "cod":
            return (
                "Dạ được bạn nhé ✨ Mình chọn Thanh toán khi nhận hàng (COD). "
                "Bạn chỉ cần thanh toán cho đơn vị vận chuyển khi nhận sách."
            )
        labels = {
            "momo": "MoMo",
            "vnpay": "VNPay",
            "zalopay": "ZaloPay",
            "visa": "Visa",
            "mastercard": "Mastercard",
        }
        return f"Đã tạo yêu cầu thanh toán qua {labels.get(method, method)} (trạng thái: {status})."

    async def payment_confirm(self, transaction_id: str) -> dict[str, Any]:
        result = await self.db.execute(select(Payment).where(Payment.transaction_id == transaction_id))
        payment = result.scalar_one_or_none()
        if not payment:
            raise ValueError("Không tìm thấy giao dịch")
        payment.status = "paid"
        payment.paid_at = datetime.now(timezone.utc)
        await self.db.flush()
        return {
            "transaction_id": payment.transaction_id,
            "status": payment.status,
            "message": "Thanh toán thành công.",
        }

    # -------------------------------------------------------------- reviews
    async def reviews_for_book(self, book_id: int, limit: int = 20) -> List[dict[str, Any]]:
        result = await self.db.execute(
            select(Review).where(Review.book_id == book_id).order_by(Review.id.desc()).limit(limit)
        )
        return [
            {
                "id": r.id,
                "book_id": r.book_id,
                "customer_id": r.customer_id,
                "rating": r.rating,
                "title": r.title,
                "content": r.content,
                "is_verified": r.is_verified,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in result.scalars().all()
        ]

    async def review_create(
        self, book_id: int, customer_id: int, rating: float, content: str, title: str = ""
    ) -> dict[str, Any]:
        review = Review(
            book_id=book_id,
            customer_id=customer_id,
            rating=max(1, min(5, rating)),
            title=title,
            content=content,
            is_verified=True,
        )
        self.db.add(review)
        # update aggregate
        book = await self.db.get(Book, book_id)
        if book:
            total = book.rating * book.review_count + rating
            book.review_count += 1
            book.rating = round(total / book.review_count, 2)
        await self.db.flush()
        return {"id": review.id, "message": "Đã gửi đánh giá."}

    # ---------------------------------------------------------------- users
    async def user_get(self, customer_id: int) -> Optional[dict[str, Any]]:
        c = await self.db.get(Customer, customer_id)
        if not c:
            return None
        return {
            "id": c.id,
            "email": c.email,
            "name": c.name,
            "membership_tier": c.membership_tier,
            "language": c.language,
            "budget_preference": c.budget_preference,
            "is_active": c.is_active,
        }

    # ------------------------------------------------------- AI context pack
    async def chatbot_context(self, customer_id: Optional[int] = None) -> dict[str, Any]:
        """Realtime pack used by the concierge — always from DB/API."""
        catalog = await self.catalog_for_ai(limit=15)
        vouchers = await self.vouchers_available(customer_id)
        cart = await self.cart_get(customer_id) if customer_id else None
        wishlist = await self.wishlist_list(customer_id) if customer_id else []
        orders = await self.order_history(customer_id, limit=5) if customer_id else []
        user = await self.user_get(customer_id) if customer_id else None
        return {
            "user": user,
            "catalog_snippet": catalog,
            "vouchers": vouchers,
            "cart": cart,
            "wishlist_ids": [w["id"] for w in wishlist],
            "recent_orders": orders,
            "payment_methods": list(self.SUPPORTED_METHODS),
        }
