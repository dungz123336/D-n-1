"""Provider-agnostic LLM interfaces."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, List, Optional


@dataclass
class LLMMessage:
    role: str  # system | user | assistant
    content: str


@dataclass
class LLMResponse:
    content: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    raw: Optional[Any] = None
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def usage(self) -> dict[str, int]:
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
        }


class BaseLLMProvider(ABC):
    """Abstract LLM provider. All concrete providers implement this contract."""

    name: str = "base"

    def __init__(self, model: str, temperature: float = 0.7, max_tokens: int = 2048):
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    @abstractmethod
    async def complete(self, messages: List[LLMMessage], **kwargs: Any) -> LLMResponse:
        """Non-streaming chat completion."""

    @abstractmethod
    async def stream(self, messages: List[LLMMessage], **kwargs: Any) -> AsyncIterator[str]:
        """Yield text deltas for streaming UIs / WebSocket."""
        # pragma: no cover
        if False:  # make this an async generator type
            yield ""

    async def health_check(self) -> bool:
        return True
