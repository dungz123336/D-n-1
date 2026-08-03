"""Auth request/response schemas."""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=4)


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: Optional[str] = None
    language: str = "en"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    customer_id: int
    email: Optional[str] = None
