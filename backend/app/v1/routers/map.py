from fastapi import APIRouter, Depends
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.utils.dependencies import get_db
from app.models.junction import Junction
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class CameraConfig(BaseModel):
    id: int
    name: str
    url: str

class NodeCreate(BaseModel):
    id: str
    name: str
    type: str
    lat: float
    lng: float
    cameras: List[CameraConfig]

@router.get("/nodes")
async def get_all_nodes(db: AsyncSession = Depends(get_db)):
    """Returns geospatial data and high-level status for all deployed v1 nodes."""
    result = await db.execute(select(Junction))
    db_nodes = result.scalars().all()
    
    nodes = []
    for node in db_nodes:
        nodes.append({
            "id": node.id,
            "name": node.name,
            "type": "brts" if getattr(node, "has_brts", False) else "junction",
            "lat": node.latitude,
            "lng": node.longitude,
            "cameras": node.cameras,
            "status": node.status,
            "liveStatus": {
                "congestion": "critical" if node.id == "J-001" else "low",
                "activeViolations": 0
            }
        })
            
    return {"status": "ok", "nodes": nodes}

@router.post("/nodes")
async def create_node(node: NodeCreate, db: AsyncSession = Depends(get_db)):
    """Creates a new monitoring node in the DB."""
    new_node = Junction(
        id=node.id,
        name=node.name,
        has_brts=(node.type == "brts"),
        latitude=node.lat,
        longitude=node.lng,
        cameras=[c.dict() for c in node.cameras],
        status="active"
    )
    await db.merge(new_node)
    await db.commit()
    return {"status": "ok", "message": f"{node.type} node created successfully!"}
