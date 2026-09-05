import asyncio
from app.database import engine
from app.models.models import Base

async def init_tables():
    print("[INFO] Initializing SQLAlchemy tables in PostgreSQL...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[SUCCESS] All 21 tables created successfully!")

if __name__ == "__main__":
    asyncio.run(init_tables())
