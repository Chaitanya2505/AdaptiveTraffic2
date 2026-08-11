from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ViolationBase(BaseModel):
    junction_id: str = Field(..., max_length=50, examples=["J-001"])
    vehicle_class: str = Field(..., max_length=30, examples=["car"])
    license_plate: str = Field(..., max_length=30, examples=["GJ-05-AB-1234"])
    status: str = Field(default="active", max_length=20, examples=["active"])

class ViolationCreate(ViolationBase):
    pass

class ViolationResponse(ViolationBase):
    id: int
    timestamp: datetime

    model_config = {
        "from_attributes": True
    }
