from pydantic import BaseModel, Field
from typing import Optional, List

class JunctionBase(BaseModel):
    name: str = Field(..., max_length=100, examples=["Ring Road x BRTS"])
    latitude: float = Field(..., ge=-90, le=90, examples=[21.1702])
    longitude: float = Field(..., ge=-180, le=180, examples=[72.8311])
    num_lanes: int = Field(default=4, ge=1, le=12, examples=[4])
    has_brts: bool = Field(default=False, examples=[True])
    status: str = Field(default="active", max_length=20, examples=["active"])

class JunctionCreate(JunctionBase):
    id: str = Field(..., max_length=50, examples=["J-001"])

class JunctionUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    num_lanes: Optional[int] = Field(None, ge=1, le=12)
    has_brts: Optional[bool] = None
    status: Optional[str] = Field(None, max_length=20)

class JunctionResponse(JunctionBase):
    id: str

    model_config = {
        "from_attributes": True
    }

class LaneQueueInfo(BaseModel):
    lane_id: str
    vehicle_count: int
    queue_meters: float
    avg_wait_seconds: float

class JunctionStatusResponse(BaseModel):
    junction_id: str
    status: str
    current_signal_phase: Optional[str] = None
    current_signal_duration: Optional[int] = None
    current_signal_mode: Optional[str] = None
    total_vehicles_detected: int
    lane_queues: List[LaneQueueInfo]
    recent_violations_count: int

    model_config = {
        "from_attributes": True
    }
