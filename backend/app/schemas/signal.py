from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class SignalBase(BaseModel):
    junction_id: str = Field(..., max_length=50, examples=["J-001"])
    phase: str = Field(..., max_length=50, examples=["NS_GREEN"])
    duration: int = Field(..., ge=0, examples=[45])
    mode: str = Field(..., max_length=30, examples=["RL"])

class SignalCreate(SignalBase):
    pass

class SignalResponse(SignalBase):
    id: int
    timestamp: datetime

    model_config = {
        "from_attributes": True
    }

class SignalOptimizeRequest(BaseModel):
    junction_id: str = Field(..., examples=["J-001"])
    mode: str = Field(default="RL", examples=["RL", "WEBSTER"])

class SignalApplyRequest(BaseModel):
    phase: str = Field(..., examples=["NS_GREEN"])
    duration: int = Field(..., ge=5, le=180, examples=[60])
    mode: str = Field(default="MANUAL", examples=["MANUAL", "EVENT"])
