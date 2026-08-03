"""Basic API smoke tests (mock AI provider)."""

import os

# Force mock provider before app import
os.environ.setdefault("AI_PROVIDER", "mock")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_booknest_ai.db")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_SECRET", "test-jwt")
os.environ.setdefault("ADMIN_API_KEY", "test-admin-key")

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai.factory import reset_provider_cache
from app.main import app


@pytest.fixture(autouse=True)
def _reset_provider():
    reset_provider_cache()
    yield
    reset_provider_cache()


@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"
        assert "ai_provider" in data


@pytest.mark.asyncio
async def test_list_books():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/books")
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["total"] >= 1


@pytest.mark.asyncio
async def test_recommend_asks_questions():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/recommend", json={"customer_id": 1})
        assert r.status_code == 200
        body = r.json()["data"]
        assert body["status"] == "need_more_info"
        assert len(body["missing"]) > 0


@pytest.mark.asyncio
async def test_chat_mock():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/chat", json={"message": "Hello, I need a book gift"})
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["message"]
        assert data["session_id"]


@pytest.mark.asyncio
async def test_admin_requires_key():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/admin/dashboard")
        assert r.status_code == 403
        r2 = await client.get("/admin/dashboard", headers={"X-API-Key": "test-admin-key"})
        assert r2.status_code == 200
