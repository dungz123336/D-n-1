"""
AI provider factory.

Switch providers with a single env var:
    AI_PROVIDER=openai | claude | gemini | grok | deepseek | openrouter | ollama | local | mock
"""

from functools import lru_cache

from app.ai.base import BaseLLMProvider
from app.ai.providers.claude import ClaudeProvider
from app.ai.providers.gemini import GeminiProvider
from app.ai.providers.mock import MockProvider
from app.ai.providers.openai_compatible import OpenAICompatibleProvider
from app.config import get_settings
from app.utils.logging import logger


class ProviderConfigError(RuntimeError):
    pass


@lru_cache
def get_llm_provider() -> BaseLLMProvider:
    settings = get_settings()
    provider = settings.ai_provider
    model = settings.provider_model()
    temp = settings.ai_temperature
    max_tokens = settings.ai_max_tokens
    timeout = float(settings.ai_timeout_seconds)

    logger.info("Initializing AI provider=%s model=%s", provider, model)

    if provider in ("openai",):
        if not settings.openai_api_key:
            logger.warning("OPENAI_API_KEY missing; falling back to mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tokens)
        return OpenAICompatibleProvider(
            name="openai",
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tokens,
            timeout=timeout,
        )

    if provider in ("grok", "xai", "spacexai"):
        key = settings.resolved_grok_key
        if not key:
            logger.warning("GROK_API_KEY / XAI_API_KEY missing; falling back to mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tokens)
        return OpenAICompatibleProvider(
            name="grok",
            api_key=key,
            base_url=settings.grok_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tokens,
            timeout=timeout,
        )

    if provider == "deepseek":
        if not settings.deepseek_api_key:
            logger.warning("DEEPSEEK_API_KEY missing; falling back to mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tokens)
        return OpenAICompatibleProvider(
            name="deepseek",
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tokens,
            timeout=timeout,
        )

    if provider == "openrouter":
        if not settings.openrouter_api_key:
            logger.warning("OPENROUTER_API_KEY missing; falling back to mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tokens)
        return OpenAICompatibleProvider(
            name="openrouter",
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tokens,
            timeout=timeout,
            default_headers={
                "HTTP-Referer": "https://booknest.ai",
                "X-Title": "BookNest AI Concierge",
            },
        )

    if provider == "ollama":
        return OpenAICompatibleProvider(
            name="ollama",
            api_key="ollama",
            base_url=settings.ollama_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tokens,
            timeout=timeout,
        )

    if provider in ("local", "local_llm"):
        return OpenAICompatibleProvider(
            name="local",
            api_key=settings.local_llm_api_key,
            base_url=settings.local_llm_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tokens,
            timeout=timeout,
        )

    if provider in ("claude", "anthropic"):
        if not settings.claude_api_key:
            logger.warning("CLAUDE_API_KEY missing; falling back to mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tokens)
        return ClaudeProvider(
            api_key=settings.claude_api_key,
            model=model,
            temperature=temp,
            max_tokens=max_tokens,
            timeout=timeout,
        )

    if provider in ("gemini", "google"):
        if not settings.gemini_api_key:
            logger.warning("GEMINI_API_KEY missing; falling back to mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tokens)
        return GeminiProvider(
            api_key=settings.gemini_api_key,
            model=model,
            temperature=temp,
            max_tokens=max_tokens,
        )

    if provider == "mock":
        return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tokens)

    raise ProviderConfigError(
        f"Unknown AI_PROVIDER={provider!r}. "
        "Supported: openai, claude, gemini, grok, deepseek, openrouter, ollama, local, mock"
    )


def reset_provider_cache() -> None:
    """Clear cached provider (useful in tests after env changes)."""
    get_llm_provider.cache_clear()
