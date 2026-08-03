"""Chat, history, streaming, and chat-scoped media entrypoints."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.memory.chat_memory import ChatMemoryService
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.common import APIResponse
from app.services.chat_service import ChatService
from app.services.media_service import MediaService

router = APIRouter()


@router.post("/chat", response_model=APIResponse[ChatResponse])
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    service = ChatService(db)
    if body.stream:
        # Prefer dedicated stream endpoint; still allow flag
        pass
    result = await service.chat(body)
    return APIResponse(data=result)


@router.post("/chat/stream")
async def chat_stream(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    """SSE streaming for typing animation on any frontend."""
    service = ChatService(db)

    async def event_generator():
        async for chunk in service.stream_chat(body):
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/chat/image")
async def chat_image(
    file: UploadFile = File(...),
    customer_id: Optional[int] = Form(None),
    session_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Cover/barcode photo → matched book → concierge follow-up."""
    try:
        data = await MediaService(db).analyze_image(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    book = data.get("book")
    chat_result = None
    if book:
        chat_result = await ChatService(db).chat(
            ChatRequest(
                message=(
                    f"Mình vừa tải ảnh bìa, có phải cuốn {book.get('title')} không? "
                    "Hãy tư vấn cuốn này."
                ),
                customer_id=customer_id,
                session_id=session_id,
                language="vi",
            )
        )
    return APIResponse(
        message=data.get("message", "Đã nhận ảnh"),
        data={**data, "chat": chat_result.model_dump() if chat_result else None},
    )


class BarcodeChatBody(BaseModel):
    code: str
    customer_id: Optional[int] = None
    session_id: Optional[str] = None


@router.post("/chat/barcode")
async def chat_barcode(body: BarcodeChatBody, db: AsyncSession = Depends(get_db)):
    """ISBN / barcode lookup → concierge follow-up."""
    data = await MediaService(db).lookup_barcode(body.code, body.code)
    book = data.get("book")
    if not book:
        return APIResponse(
            success=False,
            message="Chưa tìm thấy sách với mã này",
            data={"found": False, "book": None, "chat": None},
        )
    chat_result = await ChatService(db).chat(
        ChatRequest(
            message=f"Mình quét mã ISBN {body.code}, tư vấn cuốn {book.get('title')} giúp mình",
            customer_id=body.customer_id,
            session_id=body.session_id,
            language="vi",
        )
    )
    return APIResponse(
        message="Đã tìm thấy sách",
        data={"found": True, "book": book, "chat": chat_result.model_dump()},
    )


@router.post("/chat/voice")
async def chat_voice(
    transcript: Optional[str] = Form(None),
    customer_id: Optional[int] = Form(None),
    session_id: Optional[str] = Form(None),
    language: str = Form("vi"),
    audio: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Browser STT transcript (or uploaded audio) → concierge answer."""
    try:
        stt = await MediaService(db).handle_voice(
            transcript=transcript, audio=audio, language=language
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    text = stt.get("transcript")
    chat_result = None
    if text:
        chat_result = await ChatService(db).chat(
            ChatRequest(
                message=text,
                customer_id=customer_id,
                session_id=session_id,
                language=language or "vi",
            )
        )
    return APIResponse(
        data={"stt": stt, "chat": chat_result.model_dump() if chat_result else None}
    )


@router.get("/history")
async def history(
    customer_id: Optional[int] = Query(None),
    session_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    mem = ChatMemoryService(db)
    if session_id:
        session = await mem.get_or_create_session(session_key=session_id)
        messages = await mem.recent_messages(session, limit=limit)
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
