"""
BookNest bookstore integration client (future-ready).

When BOOKNEST_SYNC_ENABLED=true and BOOKNEST_API_URL is set, the concierge
can read products, authors, categories, inventory, promotions, vouchers,
orders, and customers from the main BookNest API — without changing chat architecture.
"""

from typing import Any, List, Optional

import httpx

from app.config import get_settings
from app.utils.logging import logger


class BookNestClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = (self.settings.booknest_api_url or "").rstrip("/")
        self.api_key = self.settings.booknest_api_key
        self.enabled = bool(self.settings.booknest_sync_enabled and self.base_url)

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-API-Key"] = self.api_key
        return headers

    async def _get(self, path: str, params: Optional[dict] = None) -> Any:
        if not self.enabled:
            return None
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, params=params, headers=self._headers())
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.warning("BookNest API GET %s failed: %s", path, exc)
            return None

    async def get_products(self, page: int = 1, page_size: int = 50) -> Optional[Any]:
        return await self._get("/products", {"page": page, "page_size": page_size})

    async def get_authors(self) -> Optional[Any]:
        return await self._get("/authors")

    async def get_categories(self) -> Optional[Any]:
        return await self._get("/categories")

    async def get_inventory(self, sku: Optional[str] = None) -> Optional[Any]:
        return await self._get("/inventory", {"sku": sku} if sku else None)

    async def get_promotions(self) -> Optional[Any]:
        return await self._get("/promotions")

    async def get_vouchers(self) -> Optional[Any]:
        return await self._get("/vouchers")

    async def get_orders(self, customer_id: Optional[str] = None) -> Optional[Any]:
        params = {"customer_id": customer_id} if customer_id else None
        return await self._get("/orders", params)

    async def get_customer(self, customer_id: str) -> Optional[Any]:
        return await self._get(f"/customers/{customer_id}")
