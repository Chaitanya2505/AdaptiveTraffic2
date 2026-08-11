from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional

from app.utils.dependencies import get_db, get_current_user, RoleChecker
from app.models.user import User
from app.models.violation import Violation
from app.schemas.violation import ViolationResponse

router = APIRouter(prefix="/violations", tags=["Violations"])

@router.get("", response_model=List[ViolationResponse])
async def list_violations(
    junction_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Violation)
    if junction_id:
        query = query.where(Violation.junction_id == junction_id)
    if status:
        query = query.where(Violation.status == status)
        
    query = query.order_by(Violation.timestamp.desc())
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{id}", response_model=ViolationResponse)
async def get_violation(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Violation).where(Violation.id == id))
    violation = result.scalar_one_or_none()
    if not violation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Violation not found")
    return violation

@router.post("/{id}/ack", response_model=ViolationResponse)
async def acknowledge_violation(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["admin", "operator"]))
):
    result = await db.execute(select(Violation).where(Violation.id == id))
    violation = result.scalar_one_or_none()
    if not violation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Violation not found")
        
    violation.status = "acknowledged"
    await db.commit()
    await db.refresh(violation)
    return violation
