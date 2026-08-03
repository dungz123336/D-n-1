"""Mock provider — trả lời tiếng Việt khi không có API key."""

import asyncio
import time
from typing import Any, AsyncIterator, List

from backend.llm.base import BaseLLMProvider, LLMMessage, LLMResponse


class MockProvider(BaseLLMProvider):
    name = "mock"

    async def complete(self, messages: List[LLMMessage], **kwargs: Any) -> LLMResponse:
        started = time.perf_counter()
        user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        content = (
            "Xin chào ✨\n\n"
            "Mình là **BookNest Concierge**.\n\n"
            f"Mình đã nhận được tin nhắn của bạn: “{user[:200]}”\n\n"
            "Mình có thể gợi ý sách theo nhu cầu, chọn sách làm quà, áp mã giảm giá, "
            "hỗ trợ đặt hàng và theo dõi đơn.\n\n"
            "Bạn muốn tìm sách về chủ đề nào hôm nay? "
            "Hoặc cho mình biết ngân sách và mục đích đọc nhé 📚"
        )
        await asyncio.sleep(0.05)
        return LLMResponse(
            content=content,
            provider=self.name,
            model=self.model or "mock-1",
            prompt_tokens=40,
            completion_tokens=90,
            total_tokens=130,
            latency_ms=(time.perf_counter() - started) * 1000,
        )

    async def stream(self, messages: List[LLMMessage], **kwargs: Any) -> AsyncIterator[str]:
        resp = await self.complete(messages, **kwargs)
        for word in resp.content.split(" "):
            yield word + " "
            await asyncio.sleep(0.015)
