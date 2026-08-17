"""
BookNest AI Concierge — FastAPI application entrypoint.

Standalone AI bookstore employee API + optional demo chat UI.
Swagger UI: /docs  |  Chat UI: /ui/chat  |  ReDoc: /redoc
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app import __version__
from app.config import get_settings
from app.database import init_db
from app.routes import build_api_router
from app.schemas.common import HealthResponse
from app.utils.logging import logger

settings = get_settings()

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.log_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)
    logger.info("Starting %s v%s | provider=%s", settings.app_name, __version__, settings.ai_provider)
    await init_db()
    logger.info("Database ready")
    yield
    logger.info("Shutting down %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    description=(
        "Standalone AI Book Sales Concierge for BookNest. "
        "Provider-agnostic LLM integration, commerce APIs, voice/image support, "
        "streaming & WebSocket. Consume from any frontend."
    ),
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

_cors_origins = settings.cors_origin_list or ["*"]
# Wildcard CORS can't be combined with credentials; drop credentials when embedding
# the widget on arbitrary sites (CORS_ORIGINS=*).
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials="*" not in _cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error", "detail": str(exc)},
    )


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", tags=["System"])
async def root():
    """Redirect browser users to the chat UI."""
    chat_page = STATIC_DIR / "chat.html"
    if chat_page.exists():
        return RedirectResponse(url="/ui/chat", status_code=307)
    return {
        "app": settings.app_name,
        "version": __version__,
        "status": "running",
        "docs": "/docs",
        "health": "/health",
        "chat_ui": "/ui/chat",
    }


@app.get("/api/info", tags=["System"])
async def api_info():
    return {
        "app": settings.app_name,
        "version": __version__,
        "status": "running",
        "docs": "/docs",
        "health": "/health",
        "chat_ui": "/ui/chat",
        "api_prefix": settings.api_prefix,
        "how_to_chat": {
            "ui": "Mở /ui/chat để chat trên giao diện",
            "swagger": "Mở /docs → POST /chat → Try it out",
            "example_body": {
                "message": "Xin chào, gợi ý sách self-help",
                "language": "vi",
                "customer_id": 1,
            },
        },
    }


@app.get("/ui/chat", tags=["System"], include_in_schema=False)
async def chat_ui():
    chat_page = STATIC_DIR / "chat.html"
    if not chat_page.exists():
        return JSONResponse({"error": "chat UI missing"}, status_code=404)
    return FileResponse(chat_page)


@app.get("/chat", tags=["Chat"], include_in_schema=False)
async def chat_get_hint():
    """Browser GET /chat → redirect to UI (POST /chat still handled by API router)."""
    return RedirectResponse(url="/ui/chat", status_code=307)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health():
    db_kind = "sqlite"
    url = settings.resolved_database_url
    if "postgres" in url:
        db_kind = "postgresql"
    elif "mysql" in url:
        db_kind = "mysql"
    return HealthResponse(
        status="healthy",
        app=settings.app_name,
        version=__version__,
        ai_provider=settings.ai_provider,
        ai_model=settings.provider_model(),
        database=db_kind,
        redis=settings.redis_enabled,
    )


# Mount all business APIs under /api/v1 (and also root aliases for convenience)
api_router = build_api_router()
app.include_router(api_router, prefix=settings.api_prefix)

# Flat aliases matching the requested paths (POST /chat, etc.)
app.include_router(api_router)


def run() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_debug,
    )


if __name__ == "__main__":
    run()
