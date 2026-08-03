"""WebSocket chat streaming."""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import async_session_factory
from app.schemas.chat import ChatContext, ChatRequest
from app.services.chat_service import ChatService
from app.utils.logging import logger

router = APIRouter()


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket protocol:
      Client -> {"message": "...", "session_id": optional, "customer_id": optional, "context": {...}, "stream": true}
      Server -> {"type":"chunk","delta":"..."} | {"type":"done","session_id":"..."} | {"type":"error","detail":"..."}
    """
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "Invalid JSON"})
                continue

            message = payload.get("message")
            if not message:
                await websocket.send_json({"type": "error", "detail": "message is required"})
                continue

            context = None
            if payload.get("context"):
                context = ChatContext(**payload["context"])

            req = ChatRequest(
                message=message,
                session_id=payload.get("session_id"),
                customer_id=payload.get("customer_id"),
                context=context,
                language=payload.get("language"),
                stream=bool(payload.get("stream", True)),
            )

            async with async_session_factory() as db:
                service = ChatService(db)
                try:
                    if req.stream:
                        async for chunk in service.stream_chat(req):
                            if chunk.get("done"):
                                await websocket.send_json({"type": "done", **chunk})
                            else:
                                await websocket.send_json({"type": "chunk", **chunk})
                    else:
                        result = await service.chat(req)
                        await websocket.send_json({"type": "message", **result.model_dump()})
                    await db.commit()
                except Exception as exc:
                    await db.rollback()
                    logger.exception("WS chat error: %s", exc)
                    await websocket.send_json({"type": "error", "detail": str(exc)})
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as exc:
        logger.exception("WebSocket failure: %s", exc)
        try:
            await websocket.close()
        except Exception:
            pass
