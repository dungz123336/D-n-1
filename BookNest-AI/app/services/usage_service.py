"""Persist AI usage logs for admin analytics."""

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.usage_log import AIUsageLog


class UsageService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()

    async def log(
        self,
        *,
        provider: str,
        model: str,
        prompt: Optional[str] = None,
        response: Optional[str] = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int = 0,
        latency_ms: float = 0.0,
        success: bool = True,
        error: Optional[str] = None,
        customer_id: Optional[int] = None,
        session_id: Optional[int] = None,
        endpoint: Optional[str] = None,
        meta: Optional[dict[str, Any]] = None,
    ) -> AIUsageLog:
        if not self.settings.log_ai_prompts:
            prompt = None
            # keep response truncated for analytics
            if response and len(response) > 500:
                response = response[:500] + "…"

        entry = AIUsageLog(
            customer_id=customer_id,
            session_id=session_id,
            endpoint=endpoint,
            provider=provider,
            model=model,
            prompt=prompt,
            response=response,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens or (prompt_tokens + completion_tokens),
            latency_ms=latency_ms,
            success=success,
            error=error,
            meta=meta or {},
        )
        self.db.add(entry)
        await self.db.flush()
        return entry
