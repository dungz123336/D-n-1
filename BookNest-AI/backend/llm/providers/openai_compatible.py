"""
OpenAI-compatible chat completions.

Used for: OpenAI, Grok (xAI), DeepSeek, and any OpenAI-compatible gateway.
"""

import time
from typing import Any, AsyncIterator, List, Optional

from openai import AsyncOpenAI

from backend.llm.base import BaseLLMProvider, LLMMessage, LLMResponse
from backend.utils.logging import logger


class OpenAICompatibleProvider(BaseLLMProvider):
    def __init__(
        self,
        *,
        name: str,
        api_key: str,
        base_url: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: float = 90.0,
        default_headers: Optional[dict[str, str]] = None,
    ):
        super().__init__(model=model, temperature=temperature, max_tokens=max_tokens)
        self.name = name
        self._client = AsyncOpenAI(
            api_key=api_key or "not-needed",
            base_url=base_url,
            timeout=timeout,
            default_headers=default_headers or None,
        )

    def _api_messages(self, messages: List[LLMMessage]) -> list[dict[str, str]]:
        return [{"role": m.role, "content": m.content} for m in messages]

    async def complete(self, messages: List[LLMMessage], **kwargs: Any) -> LLMResponse:
        started = time.perf_counter()
        try:
            resp = await self._client.chat.completions.create(
                model=kwargs.get("model", self.model),
                messages=self._api_messages(messages),
                temperature=kwargs.get("temperature", self.temperature),
                max_tokens=kwargs.get("max_tokens", self.max_tokens),
            )
            latency = (time.perf_counter() - started) * 1000
            usage = resp.usage
            return LLMResponse(
                content=resp.choices[0].message.content or "",
                provider=self.name,
                model=resp.model or self.model,
                prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
                completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
                total_tokens=getattr(usage, "total_tokens", 0) or 0,
                latency_ms=latency,
                raw=resp,
            )
        except Exception as exc:
            logger.exception("LLM complete failed provider=%s: %s", self.name, exc)
            raise

    async def stream(self, messages: List[LLMMessage], **kwargs: Any) -> AsyncIterator[str]:
        stream = await self._client.chat.completions.create(
            model=kwargs.get("model", self.model),
            messages=self._api_messages(messages),
            temperature=kwargs.get("temperature", self.temperature),
            max_tokens=kwargs.get("max_tokens", self.max_tokens),
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
