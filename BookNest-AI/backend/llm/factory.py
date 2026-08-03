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


@lru_cache
def get_llm_provider() -> BaseLLMProvider:
    s = get_settings()
    provider = s.ai_provider
    model = s.provider_model()
    temp, max_tok, timeout = s.ai_temperature, s.ai_max_tokens, float(s.ai_timeout_seconds)
    logger.info("AI provider=%s model=%s", provider, model)

    if provider == "openai":
        if not s.openai_api_key:
            logger.warning("OPENAI_API_KEY missing → mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tok)
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
        key = s.grok_key
        if not key:
            logger.warning("GROK/XAI key missing → mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tok)
        return OpenAICompatibleProvider(
            name="grok",
            api_key=key,
            base_url=s.grok_base_url,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
            timeout=timeout,
        )

    if provider == "deepseek":
        if not s.deepseek_api_key:
            logger.warning("DEEPSEEK_API_KEY missing → mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tok)
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
        if not s.qwen_api_key:
            logger.warning("QWEN_API_KEY missing → mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tok)
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
        if not s.openrouter_api_key:
            logger.warning("OPENROUTER_API_KEY missing → mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tok)
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
        if not s.claude_api_key:
            logger.warning("CLAUDE_API_KEY missing → mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tok)
        return ClaudeProvider(
            api_key=s.claude_api_key,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
            timeout=timeout,
        )

    if provider in ("gemini", "google"):
        if not s.gemini_api_key:
            logger.warning("GEMINI_API_KEY missing → mock")
            return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tok)
        return GeminiProvider(
            api_key=s.gemini_api_key,
            model=model,
            temperature=temp,
            max_tokens=max_tok,
        )

    if provider == "mock":
        return MockProvider(model="mock-1", temperature=temp, max_tokens=max_tok)

    raise ValueError(
        f"Unknown AI_PROVIDER={provider!r}. "
        "Use: openai, gemini, claude, grok, deepseek, qwen, openrouter, ollama, mock"
    )


def reset_provider_cache() -> None:
    get_llm_provider.cache_clear()
