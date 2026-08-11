from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timezone, timedelta
from typing import List, Dict

from app.utils.dependencies import get_db, get_current_user, RoleChecker
from app.models.junction import Junction
from app.models.detection import Detection
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/heatmap")
async def get_heatmap_data(db: AsyncSession = Depends(get_db)):
    # Return lat, lng, and intensity based on recent detection counts
    junctions_res = await db.execute(select(Junction))
    junctions = junctions_res.scalars().all()
    
    heatmap_points = []
    
    for j in junctions:
        # In a real app we'd aggregate over a time window. 
        # Here we just count total detections as intensity proxy.
        det_count = await db.execute(select(Detection).where(Detection.junction_id == j.id))
        intensity = len(det_count.scalars().all())
        
        # Normalize slightly or cap
        normalized_intensity = min(intensity / 50.0, 1.0) # max out at 50 dets for visual sake
        
        heatmap_points.append({
            "id": j.id,
            "lat": j.latitude,
            "lng": j.longitude,
            "intensity": normalized_intensity
        })
        
    return {"data": heatmap_points}

@router.get("/predict")
async def get_predictions(junction_id: str, db: AsyncSession = Depends(get_db)):
    # A mocked simple moving average / prophet-like forecast
    # We generate 24 data points representing the next 24 hours of expected congestion.
    
    now = datetime.now(timezone.utc)
    predictions = []
    
    for i in range(24):
        future_time = now + timedelta(hours=i)
        hour = future_time.hour
        
        # Peak at 9 AM and 18 (6 PM)
        base_vol = 100
        if 8 <= hour <= 10:
            vol = base_vol + 200 + (hour - 9) * 10
        elif 17 <= hour <= 19:
            vol = base_vol + 250 + (hour - 18) * 15
        else:
            vol = base_vol + (hour % 5) * 10
            
        predictions.append({
            "timestamp": future_time.isoformat(),
            "predicted_volume": max(0, vol),
            "confidence_lower": max(0, vol - 30),
            "confidence_upper": vol + 30
        })
        
    return {"junction_id": junction_id, "forecast": predictions}
