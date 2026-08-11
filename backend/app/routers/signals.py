from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.utils.dependencies import get_db, get_current_user, RoleChecker
from app.models.user import User
from app.models.signal import Signal
from app.models.junction import Junction
from app.schemas.signal import SignalResponse, SignalOptimizeRequest, SignalApplyRequest
from app.services.signal_service import SignalService

router = APIRouter(prefix="/signals", tags=["Signal Control"])

@router.post("/optimize", response_model=SignalResponse)
async def optimize_signal(
    request: SignalOptimizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        optimized = await SignalService.optimize(db, request.junction_id, request.mode)
        return optimized
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Optimization failed: {str(e)}")

@router.post("/{junction_id}/apply", response_model=SignalResponse)
async def apply_signal(
    junction_id: str,
    request: SignalApplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["admin", "operator"]))
):
    # Verify junction exists
    result = await db.execute(select(Junction).where(Junction.id == junction_id))
    junction = result.scalar_one_or_none()
    if not junction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Junction {junction_id} not found")

    applied_signal = Signal(
        junction_id=junction_id,
        phase=request.phase,
        duration=request.duration,
        mode=request.mode.upper()
    )
    db.add(applied_signal)
    await db.commit()
    await db.refresh(applied_signal)
    return applied_signal

@router.get("/{junction_id}/history", response_model=List[SignalResponse])
async def get_signal_history(
    junction_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify junction exists
    result = await db.execute(select(Junction).where(Junction.id == junction_id))
    junction = result.scalar_one_or_none()
    if not junction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Junction {junction_id} not found")

    history_result = await db.execute(
        select(Signal)
        .where(Signal.junction_id == junction_id)
        .order_by(Signal.timestamp.desc())
        .limit(limit)
    )
    return history_result.scalars().all()
