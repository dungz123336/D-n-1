from fastapi import APIRouter

from app.routes import admin, auth, catalog, chat, commerce, media, websocket


def build_api_router() -> APIRouter:
    router = APIRouter()
    router.include_router(auth.router, tags=["Auth"])
    router.include_router(chat.router, tags=["Chat"])
    router.include_router(catalog.router, tags=["Catalog"])
    router.include_router(commerce.router, tags=["Commerce"])
    router.include_router(media.router, tags=["Media"])
    router.include_router(admin.router, prefix="/admin", tags=["Admin"])
    router.include_router(websocket.router, tags=["WebSocket"])
    return router
