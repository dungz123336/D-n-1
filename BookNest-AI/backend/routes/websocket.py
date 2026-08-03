"""WebSocket streaming chat."""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.database.session import async_session_factory
from backend.schemas.chat import ChatContext, ChatRequest
from backend.services.chat_service import ChatService
from backend.utils.logging import logger

router = APIRouter()


@router.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket):
    """
    Client JSON:
      {"message":"...", "session_id":null, "customer_id":1, "stream":true, "context":{...}}
    Server:
      {"type":"chunk","delta":"..."} | {"type":"done",...} | {"type":"message",...}
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
                await websocket.send_json({"type": "error", "detail": "message required"})
                continue
            context = ChatContext(**payload["context"]) if payload.get("context") else None
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
                            typ = "done" if chunk.get("done") else "chunk"
                            await websocket.send_json({"type": typ, **chunk})
                    else:
                        result = await service.chat(req)
                        await websocket.send_json({"type": "message", **result.model_dump()})
                    await db.commit()
                except Exception as exc:
                    await db.rollback()
                    logger.exception("WS error: %s", exc)
                    await websocket.send_json({"type": "error", "detail": str(exc)})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
