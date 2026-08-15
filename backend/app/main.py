from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select

from app.config import settings
from app.database import init_db, AsyncSessionLocal, engine
from app.models.user import User
from app.models.junction import Junction
from app.services.auth_service import AuthService
from app.routers import (
    junctions_router,
    vision_router,
    signals_router,
    violations_router,
    auth_router,
    simulation_router,
    brts_router
)
from app.routers.analytics import router as analytics_router

async def seed_data():
    async with AsyncSessionLocal() as db:
        # Seed initial user accounts if none exist
        user_check = await db.execute(select(User).limit(1))
        if not user_check.scalar_one_or_none():
            admin_user = User(
                username="admin",
                email="admin@erakshak.gov.in",
                password_hash=AuthService.hash_password("adminpassword"),
                role="admin"
            )
            operator_user = User(
                username="operator",
                email="operator@erakshak.gov.in",
                password_hash=AuthService.hash_password("operatorpassword"),
                role="operator"
            )
            db.add_all([admin_user, operator_user])
            
        # Seed initial junctions if none exist
        junction_check = await db.execute(select(Junction).limit(1))
        if not junction_check.scalar_one_or_none():
            surat_junctions = [
                Junction(id="J-001", name="SVNIT Junction", latitude=21.167790, longitude=72.785022, num_lanes=4, has_brts=True, status="active"),
                Junction(id="J-002", name="7 University Road", latitude=21.151035, longitude=72.772901, num_lanes=4, has_brts=False, status="active"),
                Junction(id="J-003", name="80 Feet Road Junction", latitude=21.151035, longitude=72.772901, num_lanes=4, has_brts=False, status="active"),
                Junction(id="J-004", name="Unapani Road Junction", latitude=21.151035, longitude=72.772901, num_lanes=4, has_brts=True, status="active"),
                Junction(id="J-005", name="Ghod Dod Road", latitude=21.151035, longitude=72.772901, num_lanes=4, has_brts=False, status="active"),
                Junction(id="J-006", name="705 Udhana - Magdalla Rd", latitude=21.150858, longitude=72.772651, num_lanes=6, has_brts=True, status="active"),
                Junction(id="J-007", name="Amroli Cross Rd", latitude=21.238064, longitude=72.848312, num_lanes=4, has_brts=True, status="active"),
                Junction(id="J-008", name="Vesu Canal Rd", latitude=21.169641, longitude=72.811659, num_lanes=4, has_brts=True, status="active"),
            ]
            db.add_all(surat_junctions)
            
        await db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup phase: Create schemas and seed initial state
    await init_db()
    await seed_data()
    
    # Initialize and start SUMO simulation
    from app.services.sumo_service import sumo_service
    await sumo_service.start()
    
    yield
    
    # Shutdown phase: Safely release database connections and stop SUMO simulation
    from app.services.sumo_service import sumo_service
    await sumo_service.stop()
    await engine.dispose()

app = FastAPI(
    title="E-Rakshak Traffic Management API",
    description="Backend API for E-Rakshak intelligent traffic optimization and violations monitoring.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth_router)
app.include_router(junctions_router)
app.include_router(vision_router)
app.include_router(signals_router)
app.include_router(violations_router)
app.include_router(simulation_router)
app.include_router(analytics_router)
app.include_router(brts_router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "system": "E-Rakshak Traffic Management Backend",
        "version": "1.0.0",
        "documentation_url": "/docs"
    }
