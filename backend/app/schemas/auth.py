from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, examples=["traffic_op"])
    email: EmailStr = Field(..., examples=["operator@surat.gov.in"])
    password: str = Field(..., min_length=6, max_length=100, examples=["password123"])
    role: Optional[str] = Field(default="operator", examples=["operator", "admin", "analyst"])

class UserLogin(BaseModel):
    username: str = Field(..., examples=["traffic_op"])
    password: str = Field(..., examples=["password123"])

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str

    model_config = {
        "from_attributes": True
    }

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
