# BookNest Concierge

Production-ready **AI Book Consultant**, **Sales Assistant**, and **Customer Service** API for the BookNest bookstore.

Not a generic chatbot — a multi-role bookstore employee with multi-provider LLM support, conversation memory, commerce tools, streaming, and a premium widget UI.

---

## Features

| Role | Capabilities |
|------|----------------|
| Book Consultant | Discovery questions → personalized recommendations |
| Sales Expert | Upsell, cross-sell, bundles |
| Customer Support | FAQ, refunds, exchanges |
| Reading Coach | Roadmaps, difficulty, series order |
| Order Assistant | Cart, checkout, tracking |
| Voucher Assistant | Validate & apply store coupons |

**Also:** barcode lookup, voice (STT), image upload, wishlist-aware context, Redis optional cache.

---

## Multi AI Provider

Switch with **one env var** — no code changes:

```env
AI_PROVIDER=gemini   # openai | gemini | claude | grok | deepseek | mock
```

| Provider | Env key | Default model |
|----------|---------|----------------|
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Gemini | `GEMINI_API_KEY` | `gemini-flash-latest` |
| Claude | `CLAUDE_API_KEY` | `claude-sonnet-4-…` |
| Grok / xAI | `GROK_API_KEY` or `XAI_API_KEY` | `grok-4.5` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| Mock | — | offline demo |

---

## Project structure

```
BookNest-AI/
├── backend/
│   ├── api/           # Shared API helpers
│   ├── config/        # Settings (.env)
│   ├── database/      # Engine, seed
│   ├── llm/           # Provider abstraction + factory
│   │   └── providers/ # OpenAI-compatible, Claude, Gemini, Mock
│   ├── memory/        # Conversation + customer memory + Redis
│   ├── models/        # SQLAlchemy entities
│   ├── prompts/       # Concierge system prompts
│   ├── routes/        # FastAPI routers
│   ├── schemas/       # Pydantic DTOs
│   ├── services/      # Chat & recommend orchestration
│   ├── tools/         # Bookstore domain tools
│   ├── utils/
│   └── main.py        # App entrypoint
├── frontend-widget/   # Premium chat UI (index.html)
├── uploads/ logs/
├── requirements.txt
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

---

## Quick start

```bash
cd BookNest-AI
python -m venv .venv

# Windows
.venv\Scripts\activate
# Unix
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # then set AI_PROVIDER + keys

# IMPORTANT: run from project root so `backend` package resolves
set PYTHONPATH=%CD%          # Windows
# export PYTHONPATH=$PWD     # Unix

uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Or double-click **`start.bat`** on Windows.

| URL | Description |
|-----|-------------|
| http://127.0.0.1:8000/ui/chat | Premium widget UI |
| http://127.0.0.1:8000/docs | Swagger / OpenAPI |
| http://127.0.0.1:8000/health | Health check |
| http://127.0.0.1:8000/redoc | ReDoc |

Demo user: `demo@booknest.ai` / `demo1234`  
Demo vouchers: `WELCOME10`, `BOOKNEST15`, `READMORE20`

---

## Two bots, one website

This repo ships **two** independent bot apps. Both speak the same chat contract
(`/chat`, `/chat/stream`, `/chat/image`, `/chat/barcode`, `/chat/voice`, `/health`,
`/books/{id}`) and both consume the website's live `context` payload, so the
`booknest-store` frontend works against either one.

| Bot | Entrypoint | Database | Notes |
|-----|------------|----------|-------|
| `backend` | `backend.main:app` | `DATABASE_URL` → `booknest_ai.db` | Primary. Full store REST API + advanced engines (roadmap, compare, RAG, promotions). |
| `app` | `app.main:app` | `APP_DATABASE_URL` → `booknest_app.db` | Leaner concierge: chat, catalog, commerce, media, admin. |

They have divergent ORM models, so **each owns its own database** — don't point
both at the same schema.

```bash
set PYTHONPATH=%CD%

# Bot 1 — primary, on :8000
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Bot 2 — on :8001 (run either, or both side by side)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Point the website at whichever bot you want in `booknest-store/.env.local`:

```env
NEXT_PUBLIC_BOOKNEST_AI_URL=http://127.0.0.1:8000   # or :8001 for the `app` bot
```

Then run the store: `cd booknest-store && npm run dev` → http://localhost:3000

### How the bot sees website data

The widget sends a `context` object on every message, and the bot treats it as the
**source of truth** for stock and price (the AI's own DB is only a fallback):

| Field | Meaning |
|-------|---------|
| `website_inventory` | Full catalog snapshot: id, title, author, price, `sale_price`, `stock`, rating, tags |
| `current_book` / `current_book_id` | Book on the page being viewed |
| `cart`, `wishlist`, `wishlist_books` | Live cart lines and saved books |
| `viewed_books`, `viewed_book_details`, `search_history` | Browsing memory |
| `orders`, `coupons`, `membership` | Order history, applicable vouchers, tier |
| `current_page`, `current_category` | Drives the assistant's page role |

Rule enforced in the system prompt: `stock > 0` ⇒ in stock (state the count);
only `stock == 0` may be reported as sold out. Prices come from `sale_price`,
falling back to `price`.

---

## REST API (also under `/api/v1/...`)

### Chat
| Method | Path | Notes |
|--------|------|--------|
| POST | `/chat` | Main concierge (Markdown JSON) |
| POST | `/chat/stream` | SSE streaming |
| GET | `/history` | `customer_id` or `session_id` |
| WS | `/ws/chat` | WebSocket stream |

### Commerce & consultant
| Method | Path |
|--------|------|
| POST | `/recommend` |
| POST | `/compare` |
| POST | `/add-cart` |
| POST | `/remove-cart` |
| POST | `/apply-voucher` |
| POST | `/checkout` |
| POST | `/track-order` |
| POST | `/refund` |
| POST | `/exchange` |

### Catalog & media
| Method | Path |
|--------|------|
| GET | `/books` |
| POST | `/book-search` |
| GET | `/authors` |
| GET | `/customer` |
| POST | `/barcode` |
| POST | `/image` |
| POST | `/voice` |

### Admin (`X-API-Key`)
| Method | Path |
|--------|------|
| GET | `/admin/dashboard` |
| GET | `/admin/ai-usage` |

### Example chat

```bash
curl -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"I want a gift book under 20 dollars\",\"customer_id\":1,\"language\":\"en\"}"
```

### WebSocket

```js
const ws = new WebSocket("ws://127.0.0.1:8000/ws/chat");
ws.onopen = () => ws.send(JSON.stringify({
  message: "Recommend sci-fi under $15",
  customer_id: 1,
  stream: true
}));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

## Memory

Persisted per customer:

- name, favorite genres/authors, budget, reading level, language  
- viewed books, search history, cart, wishlist (via context + DB)  
- full chat history (sessions + messages)

Optional **Redis** (`REDIS_ENABLED=true`) for cache/session acceleration.

---

## Database

```env
# Development
DATABASE_URL=sqlite+aiosqlite:///./booknest_ai.db

# Production
DATABASE_URL=postgresql+asyncpg://booknest:booknest@db:5432/booknest_ai
```

---

## Docker

```bash
docker compose up --build
```

Services: API `:8000`, PostgreSQL `:5432`, Redis `:6379`.

---

## Architecture notes

- **Clean architecture:** routes → services → tools / memory / llm  
- **Provider-agnostic:** `backend/llm/factory.py`  
- **LangChain-ready:** `LLMMessage.to_langchain_messages()` bridge on base provider  
- **Frontend-agnostic:** JSON APIs + optional `frontend-widget`  
- **BookNest store integration:** call these APIs from Next.js / Flutter / mobile  

---

## Recommendation policy

`/recommend` and discovery chats **never recommend immediately**. Required:

1. Purpose  
2. Budget  
3. Reading level  
4. Favorite author  
5. Language  
6. Format  

---

## License

Proprietary — BookNest internal.
