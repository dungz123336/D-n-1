"""
Chatbot-facing endpoints under /chat/* (and aliases for media).

Uses StoreService so every answer can reference live books/prices/stock.
"""

import json
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db
from backend.schemas.chat import ChatRequest, ChatResponse
from backend.schemas.common import APIResponse
from backend.services.chat_service import ChatService
from backend.services.store_service import StoreService
from backend.memory.conversation import ConversationMemory

router = APIRouter()
settings = get_settings()


@router.post("/chat", response_model=APIResponse[ChatResponse], tags=["Chatbot"])
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    # Ensure language defaults to Vietnamese
    if not body.language:
        body.language = "vi"
    result = await ChatService(db).chat(body)
    return APIResponse(data=result)


@router.post("/chat/stream", tags=["Chatbot"])
async def chat_stream(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    if not body.language:
        body.language = "vi"
    service = ChatService(db)

    async def events():
        async for chunk in service.stream_chat(body):
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


class HistoryBody(BaseModel):
    customer_id: Optional[int] = None
    session_id: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=200)


@router.post("/chat/history", tags=["Chatbot"])
async def chat_history(body: HistoryBody, db: AsyncSession = Depends(get_db)):
    mem = ConversationMemory(db)
    if body.session_id:
        session = await mem.get_or_create(session_key=body.session_id)
        messages = await mem.recent(session, limit=body.limit)
    elif body.customer_id:
        messages = await mem.history_for_customer(body.customer_id, limit=body.limit)
    else:
        raise HTTPException(400, "Cần customer_id hoặc session_id")
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


@router.post("/chat/image", tags=["Chatbot"])
async def chat_image(
    file: UploadFile = File(...),
    customer_id: Optional[int] = Form(None),
    session_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, "File quá lớn")
    path = upload_dir / f"{uuid4().hex}{Path(file.filename or 'img.bin').suffix}"
    path.write_bytes(content)

    store = StoreService(db)
    book = None
    stem = Path(file.filename or "").stem.replace("_", " ").replace("-", " ")
    if stem:
        found = await store.list_books(query=stem, page_size=1)
        if found["items"]:
            book = found["items"][0]

    chat_result = None
    if book:
        msg = f"Mình vừa tải ảnh bìa, có phải cuốn {book['title']} không? Hãy tư vấn cuốn này."
        chat_result = await ChatService(db).chat(
            ChatRequest(message=msg, customer_id=customer_id, session_id=session_id, language="vi")
        )
    return APIResponse(
        message="Đã nhận ảnh" + (" và khớp sách" if book else ""),
        data={"file": path.name, "book": book, "chat": chat_result.model_dump() if chat_result else None},
    )


class BarcodeChatBody(BaseModel):
    code: str
    customer_id: Optional[int] = None
    session_id: Optional[str] = None


@router.post("/chat/barcode", tags=["Chatbot", "Barcode Search"])
async def chat_barcode(body: BarcodeChatBody, db: AsyncSession = Depends(get_db)):
    store = StoreService(db)
    book = await store.find_by_barcode(body.code)
    if not book:
        return APIResponse(
            success=False,
            message="Chưa tìm thấy sách với mã này",
            data={"found": False, "book": None},
        )
    chat = await ChatService(db).chat(
        ChatRequest(
            message=f"Mình quét mã ISBN {body.code}, tư vấn cuốn {book['title']} giúp mình",
            customer_id=body.customer_id,
            session_id=body.session_id,
            language="vi",
        )
    )
    return APIResponse(
        message="Đã tìm thấy sách",
        data={"found": True, "book": book, "chat": chat.model_dump()},
    )


@router.post("/chat/voice", tags=["Chatbot", "Voice Search"])
async def chat_voice(
    transcript: Optional[str] = Form(None),
    customer_id: Optional[int] = Form(None),
    session_id: Optional[str] = Form(None),
    language: str = Form("vi"),
    audio: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    text = transcript
    if not text and audio:
        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        path = upload_dir / f"voice_{uuid4().hex}{Path(audio.filename or '.wav').suffix}"
        path.write_bytes(await audio.read())
        return APIResponse(
            message="Đã lưu audio. Hãy gửi transcript từ nhận diện giọng nói trên trình duyệt.",
            data={"file": path.name, "transcript": None},
        )
    if not text:
        raise HTTPException(400, "Cần transcript hoặc audio")

    # Also run store search for structured results
    search = await StoreService(db).list_books(query=text, page_size=5)
    chat = await ChatService(db).chat(
        ChatRequest(
            message=text,
            customer_id=customer_id,
            session_id=session_id,
            language=language or "vi",
        )
    )
    return APIResponse(
        data={
            "stt": {"transcript": text, "language": language},
            "search_results": search["items"],
            "chat": chat.model_dump(),
        }
    )
