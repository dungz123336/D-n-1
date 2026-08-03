"""Offline mock provider for tests and demos without API keys."""

import asyncio
import time
from typing import Any, AsyncIterator, List

from app.ai.base import BaseLLMProvider, LLMMessage, LLMResponse


class MockProvider(BaseLLMProvider):
    name = "mock"

    async def complete(self, messages: List[LLMMessage], **kwargs: Any) -> LLMResponse:
        started = time.perf_counter()
        user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        content = (
            "Hello! I'm your BookNest AI Concierge (mock mode).\n\n"
            f"You said: {user[:200]}\n\n"
            "To recommend books well, I like to know: purpose, budget, reading level, "
            "favorite author, language, and paperback vs ebook. How can I help today?"
        )
        await asyncio.sleep(0.05)
        latency = (time.perf_counter() - started) * 1000
        return LLMResponse(
            content=content,
            provider=self.name,
            model=self.model or "mock-1",
            prompt_tokens=50,
            completion_tokens=80,
            total_tokens=130,
            latency_ms=latency,
        )

    async def stream(self, messages: List[LLMMessage], **kwargs: Any) -> AsyncIterator[str]:
        resp = await self.complete(messages, **kwargs)
        for word in resp.content.split(" "):
            yield word + " "
            await asyncio.sleep(0.02)
