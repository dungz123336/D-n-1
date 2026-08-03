"""AI usage and observability logs."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Float, Integer, String, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    session_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    endpoint: Mapped[Optional[str]] = mapped_column(String(100))
    provider: Mapped[str] = mapped_column(String(50), index=True)
    model: Mapped[str] = mapped_column(String(100))
    prompt: Mapped[Optional[str]] = mapped_column(Text)
    response: Mapped[Optional[str]] = mapped_column(Text)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    success: Mapped[bool] = mapped_column(default=True)
    error: Mapped[Optional[str]] = mapped_column(Text)
    meta: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
