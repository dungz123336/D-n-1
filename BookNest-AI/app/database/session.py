"""Async SQLAlchemy engine & session factory (SQLite / MySQL / PostgreSQL)."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

connect_args = {}
if settings.is_sqlite():
    connect_args = {"check_same_thread": False}

engine = create_async_engine(
    settings.resolved_database_url,
    echo=settings.database_echo,
    future=True,
    connect_args=connect_args,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create tables and seed demo catalog if empty."""
    from app.models import (  # noqa: F401 — register models
        author,
        book,
        cart,
        chat,
        coupon,
        customer,
        order,
        recommendation,
        usage_log,
        wishlist,
    )
    from app.database.seed import seed_if_empty

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        await seed_if_empty(session)
        await session.commit()
