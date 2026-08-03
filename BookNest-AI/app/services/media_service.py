"""Image (cover/barcode/ISBN/QR) and voice helpers."""

import re
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services.catalog_service import CatalogService
from app.utils.logging import logger

ISBN_RE = re.compile(r"(?:ISBN(?:-1[03])?:?\s*)?(97[89][-\s]?\d{1,5}[-\s]?\d+[-\s]?\d+[-\s]?\d|[\dX]{10})", re.I)


class MediaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.catalog = CatalogService(db)
        self.settings = get_settings()

    async def save_upload(self, file: UploadFile) -> Path:
        upload_dir = Path(self.settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(file.filename or "upload.bin").suffix or ".bin"
        path = upload_dir / f"{uuid4().hex}{suffix}"
        content = await file.read()
        max_bytes = self.settings.max_upload_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise ValueError(f"File exceeds {self.settings.max_upload_mb}MB limit")
        path.write_bytes(content)
        return path

    def _extract_isbn_from_text(self, text: str) -> Optional[str]:
        m = ISBN_RE.search(text or "")
        if not m:
            return None
        return re.sub(r"[^0-9Xx]", "", m.group(1) if m.lastindex else m.group(0))

    def _decode_barcode(self, path: Path) -> Optional[str]:
        try:
            from PIL import Image
            from pyzbar.pyzbar import decode

            img = Image.open(path)
            codes = decode(img)
            if codes:
                return codes[0].data.decode("utf-8", errors="ignore")
        except Exception as exc:
            logger.warning("Barcode decode unavailable or failed: %s", exc)
        return None

    async def analyze_image(self, file: UploadFile) -> dict[str, Any]:
        path = await self.save_upload(file)
        barcode = self._decode_barcode(path)
        isbn = self._extract_isbn_from_text(barcode or "") or barcode

        book = None
        if barcode or isbn:
            book = await self.catalog.find_by_barcode_or_isbn(barcode=barcode, isbn=isbn)

        # Filename / OCR-less heuristic: try matching title-like filename
        if not book and file.filename:
            from app.schemas.catalog import BookSearchRequest

            stem = Path(file.filename).stem.replace("_", " ").replace("-", " ")
            books, _ = await self.catalog.search(BookSearchRequest(query=stem, page_size=3))
            if books:
                book = books[0]

        result: dict[str, Any] = {
            "file": path.name,
            "detected_barcode": barcode,
            "detected_isbn": isbn,
            "book": self.catalog.to_out(book).model_dump() if book else None,
            "message": (
                "Book matched from barcode/ISBN."
                if book
                else "Image stored. Could not match a catalog book — try /barcode with ISBN or improve lighting."
            ),
        }
        return result

    async def lookup_barcode(self, barcode: Optional[str], isbn: Optional[str]) -> dict[str, Any]:
        book = await self.catalog.find_by_barcode_or_isbn(barcode=barcode, isbn=isbn)
        if not book:
            return {"found": False, "message": "No book found for that barcode/ISBN", "book": None}
        return {
            "found": True,
            "message": "Book found",
            "book": self.catalog.to_out(book).model_dump(),
        }

    async def handle_voice(
        self,
        *,
        transcript: Optional[str] = None,
        audio: Optional[UploadFile] = None,
        language: str = "en",
    ) -> dict[str, Any]:
        """
        Speech-to-text path:
        - If transcript provided (client-side STT), use it.
        - If audio uploaded, attempt Whisper via OpenAI-compatible API when configured;
          otherwise return guidance for client STT.
        """
        if transcript:
            return {
                "transcript": transcript,
                "language": language,
                "source": "client",
                "command_hint": self._command_hint(transcript),
            }

        if audio:
            path = await self.save_upload(audio)
            # Optional: wire OpenAI Whisper when OPENAI_API_KEY present
            settings = self.settings
            if settings.openai_api_key:
                try:
                    from openai import AsyncOpenAI

                    client = AsyncOpenAI(api_key=settings.openai_api_key)
                    with path.open("rb") as f:
                        tr = await client.audio.transcriptions.create(model="whisper-1", file=f)
                    text = tr.text
                    return {
                        "transcript": text,
                        "language": language,
                        "source": "whisper",
                        "file": path.name,
                        "command_hint": self._command_hint(text),
                    }
                except Exception as exc:
                    logger.warning("Whisper STT failed: %s", exc)
                    return {
                        "transcript": None,
                        "error": str(exc),
                        "file": path.name,
                        "message": "STT failed; send transcript from client speech recognition.",
                    }
            return {
                "transcript": None,
                "file": path.name,
                "message": (
                    "Audio saved. Configure OPENAI_API_KEY for Whisper STT, "
                    "or send `transcript` from client-side speech recognition."
                ),
            }

        raise ValueError("Provide transcript or audio file")

    def _command_hint(self, text: str) -> dict[str, Any]:
        t = text.lower()
        if "search" in t or "find" in t or "tìm" in t:
            return {"intent": "search", "query": text}
        if "recommend" in t or "gợi ý" in t:
            return {"intent": "recommend"}
        if "cart" in t or "giỏ" in t:
            return {"intent": "cart"}
        if "track" in t or "order" in t:
            return {"intent": "track_order"}
        return {"intent": "chat", "message": text}
