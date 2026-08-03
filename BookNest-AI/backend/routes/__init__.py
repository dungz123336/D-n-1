from fastapi import APIRouter

from backend.routes import (
    admin,
    advanced_api,
    catalog,
    chat,
    chatbot_api,
    commerce,
    media,
    store_api,
    websocket,
)


def build_api_router() -> APIRouter:
    """
    Aggregate all public APIs:
    - Store REST (books, cart, orders, payments, vouchers, …)
    - Chatbot (/chat, /chat/stream, …)
    - Advanced AI (smart recommend, roadmap, RAG, loyalty, …)
    - Legacy commerce/catalog/media for backward compatibility
    """
    router = APIRouter()

    # --- Primary Store + Chatbot + Advanced AI ---
    router.include_router(store_api.router)
    router.include_router(chatbot_api.router)
    router.include_router(advanced_api.router)

    # --- Legacy / complementary ---
    router.include_router(chat.router, tags=["Chat"])
    router.include_router(catalog.router, tags=["Catalog"])
    router.include_router(commerce.router, tags=["Commerce"])
    router.include_router(media.router, tags=["Media"])
    router.include_router(admin.router, prefix="/admin", tags=["Admin"])
    router.include_router(websocket.router, tags=["WebSocket"])
    return router
