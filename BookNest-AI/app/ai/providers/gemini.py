"""Google Gemini provider."""

import asyncio
import time
from typing import Any, AsyncIterator, List

from app.ai.base import BaseLLMProvider, LLMMessage, LLMResponse
from app.utils.logging import logger


class GeminiProvider(BaseLLMProvider):
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ):
        super().__init__(model=model, temperature=temperature, max_tokens=max_tokens)
        self.api_key = api_key
        self._configured = False

    def _ensure(self):
        if not self._configured:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            self._genai = genai
            self._configured = True

    def _to_gemini(self, messages: List[LLMMessage]) -> tuple[str, list[dict]]:
        system = "\n\n".join(m.content for m in messages if m.role == "system")
        history = []
        for m in messages:
            if m.role == "system":
                continue
            role = "user" if m.role == "user" else "model"
            history.append({"role": role, "parts": [m.content]})
        return system, history

    async def complete(self, messages: List[LLMMessage], **kwargs: Any) -> LLMResponse:
        self._ensure()
        system, history = self._to_gemini(messages)
        started = time.perf_counter()

        def _run() -> Any:
            model = self._genai.GenerativeModel(
                model_name=kwargs.get("model", self.model),
                system_instruction=system or None,
                generation_config={
                    "temperature": kwargs.get("temperature", self.temperature),
                    "max_output_tokens": kwargs.get("max_tokens", self.max_tokens),
                },
            )
            # Last message is the prompt; prior messages as history
            if not history:
                return model.generate_content("Hello")
            if len(history) == 1:
                return model.generate_content(history[0]["parts"][0])
            chat = model.start_chat(history=history[:-1])
            return chat.send_message(history[-1]["parts"][0])

        try:
            resp = await asyncio.to_thread(_run)
            latency = (time.perf_counter() - started) * 1000
            text = getattr(resp, "text", None) or ""
            # Usage metadata when available
            um = getattr(resp, "usage_metadata", None)
            prompt_tokens = int(getattr(um, "prompt_token_count", 0) or 0)
            completion_tokens = int(getattr(um, "candidates_token_count", 0) or 0)
            return LLMResponse(
                content=text,
                provider=self.name,
                model=self.model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                latency_ms=latency,
                raw=resp,
            )
        except Exception as exc:
            logger.exception("Gemini complete failed: %s", exc)
            raise

    async def stream(self, messages: List[LLMMessage], **kwargs: Any) -> AsyncIterator[str]:
        # SDK streaming is sync; run complete and yield in chunks for compatibility
        resp = await self.complete(messages, **kwargs)
        text = resp.content
        step = 24
        for i in range(0, len(text), step):
            yield text[i : i + step]
            await asyncio.sleep(0.01)
