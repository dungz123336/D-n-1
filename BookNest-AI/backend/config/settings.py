"""
Central configuration.

Switch the active LLM with a single env var:
    AI_PROVIDER=openai | gemini | claude | grok | deepseek | mock
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "BookNest Concierge"
    app_env: str = "development"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"
    log_level: str = "INFO"

    # Provider switch — only this is required to change models
    ai_provider: str = "gemini"
    ai_model: Optional[str] = None
    ai_temperature: float = 0.7
    ai_max_tokens: int = 2048
    ai_timeout_seconds: int = 90

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"

    claude_api_key: str = ""
    claude_model: str = "claude-sonnet-4-20250514"

    grok_api_key: str = ""
    xai_api_key: str = ""
    grok_base_url: str = "https://api.x.ai/v1"
    grok_model: str = "grok-4.5"

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    # Qwen (DashScope compatible OpenAI API) / OpenRouter / Ollama
    qwen_api_key: str = ""
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    qwen_model: str = "qwen-plus"

    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-4o-mini"

    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "llama3.2"

    database_url: str = "sqlite+aiosqlite:///./booknest_ai.db"
    database_echo: bool = False

    redis_url: str = "redis://localhost:6379/0"
    redis_enabled: bool = False

    secret_key: str = "dev-secret"
    jwt_secret: str = "dev-jwt"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    admin_api_key: str = "dev-admin-api-key"
    rate_limit: str = "120/minute"

    upload_dir: str = "./uploads"
    max_upload_mb: int = 10
    log_dir: str = "./logs"
    log_ai_prompts: bool = True

    @field_validator("ai_provider", mode="before")
    @classmethod
    def normalize_provider(cls, v: str) -> str:
        return (v or "gemini").strip().lower()

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def grok_key(self) -> str:
        return self.grok_api_key or self.xai_api_key

    def provider_model(self) -> str:
        if self.ai_model:
            return self.ai_model
        return {
            "openai": self.openai_model,
            "gemini": self.gemini_model,
            "claude": self.claude_model,
            "grok": self.grok_model,
            "deepseek": self.deepseek_model,
            "qwen": self.qwen_model,
            "openrouter": self.openrouter_model,
            "ollama": self.ollama_model,
            "mock": "mock-1",
        }.get(self.ai_provider, self.gemini_model)

    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
