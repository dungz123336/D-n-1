"""Chat history (GET /history).

The main chat endpoints (POST /chat, /chat/stream, /chat/image, /chat/barcode,
/chat/voice, /chat/history) live in `backend/routes/chatbot_api.py`. This router
only keeps the legacy GET /history look-up so teammates never see ambiguous
duplicate routes for the same path.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.memory.conversation import ConversationMemory
from backend.schemas.common import APIResponse

router = APIRouter()


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
