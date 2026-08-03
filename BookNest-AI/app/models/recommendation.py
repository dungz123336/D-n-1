"""AI recommendation audit trail."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"), index=True)
    session_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    book_ids: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    criteria: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=dict)
    accepted: Mapped[Optional[bool]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
