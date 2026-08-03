"""Centralized application settings (provider-agnostic, env-driven)."""

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "BookNest AI Concierge"
    app_env: str = "development"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    log_level: str = "INFO"

    # AI provider switch — only this needs to change to switch backends
    ai_provider: str = "grok"
    ai_model: Optional[str] = None
    ai_temperature: float = 0.7
    ai_max_tokens: int = 2048
    ai_timeout_seconds: int = 60

    # Provider keys / endpoints
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"

    claude_api_key: str = ""
    claude_model: str = "claude-sonnet-4-20250514"

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    grok_api_key: str = ""
    xai_api_key: str = ""  # alias for Grok/xAI
    grok_base_url: str = "https://api.x.ai/v1"
    grok_model: str = "grok-4.5"

    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-4o-mini"

    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "llama3.2"

    local_llm_base_url: str = "http://localhost:8080/v1"
    local_llm_model: str = "local-model"
    local_llm_api_key: str = "not-needed"

    # Database
    database_url: str = "sqlite+aiosqlite:///./booknest_ai.db"
    # The `app` and `backend` bots have divergent ORM models (app adds audit
    # timestamps, meta/JSON and satisfaction columns), so they cannot share one
    # schema. `app` keeps its own store; override with APP_DATABASE_URL.
    app_database_url: str = "sqlite+aiosqlite:///./booknest_app.db"
    database_echo: bool = False

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_enabled: bool = False

    # Security
    secret_key: str = "dev-secret-change-me"
    jwt_secret: str = "dev-jwt-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    api_key_header: str = "X-API-Key"
    admin_api_key: str = "dev-admin-api-key-change-me"
    rate_limit: str = "60/minute"

    # BookNest integration
    booknest_api_url: str = ""
    booknest_api_key: str = ""
    booknest_sync_enabled: bool = False

    # Vector / RAG
    vector_backend: str = "chroma"
    chroma_persist_dir: str = "./vector_db"
    qdrant_url: str = ""
    pinecone_api_key: str = ""
    pinecone_index: str = ""

    # Uploads
    upload_dir: str = "./uploads"
    max_upload_mb: int = 10

    # Logging
    log_dir: str = "./logs"
    log_ai_prompts: bool = True

    @field_validator("ai_provider", mode="before")
    @classmethod
    def normalize_provider(cls, v: str) -> str:
        if not v:
            return "grok"
        return str(v).strip().lower()

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def resolved_grok_key(self) -> str:
        return self.grok_api_key or self.xai_api_key

    def provider_model(self) -> str:
        """Return the model name for the active provider (override via AI_MODEL)."""
        if self.ai_model:
            return self.ai_model
        mapping = {
            "openai": self.openai_model,
            "claude": self.claude_model,
            "gemini": self.gemini_model,
            "grok": self.grok_model,
            "deepseek": self.deepseek_model,
            "openrouter": self.openrouter_model,
            "ollama": self.ollama_model,
            "local": self.local_llm_model,
        }
        return mapping.get(self.ai_provider, self.grok_model)

    @property
    def resolved_database_url(self) -> str:
        """DB this bot actually owns (falls back to DATABASE_URL if unset)."""
        return self.app_database_url or self.database_url

    def is_sqlite(self) -> bool:
        return self.resolved_database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
