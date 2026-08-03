"""Anthropic Claude provider."""

import time
from typing import Any, AsyncIterator, List

from app.ai.base import BaseLLMProvider, LLMMessage, LLMResponse
from app.utils.logging import logger


class ClaudeProvider(BaseLLMProvider):
    name = "claude"

    def __init__(
        self,
        api_key: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: float = 60.0,
    ):
        super().__init__(model=model, temperature=temperature, max_tokens=max_tokens)
        self.api_key = api_key
        self.timeout = timeout
        self._client = None

    def _get_client(self):
        if self._client is None:
            from anthropic import AsyncAnthropic

            self._client = AsyncAnthropic(api_key=self.api_key, timeout=self.timeout)
        return self._client

    def _split(self, messages: List[LLMMessage]) -> tuple[str, list[dict[str, str]]]:
        system_parts = [m.content for m in messages if m.role == "system"]
        chat = [{"role": m.role, "content": m.content} for m in messages if m.role != "system"]
        # Anthropic requires alternating user/assistant; ensure starts with user
        if chat and chat[0]["role"] != "user":
            chat.insert(0, {"role": "user", "content": "(continue)"})
        return "\n\n".join(system_parts), chat

    async def complete(self, messages: List[LLMMessage], **kwargs: Any) -> LLMResponse:
        client = self._get_client()
        system, chat = self._split(messages)
        started = time.perf_counter()
        try:
            resp = await client.messages.create(
                model=kwargs.get("model", self.model),
                max_tokens=kwargs.get("max_tokens", self.max_tokens),
                temperature=kwargs.get("temperature", self.temperature),
                system=system or "You are a helpful bookstore assistant.",
                messages=chat,
            )
            latency = (time.perf_counter() - started) * 1000
            text = ""
            for block in resp.content:
                if getattr(block, "type", None) == "text":
                    text += block.text
            usage = resp.usage
            return LLMResponse(
                content=text,
                provider=self.name,
                model=resp.model or self.model,
                prompt_tokens=getattr(usage, "input_tokens", 0) or 0,
                completion_tokens=getattr(usage, "output_tokens", 0) or 0,
                total_tokens=(getattr(usage, "input_tokens", 0) or 0)
                + (getattr(usage, "output_tokens", 0) or 0),
                latency_ms=latency,
                raw=resp,
            )
        except Exception as exc:
            logger.exception("Claude complete failed: %s", exc)
            raise

    async def stream(self, messages: List[LLMMessage], **kwargs: Any) -> AsyncIterator[str]:
        client = self._get_client()
        system, chat = self._split(messages)
        async with client.messages.stream(
            model=kwargs.get("model", self.model),
            max_tokens=kwargs.get("max_tokens", self.max_tokens),
            temperature=kwargs.get("temperature", self.temperature),
            system=system or "You are a helpful bookstore assistant.",
            messages=chat,
        ) as stream:
            async for text in stream.text_stream:
                yield text
