"""Chat, streaming, history."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.memory.conversation import ConversationMemory
from backend.schemas.chat import ChatRequest, ChatResponse
from backend.schemas.common import APIResponse
from backend.services.chat_service import ChatService

router = APIRouter()


@router.post("/chat", response_model=APIResponse[ChatResponse])
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Main concierge endpoint. Returns markdown message + optional book cards."""
    result = await ChatService(db).chat(body)
    return APIResponse(data=result)


@router.post("/chat/stream")
async def chat_stream(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    """SSE streaming for typing animation."""
    service = ChatService(db)

    async def events():
        async for chunk in service.stream_chat(body):
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@router.get("/history")
async def history(
    customer_id: Optional[int] = Query(None),
    session_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    mem = ConversationMemory(db)
    if session_id:
        session = await mem.get_or_create(session_key=session_id)
        messages = await mem.recent(session, limit=limit)
    elif customer_id:
        messages = await mem.history_for_customer(customer_id, limit=limit)
    else:
        return APIResponse(success=False, message="Provide customer_id or session_id", data=[])
    data = [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "intent": m.intent,
            "provider": m.provider,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]
    return APIResponse(data=data)
