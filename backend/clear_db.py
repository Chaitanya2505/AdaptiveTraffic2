import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import delete
from app.models.junction import Junction
from app.config import settings

async def clear_junctions():
    db_url = settings.DATABASE_URL
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    
    connect_args = {}
    if "sslmode" in db_url or "ssl" in db_url or "neon.tech" in db_url:
        connect_args["ssl"] = True
    if "?" in db_url:
        db_url = db_url.split("?")[0]

    engine = create_async_engine(db_url, connect_args=connect_args, future=True)
    async_session = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await session.execute(delete(Junction))
        await session.commit()
        print("Successfully deleted all dummy junctions.")

if __name__ == "__main__":
    asyncio.run(clear_junctions())
