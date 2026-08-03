"""Demo catalog seed for local development."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.entities import Author, Book, Coupon, Customer, CustomerMemory
from backend.models.store_entities import BookExtra, Category, Publisher, Review, StudentProfile
from backend.utils.security import hash_password


async def seed_if_empty(session: AsyncSession) -> None:
    count = await session.scalar(select(func.count()).select_from(Book))
    if count and count > 0:
        await seed_store_extensions(session)
        return

    authors = [
        Author(name="Haruki Murakami", bio="Japanese novelist.", nationality="Japan", genres="literary fiction"),
        Author(name="Yuval Noah Harari", bio="Historian and philosopher.", nationality="Israel", genres="history"),
        Author(name="James Clear", bio="Habits expert.", nationality="USA", genres="self-help"),
        Author(name="Nguyễn Nhật Ánh", bio="Vietnamese youth fiction.", nationality="Vietnam", genres="youth"),
        Author(name="Frank Herbert", bio="Creator of Dune.", nationality="USA", genres="science fiction"),
        Author(name="Agatha Christie", bio="Queen of mystery.", nationality="UK", genres="mystery"),
    ]
    session.add_all(authors)
    await session.flush()

    books = [
        Book(
            isbn="9780307476463", barcode="9780307476463", title="Kafka on the Shore",
            description="A metaphysical odyssey of a teenage boy and an aging man.",
            author_id=authors[0].id, category="Fiction", genres=["literary fiction"], language="en",
            format="paperback", price=16.99, original_price=19.99, stock=42, rating=4.5,
            review_count=12040, difficulty="intermediate", target_reader="Adult literary readers",
            page_count=505, published_year=2002, tags=["japan", "surreal"],
        ),
        Book(
            isbn="9780062316097", barcode="9780062316097", title="Sapiens: A Brief History of Humankind",
            description="How Homo sapiens came to dominate the world.",
            author_id=authors[1].id, category="Non-Fiction", genres=["history", "science"], language="en",
            format="paperback", price=18.50, original_price=22.0, stock=80, rating=4.6,
            review_count=89000, difficulty="intermediate", target_reader="Curious general readers",
            page_count=443, published_year=2011, tags=["history", "bestseller"],
        ),
        Book(
            isbn="9780735211292", barcode="9780735211292", title="Atomic Habits",
            description="Tiny changes, remarkable results.",
            author_id=authors[2].id, category="Self-Help", genres=["self-help", "productivity"], language="en",
            format="hardcover", price=21.0, original_price=27.0, stock=120, rating=4.8,
            review_count=150000, difficulty="beginner", target_reader="Anyone building habits",
            page_count=320, published_year=2018, tags=["habits", "bestseller"],
        ),
        Book(
            isbn="9786041234567", barcode="9786041234567", title="Mắt Biếc",
            description="Câu chuyện tình tuổi học trò đầy day dứt.",
            author_id=authors[3].id, category="Fiction", genres=["youth", "romance"], language="vi",
            format="paperback", price=8.50, stock=200, rating=4.7, review_count=50000,
            difficulty="beginner", target_reader="Teen and young adult", page_count=300,
            published_year=1990, tags=["vietnam", "classic"],
        ),
        Book(
            isbn="9780441172719", barcode="9780441172719", title="Dune",
            description="Epic saga of politics, religion, and ecology on Arrakis.",
            author_id=authors[4].id, category="Science Fiction", genres=["science fiction"], language="en",
            format="paperback", price=12.99, original_price=15.99, stock=60, rating=4.6,
            review_count=200000, difficulty="advanced", target_reader="SF fans",
            page_count=688, published_year=1965, tags=["classic", "epic"],
        ),
        Book(
            isbn="9780062073488", barcode="9780062073488", title="Murder on the Orient Express",
            description="Poirot investigates a murder on a snowbound train.",
            author_id=authors[5].id, category="Mystery", genres=["mystery"], language="en",
            format="paperback", price=11.99, stock=55, rating=4.4, review_count=95000,
            difficulty="beginner", target_reader="Mystery lovers", page_count=274,
            published_year=1934, tags=["classic", "whodunit"],
        ),
        Book(
            isbn="9780385474542", barcode="9780385474542", title="Norwegian Wood",
            description="A nostalgic story of loss and sexuality in 1960s Tokyo.",
            author_id=authors[0].id, category="Fiction", genres=["literary fiction"], language="en",
            format="ebook", price=9.99, stock=999, rating=4.3, review_count=40000,
            difficulty="intermediate", target_reader="Adult literary readers", page_count=296,
            published_year=1987, tags=["japan", "coming-of-age"],
        ),
        Book(
            isbn="9780062457732", barcode="9780062457732", title="Homo Deus",
            description="A brief history of tomorrow.",
            author_id=authors[1].id, category="Non-Fiction", genres=["futurism"], language="en",
            format="paperback", price=17.99, stock=40, rating=4.4, review_count=30000,
            difficulty="intermediate", target_reader="Readers of Sapiens", page_count=449,
            published_year=2015, tags=["future", "technology"],
        ),
    ]
    session.add_all(books)
    session.add_all(
        [
            Coupon(code="WELCOME10", description="10% off first order", discount_type="percent",
                   discount_value=10, min_order=20, max_discount=15, usage_limit=10000),
            Coupon(code="BOOKNEST15", description="$15 off over $50", discount_type="fixed",
                   discount_value=15, min_order=50, usage_limit=5000),
            Coupon(code="READMORE20", description="20% off members", discount_type="percent",
                   discount_value=20, min_order=30, max_discount=25, usage_limit=2000),
        ]
    )

    customer = Customer(
        external_id="demo-1",
        email="demo@booknest.ai",
        name="Demo Reader",
        membership_tier="gold",
        language="vi",
        budget_preference=300000,
        hashed_password=hash_password("demo1234"),
    )
    session.add(customer)
    await session.flush()
    session.add(
        CustomerMemory(
            customer_id=customer.id,
            favorite_genres=["literary fiction", "self-help"],
            favorite_authors=["Haruki Murakami"],
            reading_goals="Đọc 24 cuốn trong năm",
            budget=300000,
            preferred_format="paperback",
            reading_level="intermediate",
            language="vi",
            viewed_books=[],
            search_history=[],
        )
    )
    await seed_store_extensions(session)


async def seed_store_extensions(session: AsyncSession) -> None:
    """Categories, publishers, VND prices, reviews — for Store + AI realtime APIs."""
    cat_count = await session.scalar(select(func.count()).select_from(Category))
    if cat_count and cat_count > 0:
        return

    categories = [
        Category(slug="self-help", name="Phát triển bản thân", description="Self-help & thói quen", sort_order=1),
        Category(slug="fiction", name="Văn học", description="Tiểu thuyết & truyện", sort_order=2),
        Category(slug="business", name="Kinh doanh", description="Kinh doanh & khởi nghiệp", sort_order=3),
        Category(slug="tech", name="Công nghệ", description="Công nghệ & AI", sort_order=4),
        Category(slug="non-fiction", name="Phi hư cấu", description="Lịch sử, khoa học", sort_order=5),
        Category(slug="mystery", name="Trinh thám", description="Mystery & crime", sort_order=6),
        Category(slug="scifi", name="Khoa học viễn tưởng", description="Sci-fi", sort_order=7),
        Category(slug="youth", name="Tuổi teen", description="Thanh thiếu niên", sort_order=8),
    ]
    session.add_all(categories)
    await session.flush()

    publishers = [
        Publisher(slug="the-gioi", name="NXB Thế Giới", country="Vietnam"),
        Publisher(slug="tre", name="NXB Trẻ", country="Vietnam"),
        Publisher(slug="penguin", name="Penguin Random House", country="USA"),
        Publisher(slug="harper", name="HarperCollins", country="USA"),
    ]
    session.add_all(publishers)
    await session.flush()

    books = (await session.execute(select(Book).order_by(Book.id))).scalars().all()
    cat_by_name = {c.name: c for c in categories}
    # Map English categories to category rows
    mapping = {
        "Self-Help": categories[0].id,
        "Fiction": categories[1].id,
        "Non-Fiction": categories[4].id,
        "Science Fiction": categories[6].id,
        "Mystery": categories[5].id,
    }
    vnd_prices = {
        "Atomic Habits": (199000, 159000, True, True, True),
        "Sapiens: A Brief History of Humankind": (289000, 245000, True, True, False),
        "Kafka on the Shore": (189000, 165000, False, True, False),
        "Mắt Biếc": (98000, 85000, True, False, True),
        "Dune": (259000, 219000, True, True, False),
        "Murder on the Orient Express": (149000, 129000, False, False, True),
        "Norwegian Wood": (169000, 149000, False, True, False),
        "Homo Deus": (279000, 239000, False, True, False),
    }
    for b in books:
        prices = vnd_prices.get(b.title, (int(b.price * 24000), None, False, False, False))
        orig, sale, best, trend, is_new = prices
        slug = b.title.lower().replace(" ", "-").replace(":", "")[:80]
        session.add(
            BookExtra(
                book_id=b.id,
                slug=slug,
                publisher_id=publishers[0].id if b.language == "vi" else publishers[2].id,
                category_id=mapping.get(b.category or "", categories[0].id),
                is_bestseller=best,
                is_trending=trend,
                is_new=is_new,
                is_featured=best or trend,
                flash_sale=bool(sale and sale < orig),
                price_vnd=float(orig),
                sale_price_vnd=float(sale) if sale else None,
                warehouse_location="HCM-01",
                reserved_stock=0,
            )
        )
        # Update book currency preference for store display path
        if b.title == "Atomic Habits":
            b.sales_count = 1500
            b.category = "Self-Help"
        session.add(
            Review(
                book_id=b.id,
                customer_id=1,
                rating=b.rating or 5,
                title="Đáng đọc",
                content="Nội dung dễ hiểu, rất hợp người mới bắt đầu.",
                is_verified=True,
            )
        )

    # Student profile for demo user
    session.add(StudentProfile(customer_id=1, school="ĐH Bách Khoa", student_id="SV001", verified=True))
    # Extra bulk coupon style already virtual; ensure WELCOME codes work at VND scale
    # Raise min_order of coupons to VND if still small
    coupons = (await session.execute(select(Coupon))).scalars().all()
    for c in coupons:
        if c.min_order < 1000:
            c.min_order = c.min_order * 24000
        if c.max_discount and c.max_discount < 1000:
            c.max_discount = c.max_discount * 24000
        if c.discount_type == "fixed" and c.discount_value < 1000:
            c.discount_value = c.discount_value * 24000

