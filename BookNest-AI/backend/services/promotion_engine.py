"""Promotion + loyalty engine (detect sales, stack rules, member benefits)."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.entities import Customer
from backend.services.store_service import StoreService


class PromotionEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.store = StoreService(db)

    async def detect_promotions(self, customer_id: Optional[int] = None) -> dict[str, Any]:
        flash = await self.store.list_books(page_size=20)
        flash_items = [b for b in flash["items"] if b.get("flash_sale") or (b.get("discount_percent") or 0) >= 15]
        vouchers = await self.store.vouchers_available(customer_id)
        return {
            "flash_sale": flash_items[:8],
            "vouchers": vouchers,
            "combo": {
                "code": "BUY2GET1",
                "description": "Mua 2 tặng 1 (sách cùng danh mục — áp dụng khi checkout)",
                "type": "buy_x_get_y",
            },
            "student_discount": {"code": "STUDENT10", "percent": 10},
            "membership_discount": {"code": "MEMBER15", "percent": 15},
            "shipping_discount": {
                "free_ship_threshold": 400_000,
                "description": "Miễn phí ship đơn từ 400.000đ",
            },
            "stack_rules": [
                "Không cộng dồn 2 mã % trên cùng 1 đơn (chọn mã tốt nhất).",
                "Free ship có thể đi kèm mã % nếu đơn đủ ngưỡng.",
                "Mã sinh viên / thành viên cần đủ điều kiện hạng.",
            ],
        }

    async def loyalty(self, customer_id: int) -> dict[str, Any]:
        user = await self.store.user_get(customer_id)
        if not user:
            raise ValueError("Không tìm thấy khách hàng")
        tier = (user.get("membership_tier") or "standard").lower()
        levels = ["standard", "silver", "gold", "platinum", "vip"]
        idx = levels.index(tier) if tier in levels else 0
        points = {0: 120, 1: 450, 2: 1200, 3: 3200, 4: 8000}.get(idx, 100)
        next_level = levels[idx + 1] if idx + 1 < len(levels) else None
        benefits = {
            "standard": ["Tích điểm cơ bản", "Sinh nhật voucher nhỏ"],
            "silver": ["Giảm ship", "Flash sale sớm 15 phút"],
            "gold": ["MEMBER15", "Flash sale sớm", "Đổi điểm lấy voucher"],
            "platinum": ["Ưu tiên CSKH", "Quà sinh nhật", "Double point cuối tuần"],
            "vip": ["Personal librarian", "Ưu đãi độc quyền", "Free ship mọi đơn"],
        }
        return {
            "customer_id": customer_id,
            "member_level": tier,
            "reward_points": points,
            "next_level": next_level,
            "points_to_next": 500 if next_level else 0,
            "benefits": benefits.get(tier, benefits["standard"]),
        }

    async def shipping_estimate(
        self, subtotal: float, city: str = "HCM"
    ) -> dict[str, Any]:
        free = subtotal >= 400_000
        fee = 0 if free else (25_000 if city.upper() in ("HCM", "HN", "HÀ NỘI", "TP.HCM") else 35_000)
        return {
            "shipping_fee": fee,
            "currency": "VND",
            "delivery_time": "2–4 ngày làm việc" if city.upper() in ("HCM", "HN", "HÀ NỘI", "TP.HCM") else "3–6 ngày làm việc",
            "courier": "BookNest Express / GHN",
            "free_ship": free,
        }
