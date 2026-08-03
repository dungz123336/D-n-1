"""
BookNest Store REST API — shared by website frontend and AI Concierge.

All endpoints read/write the same database so the chatbot always sees live data.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.schemas.common import APIResponse, PaginatedResponse
from backend.services.store_service import StoreService
from backend.utils.security import create_access_token, hash_password, verify_password
from backend.models.entities import Customer, CustomerMemory
from sqlalchemy import select

router = APIRouter()


# ========================= Auth / Users =========================
class RegisterBody(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: Optional[str] = None
    language: str = "vi"


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/auth/register", tags=["Authentication"])
async def register(body: RegisterBody, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Customer).where(Customer.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email đã được đăng ký")
    c = Customer(
        email=body.email,
        name=body.name or body.email.split("@")[0],
        language=body.language,
        hashed_password=hash_password(body.password),
        membership_tier="standard",
    )
    db.add(c)
    await db.flush()
    db.add(CustomerMemory(customer_id=c.id, language=body.language))
    await db.flush()
    token = create_access_token(c.id, extra={"email": c.email, "role": "customer"})
    return APIResponse(
        message="Đăng ký thành công",
        data={"access_token": token, "customer_id": c.id, "email": c.email},
    )


@router.post("/auth/login", tags=["Authentication"])
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).where(Customer.email == body.email))
    c = result.scalar_one_or_none()
    if not c or not verify_password(body.password, c.hashed_password or ""):
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")
    token = create_access_token(c.id, extra={"email": c.email, "role": "customer"})
    return APIResponse(
        message="Đăng nhập thành công",
        data={"access_token": token, "customer_id": c.id, "email": c.email, "name": c.name},
    )


@router.get("/users/{customer_id}", tags=["Users"])
async def get_user(customer_id: int, db: AsyncSession = Depends(get_db)):
    user = await StoreService(db).user_get(customer_id)
    if not user:
        raise HTTPException(404, "Không tìm thấy người dùng")
    return APIResponse(data=user)


# ========================= Books =========================
@router.get("/books", tags=["Books"])
async def books_list(
    q: Optional[str] = None,
    category: Optional[str] = None,
    category_id: Optional[int] = None,
    author: Optional[str] = None,
    language: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    data = await StoreService(db).list_books(
        query=q,
        category=category,
        category_id=category_id,
        author=author,
        language=language,
        min_price=min_price,
        max_price=max_price,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse(
        total=data["total"], page=data["page"], page_size=data["page_size"], items=data["items"]
    )


@router.get("/books/search", tags=["Books", "Search"])
async def books_search(
    q: str = Query(..., min_length=1),
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    data = await StoreService(db).list_books(query=q, page=page, page_size=page_size)
    return PaginatedResponse(
        total=data["total"], page=data["page"], page_size=data["page_size"], items=data["items"]
    )


@router.get("/books/trending", tags=["Books"])
async def books_trending(limit: int = 10, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).trending(limit))


@router.get("/books/bestseller", tags=["Books"])
async def books_bestseller(limit: int = 10, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).bestseller(limit))


@router.get("/books/new", tags=["Books"])
async def books_new(limit: int = 10, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).new_arrivals(limit))


@router.get("/books/category", tags=["Books"])
async def books_by_category(
    slug: Optional[str] = None,
    name: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    data = await StoreService(db).list_books(category=name or slug, page=page, page_size=page_size)
    return PaginatedResponse(
        total=data["total"], page=data["page"], page_size=data["page_size"], items=data["items"]
    )


@router.get("/books/recommend", tags=["Books", "Recommendations", "AI Recommendation"])
async def books_recommend(
    customer_id: Optional[int] = None,
    category: Optional[str] = None,
    max_price: Optional[float] = None,
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
):
    items = await StoreService(db).recommend_for_user(
        customer_id=customer_id, category=category, max_price=max_price, limit=limit
    )
    return APIResponse(data=items)


@router.get("/books/{book_id}", tags=["Books"])
async def books_detail(book_id: int, db: AsyncSession = Depends(get_db)):
    book = await StoreService(db).get_book(book_id)
    if not book:
        raise HTTPException(404, "Không tìm thấy sách")
    reviews = await StoreService(db).reviews_for_book(book_id, limit=10)
    return APIResponse(data={**book, "reviews": reviews})


# ========================= Categories / Authors / Publishers / Inventory
@router.get("/categories", tags=["Categories"])
async def categories(db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).list_categories())


@router.get("/authors", tags=["Authors"])
async def authors(page: int = 1, page_size: int = 50, db: AsyncSession = Depends(get_db)):
    data = await StoreService(db).list_authors(page, page_size)
    return PaginatedResponse(
        total=data["total"], page=data["page"], page_size=data["page_size"], items=data["items"]
    )


@router.get("/authors/{author_id}", tags=["Authors"])
async def author_detail(author_id: int, db: AsyncSession = Depends(get_db)):
    data = await StoreService(db).list_authors(page=1, page_size=500)
    author = next((a for a in data["items"] if a["id"] == author_id), None)
    if not author:
        raise HTTPException(404, "Không tìm thấy tác giả")
    books = await StoreService(db).author_books(author_id)
    return APIResponse(data={**author, "books": books})


@router.get("/authors/{author_id}/books", tags=["Authors"])
async def author_books(author_id: int, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).author_books(author_id))


@router.get("/publishers", tags=["Publishers"])
async def publishers(db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).list_publishers())


@router.get("/inventory", tags=["Inventory"])
async def inventory(book_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).inventory(book_id))


# ========================= Wishlist =========================
class WishlistBody(BaseModel):
    customer_id: int
    book_id: int


@router.get("/wishlist", tags=["Wishlist"])
async def wishlist_get(customer_id: int, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).wishlist_list(customer_id))


@router.post("/wishlist", tags=["Wishlist"])
async def wishlist_add(body: WishlistBody, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).wishlist_add(body.customer_id, body.book_id))


@router.delete("/wishlist", tags=["Wishlist"])
async def wishlist_delete(customer_id: int, book_id: int, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).wishlist_remove(customer_id, book_id))


# ========================= Cart =========================
class CartAddBody(BaseModel):
    customer_id: int
    book_id: int
    quantity: int = Field(default=1, ge=1)


class CartUpdateBody(BaseModel):
    customer_id: int
    book_id: int
    quantity: int


@router.get("/cart", tags=["Cart"])
async def cart_get(customer_id: int, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).cart_get(customer_id))


@router.post("/cart/items", tags=["Cart"])
async def cart_add(body: CartAddBody, db: AsyncSession = Depends(get_db)):
    try:
        return APIResponse(message="Đã thêm vào giỏ hàng.", data=await StoreService(db).cart_add(
            body.customer_id, body.book_id, body.quantity
        ))
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.patch("/cart/items", tags=["Cart"])
async def cart_update(body: CartUpdateBody, db: AsyncSession = Depends(get_db)):
    try:
        return APIResponse(data=await StoreService(db).cart_update(
            body.customer_id, body.book_id, body.quantity
        ))
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.delete("/cart/items", tags=["Cart"])
async def cart_delete(customer_id: int, book_id: int, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).cart_remove(customer_id, book_id))


@router.get("/cart/total", tags=["Cart"])
async def cart_total(
    customer_id: int,
    voucher_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    return APIResponse(data=await StoreService(db).cart_total(customer_id, voucher_code))


# ========================= Orders =========================
class OrderCreateBody(BaseModel):
    customer_id: int
    shipping_address: Optional[str] = None
    voucher_code: Optional[str] = None
    payment_method: str = "cod"
    notes: Optional[str] = None
    ai_assisted: bool = True


class OrderCancelBody(BaseModel):
    order_number: str
    customer_id: int
    reason: str = ""


class OrderAddressBody(BaseModel):
    order_number: str
    customer_id: int
    shipping_address: str


@router.post("/orders", tags=["Orders"])
async def order_create(body: OrderCreateBody, db: AsyncSession = Depends(get_db)):
    try:
        data = await StoreService(db).order_create(
            body.customer_id,
            shipping_address=body.shipping_address,
            voucher_code=body.voucher_code,
            payment_method=body.payment_method,
            notes=body.notes,
            ai_assisted=body.ai_assisted,
        )
        return APIResponse(message="Đơn hàng đã được tạo.", data=data)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/orders/cancel", tags=["Orders"])
async def order_cancel(body: OrderCancelBody, db: AsyncSession = Depends(get_db)):
    try:
        return APIResponse(data=await StoreService(db).order_cancel(
            body.order_number, body.customer_id, body.reason
        ))
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/orders/track", tags=["Orders"])
async def order_track(
    order_number: Optional[str] = None,
    customer_id: Optional[int] = None,
    order_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    # support query-like body via query params for simplicity
    order = await StoreService(db).order_get(
        order_number=order_number, customer_id=customer_id, order_id=order_id
    )
    if not order:
        raise HTTPException(404, "Không tìm thấy đơn hàng")
    return APIResponse(data=order)


@router.get("/orders/history", tags=["Orders"])
async def order_history(customer_id: int, limit: int = 20, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).order_history(customer_id, limit))


@router.get("/orders/invoice", tags=["Orders"])
async def order_invoice(order_number: str, customer_id: int, db: AsyncSession = Depends(get_db)):
    try:
        return APIResponse(data=await StoreService(db).order_invoice(order_number, customer_id))
    except ValueError as e:
        raise HTTPException(404, str(e)) from e


@router.post("/orders/address", tags=["Orders"])
async def order_address(body: OrderAddressBody, db: AsyncSession = Depends(get_db)):
    try:
        return APIResponse(data=await StoreService(db).order_update_address(
            body.order_number, body.customer_id, body.shipping_address
        ))
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


# ========================= Payments =========================
class PaymentBody(BaseModel):
    order_id: int
    customer_id: int
    method: str  # cod|momo|vnpay|zalopay|visa|mastercard
    amount: float


@router.get("/payments/methods", tags=["Payments"])
async def payment_methods():
    return APIResponse(
        data=[
            {"id": "cod", "name": "Thanh toán khi nhận hàng (COD)"},
            {"id": "momo", "name": "MoMo"},
            {"id": "vnpay", "name": "VNPay"},
            {"id": "zalopay", "name": "ZaloPay"},
            {"id": "visa", "name": "Visa"},
            {"id": "mastercard", "name": "Mastercard"},
        ]
    )


@router.post("/payments", tags=["Payments"])
async def payment_create(body: PaymentBody, db: AsyncSession = Depends(get_db)):
    try:
        return APIResponse(data=await StoreService(db).payment_create(
            body.order_id, body.customer_id, body.method, body.amount
        ))
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/payments/{transaction_id}/confirm", tags=["Payments"])
async def payment_confirm(transaction_id: str, db: AsyncSession = Depends(get_db)):
    try:
        return APIResponse(data=await StoreService(db).payment_confirm(transaction_id))
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


# ========================= Vouchers =========================
@router.get("/vouchers", tags=["Vouchers"])
async def vouchers(customer_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).vouchers_available(customer_id))


@router.post("/vouchers/apply", tags=["Vouchers"])
async def voucher_apply(
    customer_id: int,
    code: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        cart = await StoreService(db).cart_get(customer_id)
        info, discount = await StoreService(db).validate_voucher(code, cart["subtotal"], customer_id)
        total = await StoreService(db).cart_total(customer_id, code)
        return APIResponse(
            message="Đã áp dụng mã giảm giá.",
            data={"voucher": info, "discount": discount, "cart": total},
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/vouchers/auto-apply", tags=["Vouchers"])
async def voucher_auto(customer_id: int, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).auto_apply_best_voucher(customer_id))


@router.get("/vouchers/bulk", tags=["Vouchers"])
async def voucher_bulk():
    return APIResponse(
        data={
            "code": "BULK5",
            "description": "Mua nhiều giảm nhiều — 5% cho đơn từ 500.000đ",
            "discount_type": "percent",
            "discount_value": 5,
            "min_order": 500_000,
        }
    )


@router.get("/vouchers/student", tags=["Vouchers"])
async def voucher_student():
    return APIResponse(
        data={
            "code": "STUDENT10",
            "description": "Ưu đãi sinh viên 10% (cần xác thực)",
            "discount_type": "percent",
            "discount_value": 10,
            "max_discount": 50_000,
        }
    )


@router.get("/vouchers/membership", tags=["Vouchers"])
async def voucher_membership():
    return APIResponse(
        data={
            "code": "MEMBER15",
            "description": "Ưu đãi thành viên Gold/Platinum 15%",
            "discount_type": "percent",
            "discount_value": 15,
            "max_discount": 100_000,
        }
    )


# ========================= Reviews =========================
class ReviewBody(BaseModel):
    book_id: int
    customer_id: int
    rating: float = Field(ge=1, le=5)
    title: str = ""
    content: str = ""


@router.get("/reviews", tags=["Reviews"])
async def reviews(book_id: int, limit: int = 20, db: AsyncSession = Depends(get_db)):
    return APIResponse(data=await StoreService(db).reviews_for_book(book_id, limit))


@router.post("/reviews", tags=["Reviews"])
async def review_create(body: ReviewBody, db: AsyncSession = Depends(get_db)):
    return APIResponse(
        data=await StoreService(db).review_create(
            body.book_id, body.customer_id, body.rating, body.content, body.title
        )
    )


# ========================= Search / Voice / Barcode =========================
@router.get("/search", tags=["Search"])
async def search(q: str, page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    data = await StoreService(db).list_books(query=q, page=page, page_size=page_size)
    return PaginatedResponse(
        total=data["total"], page=data["page"], page_size=data["page_size"], items=data["items"]
    )


class VoiceSearchBody(BaseModel):
    transcript: str
    customer_id: Optional[int] = None


@router.post("/search/voice", tags=["Voice Search", "Search"])
async def search_voice(body: VoiceSearchBody, db: AsyncSession = Depends(get_db)):
    data = await StoreService(db).list_books(query=body.transcript, page_size=10)
    return APIResponse(
        data={
            "transcript": body.transcript,
            "results": data["items"],
            "total": data["total"],
        }
    )


@router.get("/search/barcode", tags=["Barcode Search", "Search"])
async def search_barcode(code: str, db: AsyncSession = Depends(get_db)):
    book = await StoreService(db).find_by_barcode(code)
    if not book:
        return APIResponse(success=False, message="Không tìm thấy sách", data={"found": False})
    return APIResponse(message="Đã tìm thấy sách", data={"found": True, "book": book})


# ========================= Chatbot context bridge =========================
@router.get("/ai/context", tags=["AI Recommendation", "Chatbot"])
async def ai_context(customer_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """Realtime pack for the AI — books, cart, vouchers, orders from API/DB."""
    return APIResponse(data=await StoreService(db).chatbot_context(customer_id))
