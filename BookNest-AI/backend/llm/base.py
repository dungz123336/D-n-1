"""Provider-agnostic LLM interfaces (LangChain-friendly message shape)."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, List, Optional


@dataclass
class LLMMessage:
    """Chat message. role: system | user | assistant"""

    role: str
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
            "total_tokens": self.total_tokens or (self.prompt_tokens + self.completion_tokens),
        }


class BaseLLMProvider(ABC):
    """Abstract multi-provider contract."""

    name: str = "base"

    def __init__(self, model: str, temperature: float = 0.7, max_tokens: int = 2048):
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    @abstractmethod
    async def complete(self, messages: List[LLMMessage], **kwargs: Any) -> LLMResponse:
        ...

    @abstractmethod
    async def stream(self, messages: List[LLMMessage], **kwargs: Any) -> AsyncIterator[str]:
        if False:  # pragma: no cover
            yield ""

    def to_langchain_messages(self, messages: List[LLMMessage]) -> list:
        """Optional bridge to LangChain message objects when installed."""
        try:
            from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

            out = []
            for m in messages:
                if m.role == "system":
                    out.append(SystemMessage(content=m.content))
                elif m.role == "assistant":
                    out.append(AIMessage(content=m.content))
                else:
                    out.append(HumanMessage(content=m.content))
            return out
        except Exception:
            return [{"role": m.role, "content": m.content} for m in messages]
