from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "ok"
    data: Optional[T] = None


class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    total: int = 0
    page: int = 1
    page_size: int = 20
    items: List[T] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str = "healthy"
    app: str
    version: str
    ai_provider: str
    ai_model: str
    database: str
    redis: bool = False
