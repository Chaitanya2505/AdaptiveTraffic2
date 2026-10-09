import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

engine = create_async_engine('postgresql+asyncpg://neondb_owner:npg_hcx34jQWNkRC@ep-muddy-hill-ate19r7h-pooler.c-9.us-east-1.aws.neon.tech/neondb?ssl=require')

async def run():
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE junctions ADD COLUMN IF NOT EXISTS cameras JSON DEFAULT '[]'"))
        await conn.execute(text("ALTER TABLE junctions ADD COLUMN IF NOT EXISTS optimization_mode VARCHAR(20) DEFAULT 'DRL'"))

if __name__ == "__main__":
    asyncio.run(run())
