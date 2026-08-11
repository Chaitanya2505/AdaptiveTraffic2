from app.routers.junctions import router as junctions_router
from app.routers.vision import router as vision_router
from app.routers.signals import router as signals_router
from app.routers.violations import router as violations_router
from app.routers.auth import router as auth_router
from app.routers.simulation import router as simulation_router

__all__ = [
    "junctions_router",
    "vision_router",
    "signals_router",
    "violations_router",
    "auth_router",
    "simulation_router"
]
