from fastapi import APIRouter, Depends
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.utils.dependencies import get_db
from app.models.junction import Junction
from pydantic import BaseModel

router = APIRouter()

@router.get("/{brts_id}")
async def get_brts_details(brts_id: str, db: AsyncSession = Depends(get_db)):
    """Returns specific node details including camera configurations."""
    result = await db.execute(select(Junction).where(Junction.id == brts_id))
    node = result.scalar_one_or_none()
    
    if not node:
        return {"status": "error", "message": "Node not found."}
        
    return {
        "status": "ok",
        "node": {
            "id": node.id,
            "name": node.name,
            "type": node.node_type,
            "cameras": node.cameras,
            "status": node.status
        }
    }

class CameraUpdate(BaseModel):
    cameras: list

@router.put("/{brts_id}/cameras")
async def update_brts_cameras(brts_id: str, payload: CameraUpdate, db: AsyncSession = Depends(get_db)):
    """Updates the camera configuration for a node."""
    result = await db.execute(select(Junction).where(Junction.id == brts_id))
    node = result.scalar_one_or_none()
    
    if not node:
        return {"status": "error", "message": "Node not found"}
        
    node.cameras = payload.cameras
    await db.commit()
    
    return {"status": "ok", "node": {"id": node.id, "cameras": node.cameras}}

@router.get("/{brts_id}/violations")
async def get_brts_violations(brts_id: str):
    """Returns live and historical violations for a specific BRTS lane."""
    return {"status": "ok", "brtsId": brts_id, "violations": []}
