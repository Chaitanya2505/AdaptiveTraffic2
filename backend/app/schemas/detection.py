from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class DetectionBase(BaseModel):
    junction_id: str = Field(..., max_length=50, examples=["J-001"])
    vehicle_class: str = Field(..., max_length=30, examples=["car"])
    confidence: float = Field(..., ge=0.0, le=1.0, examples=[0.95])
    bbox: List[float] = Field(..., min_length=4, max_length=4, examples=[[100.5, 200.2, 300.1, 400.8]])
    lane_id: str = Field(..., max_length=10, examples=["L1"])

class DetectionCreate(DetectionBase):
    pass

class DetectionResponse(DetectionBase):
    id: int
    timestamp: datetime

    model_config = {
        "from_attributes": True
    }

class VisionDetectResponse(BaseModel):
    junction_id: str
    timestamp: datetime
    detections: List[DetectionResponse]
    queue_lengths: dict  # e.g., {"L1": {"vehicles": 3, "meters": 15}, ...}
    violations_detected: int
    inference_time_ms: Optional[float] = None
