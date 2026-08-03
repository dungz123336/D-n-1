"""
BookNest Concierge — FastAPI entrypoint.

Production-ready multi-provider AI bookstore assistant.
Swagger: /docs  |  Widget: /ui/chat  |  WebSocket: /ws/chat
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

from backend import __version__
from backend.config import get_settings
from backend.database import init_db
from backend.routes import build_api_router
from backend.schemas.common import HealthResponse
from backend.utils.logging import logger

settings = get_settings()
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])

# Project root: BookNest-AI/
ROOT = Path(__file__).resolve().parent.parent
WIDGET_DIR = ROOT / "frontend-widget"
STATIC_LEGACY = ROOT / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.log_dir).mkdir(parents=True, exist_ok=True)
    logger.info("Starting %s v%s | provider=%s", settings.app_name, __version__, settings.ai_provider)
    await init_db()
    logger.info("Database ready")
    yield
    logger.info("Shutdown %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    description=(
        "BookNest Concierge + **Store REST API** — kết nối website BookNest Store với AI realtime.\n\n"
        "Modules: Auth, Books, Categories, Authors, Publishers, Inventory, Users, Wishlist, "
        "Cart, Orders, Payments (COD/MoMo/VNPay/ZaloPay/Visa/Mastercard), Vouchers, Reviews, "
        "Search, Voice, Barcode, AI Recommendation, Chatbot.\n\n"
        "**Providers:** OpenAI · Gemini · Claude · Grok · DeepSeek (`AI_PROVIDER`).\n\n"
        "REST · SSE streaming · WebSocket · Markdown JSON."
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logger.exception("Unhandled %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error", "detail": str(exc)},
    )


# Static widgets
if WIDGET_DIR.exists():
    app.mount("/widget", StaticFiles(directory=str(WIDGET_DIR)), name="widget")
if STATIC_LEGACY.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_LEGACY)), name="static")


@app.get("/", tags=["System"])
async def root():
    chat = WIDGET_DIR / "index.html"
    if chat.exists():
        return RedirectResponse(url="/ui/chat", status_code=307)
    legacy = STATIC_LEGACY / "chat.html"
    if legacy.exists():
        return RedirectResponse(url="/ui/chat", status_code=307)
    return {
        "app": settings.app_name,
        "version": __version__,
        "docs": "/docs",
        "health": "/health",
        "chat_ui": "/ui/chat",
    }


@app.get("/ui/chat", tags=["System"], include_in_schema=False)
async def chat_ui():
    for path in (WIDGET_DIR / "index.html", STATIC_LEGACY / "chat.html"):
        if path.exists():
            return FileResponse(
                path,
                media_type="text/html; charset=utf-8",
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                },
            )
    return JSONResponse({"error": "widget missing"}, status_code=404)


@app.get("/chat", tags=["Chat"], include_in_schema=False)
async def chat_get_redirect():
    return RedirectResponse(url="/ui/chat", status_code=307)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health():
    db_kind = "sqlite"
    if "postgres" in settings.database_url:
        db_kind = "postgresql"
    elif "mysql" in settings.database_url:
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


@app.get("/api/info", tags=["System"])
async def api_info():
    return {
        "app": settings.app_name,
        "version": __version__,
        "ai_provider": settings.ai_provider,
        "ai_model": settings.provider_model(),
        "endpoints": {
            "chat": "POST /chat",
            "stream": "POST /chat/stream",
            "websocket": "WS /ws/chat",
            "recommend": "POST /recommend",
            "compare": "POST /compare",
            "docs": "/docs",
            "ui": "/ui/chat",
        },
    }


api_router = build_api_router()
app.include_router(api_router, prefix=settings.api_prefix)
app.include_router(api_router)


def run() -> None:
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_debug,
    )


if __name__ == "__main__":
    run()
