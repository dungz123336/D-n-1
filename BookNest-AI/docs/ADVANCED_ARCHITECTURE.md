# BookNest Advanced AI Architecture

## Separation of concerns

| Project | Responsibility |
|---------|----------------|
| **BookNest-AI** | LLM, RAG, memory, prompts, providers, recommendation, roadmaps, analytics |
| **BookNest-Store** | Next.js UI, catalog UX, cart UI, pages — consumes AI via REST/SSE/WS |

**Do not merge** the two codebases. Integrate only over HTTP/WebSocket.

```
┌────────────────────┐     REST / SSE / WS      ┌──────────────────────┐
│  BookNest-Store    │ ───────────────────────► │  BookNest-AI         │
│  Next.js frontend  │ ◄─────────────────────── │  FastAPI + SQLite/PG │
│  (ChatWidget)      │     JSON + stream        │  multi-LLM + RAG     │
└────────────────────┘                          └──────────────────────┘
```

## Answer priority (RAG)

1. Website / DB catalog (books, price, stock)  
2. CMS entities (categories, vouchers, authors)  
3. Internal documentation / FAQ  
4. Generative LLM (with context injected)

## Feature modules (BookNest-AI)

| Module | Path |
|--------|------|
| Smart recommend | `backend/services/smart_recommend.py` |
| Compare | `backend/services/compare_engine.py` |
| Roadmap | `backend/services/roadmap_engine.py` |
| Summary / Quiz | `backend/services/content_engine.py` |
| Promotions / Loyalty | `backend/services/promotion_engine.py` |
| RAG | `backend/memory/rag.py` |
| Advanced routes | `backend/routes/advanced_api.py` |
| Multi-LLM | `backend/llm/factory.py` |

## Security roles

- **customer** — chat, cart, own orders  
- **staff** — limited ops (future)  
- **admin** — `/admin/*` via `X-API-Key` only; never expose in chat context  
