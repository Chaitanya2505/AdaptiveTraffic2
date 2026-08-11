from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# Dynamically adjust the connection string to use asyncpg for Neon DB/PostgreSQL
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

connect_args = {}
# Neon DB / Postgres requires SSL; strip query parameters that cause TypeError in asyncpg
if "sslmode" in db_url or "ssl" in db_url or "neon.tech" in db_url:
    connect_args["ssl"] = True
if "?" in db_url:
    db_url = db_url.split("?")[0]

# Create the async engine.
engine = create_async_engine(
    db_url,
    connect_args=connect_args,
    echo=False,
    future=True
)

# Async session maker
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# SQLAlchemy Modern 2.0 Base class
class Base(DeclarativeBase):
    pass

async def init_db():
    # Import all models here so that they are registered on Base.metadata before creation
    from app.models.junction import Junction
    from app.models.detection import Detection
    from app.models.signal import Signal
    from app.models.violation import Violation
    from app.models.user import User
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
