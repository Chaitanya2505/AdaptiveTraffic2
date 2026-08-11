from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.utils.dependencies import get_db, get_current_user, RoleChecker
from app.models.junction import Junction
from app.models.detection import Detection
from app.models.signal import Signal
from app.models.violation import Violation
from app.models.user import User
from app.schemas.junction import JunctionCreate, JunctionResponse, JunctionStatusResponse, LaneQueueInfo

router = APIRouter(prefix="/junctions", tags=["Junctions"])

@router.get("", response_model=List[JunctionResponse])
async def list_junctions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Junction))
    return result.scalars().all()

@router.get("/{id}", response_model=JunctionResponse)
async def get_junction(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Junction).where(Junction.id == id))
    junction = result.scalar_one_or_none()
    if not junction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Junction not found")
    return junction

@router.post("", response_model=JunctionResponse, status_code=status.HTTP_201_CREATED)
async def create_junction(
    junction_in: JunctionCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["admin", "operator"]))
):
    result = await db.execute(select(Junction).where(Junction.id == junction_in.id))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Junction with ID {junction_in.id} already exists"
        )
    
    junction = Junction(**junction_in.model_dump())
    db.add(junction)
    await db.commit()
    await db.refresh(junction)
    return junction

@router.get("/{id}/status", response_model=JunctionStatusResponse)
async def get_junction_status(id: str, db: AsyncSession = Depends(get_db)):
    # 1. Fetch junction
    junction_result = await db.execute(select(Junction).where(Junction.id == id))
    junction = junction_result.scalar_one_or_none()
    if not junction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Junction not found")
        
    # 2. Get latest signal phase
    signal_result = await db.execute(
        select(Signal)
        .where(Signal.junction_id == id)
        .order_by(Signal.timestamp.desc())
        .limit(1)
    )
    latest_signal = signal_result.scalar_one_or_none()
    
    # 3. Get all detections in system
    det_result = await db.execute(
        select(Detection).where(Detection.junction_id == id)
    )
    all_dets = det_result.scalars().all()
    
    # 4. Count active violations
    viol_result = await db.execute(
        select(Violation).where(Violation.junction_id == id, Violation.status == "active")
    )
    active_violations = viol_result.scalars().all()
    
    # Calculate queue lengths per lane from recent detections
    lanes = [f"L{i}" for i in range(1, junction.num_lanes + 1)]
    lane_queues = []
    
    # Group detections by lane to estimate queue length
    recent_dets = all_dets[-20:] if len(all_dets) > 20 else all_dets
    for lane in lanes:
        lane_dets = [d for d in recent_dets if d.lane_id == lane]
        count = len(lane_dets)
        meters = count * 7.5
        avg_wait = count * 5.0
        lane_queues.append(
            LaneQueueInfo(
                lane_id=lane,
                vehicle_count=count,
                queue_meters=round(meters, 1),
                avg_wait_seconds=round(avg_wait, 1)
            )
        )
        
    return JunctionStatusResponse(
        junction_id=id,
        status=junction.status,
        current_signal_phase=latest_signal.phase if latest_signal else "ALL_RED",
        current_signal_duration=latest_signal.duration if latest_signal else 0,
        current_signal_mode=latest_signal.mode if latest_signal else "MANUAL",
        total_vehicles_detected=len(all_dets),
        lane_queues=lane_queues,
        recent_violations_count=len(active_violations)
    )
