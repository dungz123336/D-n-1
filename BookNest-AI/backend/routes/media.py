"""Barcode, image, voice endpoints."""

from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db
from backend.schemas.chat import ChatRequest
from backend.schemas.commerce import BarcodeRequest
from backend.schemas.common import APIResponse
from backend.services.chat_service import ChatService
from backend.tools.bookstore_tools import BookstoreTools

router = APIRouter()
settings = get_settings()


@router.post("/barcode")
async def barcode(body: BarcodeRequest, db: AsyncSession = Depends(get_db)):
    code = body.barcode or body.isbn
    if not code:
        raise HTTPException(400, "Cần mã vạch hoặc ISBN")
    book = await BookstoreTools(db).find_barcode(code)
    if not book:
        return APIResponse(message="Chưa tìm thấy sách với mã này", data={"found": False, "book": None})
    return APIResponse(message="Đã tìm thấy sách", data={"found": True, "book": book})


@router.post("/image")
async def image_upload(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Accept cover/barcode image; try ISBN-like filename or barcode fields later."""
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, "File too large")
    path = upload_dir / f"{uuid4().hex}{Path(file.filename or 'img.bin').suffix}"
    path.write_bytes(content)

    book = None
    stem = Path(file.filename or "").stem.replace("_", " ").replace("-", " ")
    if stem:
        books = await BookstoreTools(db).search_books(query=stem, limit=1)
        book = books[0] if books else None

    return APIResponse(
        message="Đã nhận ảnh" + (" và tìm thấy sách khớp" if book else ". Bạn thử gửi thêm ISBN nếu mình chưa nhận ra."),
        data={"file": path.name, "book": book},
    )


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
    Voice path: client STT transcript preferred.
    Optional audio file is stored; Whisper can be wired when OPENAI_API_KEY is set.
    """
    text = transcript
    stt_source = "client"
    if not text and audio:
        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        path = upload_dir / f"voice_{uuid4().hex}{Path(audio.filename or '.wav').suffix}"
        path.write_bytes(await audio.read())
        stt_source = "audio_saved"
        # Optional Whisper
        from backend.config import get_settings as gs

        if gs().openai_api_key:
            try:
                from openai import AsyncOpenAI

                client = AsyncOpenAI(api_key=gs().openai_api_key)
                with path.open("rb") as f:
                    tr = await client.audio.transcriptions.create(model="whisper-1", file=f)
                text = tr.text
                stt_source = "whisper"
            except Exception as exc:
                return APIResponse(
                    success=False,
                    message=f"STT failed: {exc}",
                    data={"file": path.name},
                )
        else:
            return APIResponse(
                message="Đã lưu file âm thanh. Hãy gửi transcript từ nhận diện giọng nói trên trình duyệt, hoặc cấu hình Whisper.",
                data={"file": path.name, "transcript": None},
            )

    if not text:
        raise HTTPException(400, "Cần transcript hoặc file âm thanh")

    chat_result = None
    if run_chat:
        chat_result = await ChatService(db).chat(
            ChatRequest(message=text, session_id=session_id, customer_id=customer_id, language=language)
        )

    return APIResponse(
        data={
            "stt": {"transcript": text, "source": stt_source, "language": language},
            "chat": chat_result.model_dump() if chat_result else None,
        }
    )
