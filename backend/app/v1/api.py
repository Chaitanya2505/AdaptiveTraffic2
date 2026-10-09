from fastapi import APIRouter
from .routers import map, junctions, brts, analytics, alerts

api_router = APIRouter()

api_router.include_router(map.router, prefix="/map", tags=["map"])
api_router.include_router(junctions.router, prefix="/junctions", tags=["junctions"])
api_router.include_router(brts.router, prefix="/brts", tags=["brts"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(alerts.router)
