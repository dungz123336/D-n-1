"""Auth endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.common import APIResponse
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/auth/register", response_model=APIResponse[TokenResponse])
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        customer = await service.register(body.email, body.password, body.name, body.language)
        token = service.issue_token(customer)
        return APIResponse(message="Registered", data=TokenResponse(**token))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/auth/login", response_model=APIResponse[TokenResponse])
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        customer, _ = await service.login(body.email, body.password)
        token = service.issue_token(customer)
        return APIResponse(message="Logged in", data=TokenResponse(**token))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
