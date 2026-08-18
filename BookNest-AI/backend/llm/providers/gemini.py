"""Google Gemini provider."""

import asyncio
import time
from typing import Any, AsyncIterator, List

from backend.llm.base import BaseLLMProvider, LLMMessage, LLMResponse
from backend.utils.logging import logger


class GeminiProvider(BaseLLMProvider):
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: float = 90.0,
    ):
        super().__init__(model=model, temperature=temperature, max_tokens=max_tokens)
        self.api_key = api_key
        self.timeout = timeout
        self._ready = False

    def _ensure(self):
        if not self._ready:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            self._genai = genai
            self._ready = True

    def _history(self, messages: List[LLMMessage]) -> tuple[str, list[dict]]:
        system = "\n\n".join(m.content for m in messages if m.role == "system")
        history = []
        for m in messages:
            if m.role == "system":
                continue
            history.append(
                {"role": "user" if m.role == "user" else "model", "parts": [m.content]}
            )
        return system, history

    async def complete(self, messages: List[LLMMessage], **kwargs: Any) -> LLMResponse:
        self._ensure()
        system, history = self._history(messages)
        started = time.perf_counter()

        def _run():
            model = self._genai.GenerativeModel(
                model_name=kwargs.get("model", self.model),
                system_instruction=system or None,
                generation_config={
                    "temperature": kwargs.get("temperature", self.temperature),
                    "max_output_tokens": kwargs.get("max_tokens", self.max_tokens),
                },
            )
            if not history:
                return model.generate_content("Hello")
            if len(history) == 1:
                return model.generate_content(history[0]["parts"][0])
            chat = model.start_chat(history=history[:-1])
            return chat.send_message(history[-1]["parts"][0])

        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(_run),
                timeout=self.timeout,
            )
            latency = (time.perf_counter() - started) * 1000
            text = getattr(resp, "text", None) or ""
            um = getattr(resp, "usage_metadata", None)
            pt = int(getattr(um, "prompt_token_count", 0) or 0)
            ct = int(getattr(um, "candidates_token_count", 0) or 0)
            return LLMResponse(
                content=text,
                provider=self.name,
                model=self.model,
                prompt_tokens=pt,
                completion_tokens=ct,
                total_tokens=pt + ct,
                latency_ms=latency,
                raw=resp,
            )
        except Exception as exc:
            logger.exception("Gemini failed: %s", exc)
            raise

    async def stream(self, messages: List[LLMMessage], **kwargs: Any) -> AsyncIterator[str]:
        resp = await self.complete(messages, **kwargs)
        step = 28
        for i in range(0, len(resp.content), step):
            yield resp.content[i : i + step]
            await asyncio.sleep(0.01)
