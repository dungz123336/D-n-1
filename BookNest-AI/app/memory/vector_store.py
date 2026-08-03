"""
Future-ready vector store abstraction (RAG).

Backends can be swapped via VECTOR_BACKEND without changing chat services:
  chroma | qdrant | pinecone | none

Current implementation is a lightweight in-process stub so the architecture
is ready for LangChain / LlamaIndex / Pinecone / Qdrant / ChromaDB.
"""

from abc import ABC, abstractmethod
from typing import Any, List, Optional

from app.config import get_settings
from app.utils.logging import logger


class VectorDocument:
    def __init__(self, id: str, text: str, metadata: Optional[dict[str, Any]] = None):
        self.id = id
        self.text = text
        self.metadata = metadata or {}


class BaseVectorStore(ABC):
    @abstractmethod
    async def upsert(self, documents: List[VectorDocument]) -> None: ...

    @abstractmethod
    async def similarity_search(self, query: str, k: int = 5) -> List[VectorDocument]: ...


class NoopVectorStore(BaseVectorStore):
    async def upsert(self, documents: List[VectorDocument]) -> None:
        return None

    async def similarity_search(self, query: str, k: int = 5) -> List[VectorDocument]:
        return []


class InMemoryVectorStore(BaseVectorStore):
    """Simple keyword-overlap retriever for local demo / until embeddings wired."""

    def __init__(self) -> None:
        self._docs: List[VectorDocument] = []

    async def upsert(self, documents: List[VectorDocument]) -> None:
        ids = {d.id for d in documents}
        self._docs = [d for d in self._docs if d.id not in ids] + documents

    async def similarity_search(self, query: str, k: int = 5) -> List[VectorDocument]:
        q = set(query.lower().split())
        scored = []
        for d in self._docs:
            tokens = set(d.text.lower().split())
            score = len(q & tokens)
            if score:
                scored.append((score, d))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [d for _, d in scored[:k]]


_store: Optional[BaseVectorStore] = None


def get_vector_store() -> BaseVectorStore:
    global _store
    if _store is not None:
        return _store
    settings = get_settings()
    backend = (settings.vector_backend or "none").lower()
    if backend in ("none", ""):
        _store = NoopVectorStore()
    elif backend in ("chroma", "qdrant", "pinecone", "memory"):
        # Pluggable: wire real clients here without changing call sites
        logger.info("Vector backend '%s' using in-memory stub (wire real client later)", backend)
        _store = InMemoryVectorStore()
    else:
        _store = NoopVectorStore()
    return _store
