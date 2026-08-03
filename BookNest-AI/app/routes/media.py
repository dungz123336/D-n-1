"""Barcode, image, and voice endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.catalog import BarcodeRequest, VoiceRequest
from app.schemas.chat import ChatRequest
from app.schemas.common import APIResponse
from app.services.chat_service import ChatService
from app.services.media_service import MediaService

router = APIRouter()


@router.post("/barcode")
async def barcode(body: BarcodeRequest, db: AsyncSession = Depends(get_db)):
    service = MediaService(db)
    data = await service.lookup_barcode(body.barcode, body.isbn)
    return APIResponse(message=data["message"], data=data)


@router.post("/image")
async def image_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    service = MediaService(db)
    try:
        data = await service.analyze_image(file)
        return APIResponse(message=data["message"], data=data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/voice")
async def voice(
    transcript: Optional[str] = Form(None),
    customer_id: Optional[int] = Form(None),
    session_id: Optional[str] = Form(None),
    language: str = Form("en"),
    run_chat: bool = Form(True),
    audio: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Voice support:
    - Send multipart audio and/or transcript.
    - Optionally forward recognized text into /chat.
    """
    media = MediaService(db)
    try:
        stt = await media.handle_voice(transcript=transcript, audio=audio, language=language)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    text = stt.get("transcript")
    chat_result = None
    if run_chat and text:
        chat = ChatService(db)
        chat_result = await chat.chat(
            ChatRequest(
                message=text,
                session_id=session_id,
                customer_id=customer_id,
                language=language,
            )
        )

    return APIResponse(
        data={
            "stt": stt,
            "chat": chat_result.model_dump() if chat_result else None,
        }
    )


@router.post("/voice/json")
async def voice_json(body: VoiceRequest, db: AsyncSession = Depends(get_db)):
    media = MediaService(db)
    stt = await media.handle_voice(transcript=body.transcript, language=body.language)
    chat_result = None
    if body.command and body.transcript:
        chat = ChatService(db)
        chat_result = await chat.chat(
            ChatRequest(
                message=body.transcript,
                session_id=body.session_id,
                customer_id=body.customer_id,
                language=body.language,
            )
        )
    return APIResponse(data={"stt": stt, "chat": chat_result.model_dump() if chat_result else None})
