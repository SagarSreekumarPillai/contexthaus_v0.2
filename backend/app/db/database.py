import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./contexthaus.db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def _sqlite_migrate(connection) -> None:
    """Add new columns and seed a default organization for legacy SQLite files."""
    from sqlalchemy import inspect, text
    import uuid as ulib

    insp = inspect(connection)
    tables = set(insp.get_table_names())
    if "organizations" not in tables:
        return
    cnt = connection.execute(text("SELECT COUNT(*) FROM organizations")).scalar()
    if cnt == 0:
        oid = str(ulib.uuid4())
        connection.execute(
            text(
                "INSERT INTO organizations (id, name, created_at) VALUES (:id, :name, datetime('now'))"
            ),
            {"id": oid, "name": "Default Organization"},
        )
    oid_row = connection.execute(text("SELECT id FROM organizations ORDER BY rowid LIMIT 1")).fetchone()
    default_oid = oid_row[0] if oid_row else None
    if not default_oid:
        return
    if "properties" in tables:
        cols = {c["name"] for c in insp.get_columns("properties")}
        if "organization_id" not in cols:
            connection.execute(text("ALTER TABLE properties ADD COLUMN organization_id VARCHAR"))
        connection.execute(
            text("UPDATE properties SET organization_id = :oid WHERE organization_id IS NULL"),
            {"oid": default_oid},
        )


async def init_db():
    from app.db.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_sqlite_migrate)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session