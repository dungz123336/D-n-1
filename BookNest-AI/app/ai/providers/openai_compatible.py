"""OpenAI-compatible provider (OpenAI, Grok/xAI, OpenRouter, Ollama, Local LLM)."""

import time
from typing import Any, AsyncIterator, List, Optional

from openai import AsyncOpenAI

from app.ai.base import BaseLLMProvider, LLMMessage, LLMResponse
from app.utils.logging import logger


class OpenAICompatibleProvider(BaseLLMProvider):
    """
    Single implementation for any OpenAI Chat Completions-compatible API:
    - OpenAI
    - Grok (xAI / SpaceXAI)
    - OpenRouter
    - Ollama
    - Local LLM (vLLM, LM Studio, llama.cpp server, etc.)
    """

    def __init__(
        self,
        *,
        name: str,
        api_key: str,
        base_url: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: float = 60.0,
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

    def _to_api(self, messages: List[LLMMessage]) -> list[dict[str, str]]:
        return [{"role": m.role, "content": m.content} for m in messages]

    async def complete(self, messages: List[LLMMessage], **kwargs: Any) -> LLMResponse:
        started = time.perf_counter()
        try:
            resp = await self._client.chat.completions.create(
                model=kwargs.get("model", self.model),
                messages=self._to_api(messages),
                temperature=kwargs.get("temperature", self.temperature),
                max_tokens=kwargs.get("max_tokens", self.max_tokens),
            )
            latency = (time.perf_counter() - started) * 1000
            choice = resp.choices[0].message.content or ""
            usage = resp.usage
            return LLMResponse(
                content=choice,
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
            messages=self._to_api(messages),
            temperature=kwargs.get("temperature", self.temperature),
            max_tokens=kwargs.get("max_tokens", self.max_tokens),
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def health_check(self) -> bool:
        try:
            # Lightweight: list models or tiny completion depending on backend
            await self._client.models.list()
            return True
        except Exception:
            return False
