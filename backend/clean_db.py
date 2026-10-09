import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

engine = create_async_engine('postgresql+asyncpg://neondb_owner:npg_hcx34jQWNkRC@ep-muddy-hill-ate19r7h-pooler.c-9.us-east-1.aws.neon.tech/neondb?ssl=require')

async def run():
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM junctions WHERE id NOT LIKE 'J-00%' AND id NOT LIKE 'J-01%' AND id NOT LIKE 'J-02%'"))
        await conn.execute(text("UPDATE junctions SET name='SVNIT Circle' WHERE id='J-001'"))
        await conn.execute(text("UPDATE junctions SET name='Kargil Chowk' WHERE id='J-002'"))
        await conn.execute(text("UPDATE junctions SET name='Athwa Gate' WHERE id='J-003'"))

if __name__ == "__main__":
    asyncio.run(run())
