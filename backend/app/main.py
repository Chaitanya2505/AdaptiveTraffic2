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
            
        # Seed / Sync initial 20 junctions
        surat_junctions_data = [
            {"id": "J-001", "name": "SVNIT Junction", "latitude": 21.167790, "longitude": 72.785022, "num_lanes": 4, "has_brts": True, "status": "active"},
            {"id": "J-002", "name": "Majura Gate BRTS Hub", "latitude": 21.182450, "longitude": 72.823200, "num_lanes": 6, "has_brts": True, "status": "active"},
            {"id": "J-003", "name": "Ghod Dod Road Junction", "latitude": 21.175400, "longitude": 72.805200, "num_lanes": 4, "has_brts": False, "status": "active"},
            {"id": "J-004", "name": "Sahara Darwaja Junction", "latitude": 21.196600, "longitude": 72.846500, "num_lanes": 6, "has_brts": True, "status": "active"},
            {"id": "J-005", "name": "Udhna Darwaja", "latitude": 21.179400, "longitude": 72.836200, "num_lanes": 6, "has_brts": True, "status": "active"},
            {"id": "J-006", "name": "Hirabaug Circle", "latitude": 21.216200, "longitude": 72.863500, "num_lanes": 6, "has_brts": True, "status": "active"},
            {"id": "J-007", "name": "Adajan Patiya Junction", "latitude": 21.198200, "longitude": 72.795200, "num_lanes": 4, "has_brts": True, "status": "active"},
            {"id": "J-008", "name": "Athwa Gate / Chowk Bazaar", "latitude": 21.188400, "longitude": 72.815400, "num_lanes": 4, "has_brts": False, "status": "active"},
            {"id": "J-009", "name": "Delhi Gate Circle", "latitude": 21.199400, "longitude": 72.833200, "num_lanes": 6, "has_brts": True, "status": "active"},
            {"id": "J-010", "name": "VNSGU University Road", "latitude": 21.153400, "longitude": 72.775400, "num_lanes": 4, "has_brts": False, "status": "active"},
            {"id": "J-011", "name": "Katargam Darwaja", "latitude": 21.215400, "longitude": 72.832400, "num_lanes": 4, "has_brts": True, "status": "active"},
            {"id": "J-012", "name": "Vesu VIP Road Junction", "latitude": 21.142400, "longitude": 72.796200, "num_lanes": 6, "has_brts": True, "status": "active"},
            {"id": "J-013", "name": "Amroli Cross Road", "latitude": 21.238100, "longitude": 72.848400, "num_lanes": 4, "has_brts": True, "status": "active"},
            {"id": "J-014", "name": "Pandesara GIDC Cross", "latitude": 21.123400, "longitude": 72.835400, "num_lanes": 4, "has_brts": False, "status": "active"},
            {"id": "J-015", "name": "Sarthana Jakat Naka", "latitude": 21.232200, "longitude": 72.891400, "num_lanes": 6, "has_brts": True, "status": "active"},
            {"id": "J-016", "name": "Pal Rander Road", "latitude": 21.210200, "longitude": 72.782400, "num_lanes": 4, "has_brts": False, "status": "active"},
            {"id": "J-017", "name": "Ring Road Rustampura", "latitude": 21.181400, "longitude": 72.835400, "num_lanes": 6, "has_brts": True, "status": "active"},
            {"id": "J-018", "name": "City Light Junction", "latitude": 21.162400, "longitude": 72.802400, "num_lanes": 4, "has_brts": False, "status": "active"},
            {"id": "J-019", "name": "Kadodara Highway Cross", "latitude": 21.171400, "longitude": 72.910400, "num_lanes": 6, "has_brts": False, "status": "active"},
            {"id": "J-020", "name": "Dumas Beach Cross Road", "latitude": 21.095400, "longitude": 72.725400, "num_lanes": 4, "has_brts": False, "status": "active"},
        ]
        for jdata in surat_junctions_data:
            existing = await db.execute(select(Junction).where(Junction.id == jdata["id"]))
            j_obj = existing.scalar_one_or_none()
            if j_obj:
                j_obj.name = jdata["name"]
                j_obj.latitude = jdata["latitude"]
                j_obj.longitude = jdata["longitude"]
                j_obj.num_lanes = jdata["num_lanes"]
                j_obj.has_brts = jdata["has_brts"]
                j_obj.status = jdata["status"]
            else:
                db.add(Junction(**jdata))
            
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
