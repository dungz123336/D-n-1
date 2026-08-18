"""
LLM provider factory.

Change only:
    AI_PROVIDER=openai | gemini | claude | grok | deepseek | qwen | openrouter | ollama | mock
"""

from functools import lru_cache

from backend.config import get_settings
from backend.llm.base import BaseLLMProvider
from backend.llm.providers.claude import ClaudeProvider
from backend.llm.providers.gemini import GeminiProvider
from backend.llm.providers.mock import MockProvider
from backend.llm.providers.openai_compatible import OpenAICompatibleProvider
from backend.utils.logging import logger


def _require_key(provider: str, key: str) -> None:
    """No silent mock fallback: a real provider MUST have its API key.

    This makes the assistant answer only with the real key that was configured.
    To run offline (no key) you must explicitly set AI_PROVIDER=mock.
    """
    if not key:
        raise ValueError(
            f"AI_PROVIDER={provider} nhưng thiếu API key. "
            f"Thêm {provider.upper()}_API_KEY vào .env để dùng AI thật, "
            "hoặc đặt AI_PROVIDER=mock để chạy offline (không dùng API)."
        )


@lru_cache
def get_llm_provider() -> BaseLLMProvider:
    s = get_settings()
    provider = s.ai_provider
    model = s.provider_model()
    temp, max_tok, timeout = s.ai_temperature, s.ai_max_tokens, float(s.ai_timeout_seconds)
    logger.info("AI provider=%s model=%s", provider, model)

    if provider == "openai":
        _require_key("openai", s.openai_api_key)
        return OpenAICompatibleProvider(
            name="openai",
            api_key=s.openai_api_key,
            base_url=s.openai_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
            timeout=timeout,
        )

    if provider in ("grok", "xai"):
        _require_key("grok/xai", s.grok_key)
        return OpenAICompatibleProvider(
            name="grok",
            api_key=s.grok_key,
            base_url=s.grok_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
            timeout=timeout,
        )

    if provider == "deepseek":
        _require_key("deepseek", s.deepseek_api_key)
        return OpenAICompatibleProvider(
            name="deepseek",
            api_key=s.deepseek_api_key,
            base_url=s.deepseek_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
            timeout=timeout,
        )

    if provider == "qwen":
        _require_key("qwen", s.qwen_api_key)
        return OpenAICompatibleProvider(
            name="qwen",
            api_key=s.qwen_api_key,
            base_url=s.qwen_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
            timeout=timeout,
        )

    if provider == "openrouter":
        _require_key("openrouter", s.openrouter_api_key)
        return OpenAICompatibleProvider(
            name="openrouter",
            api_key=s.openrouter_api_key,
            base_url=s.openrouter_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
            timeout=timeout,
            default_headers={
                "HTTP-Referer": "https://booknest.local",
                "X-Title": "BookNest Concierge",
            },
        )

    if provider == "ollama":
        return OpenAICompatibleProvider(
            name="ollama",
            api_key="ollama",
            base_url=s.ollama_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
            timeout=timeout,
        )

    if provider in ("claude", "anthropic"):
        _require_key("claude", s.claude_api_key)
        return ClaudeProvider(
            api_key=s.claude_api_key,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
            timeout=timeout,
        )

    if provider in ("gemini", "google"):
        _require_key("gemini", s.gemini_api_key)
        return GeminiProvider(
            api_key=s.gemini_api_key,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
            timeout=timeout,
        )

    if provider == "mock":
        return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tok)

    raise ValueError(
        f"Unknown AI_PROVIDER={provider!r}. "
        "Use: openai, gemini, claude, grok, deepseek, qwen, openrouter, ollama, mock"
    )


def reset_provider_cache() -> None:
    get_llm_provider.cache_clear()
