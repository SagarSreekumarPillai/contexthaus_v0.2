from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.database import init_db
    from app.db.seed_default import seed_default_account_if_enabled

    await init_db()
    await seed_default_account_if_enabled()
    yield


app = FastAPI(title="ContextHaus API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3100",
        "http://127.0.0.1:3100",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.auth import router as auth_router
from app.api.users_admin import router as users_admin_router
from app.api.audit import router as audit_router
from app.api.properties import router as properties_router
from app.api.ingest import router as ingest_router
from app.api.analytics import router as analytics_router
from app.api.vendors import router as vendors_router

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users_admin_router, prefix="/api/users", tags=["users"])
app.include_router(audit_router, prefix="/api/audit", tags=["audit"])
app.include_router(properties_router, prefix="/api/properties", tags=["properties"])
app.include_router(ingest_router, prefix="/api/ingest", tags=["ingest"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])
app.include_router(vendors_router, prefix="/api/vendors", tags=["vendors"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "contexthaus"}


@app.get("/api/test-gemini")
async def test_gemini():
    from app.core.llm import generate, FLASH
    result = await generate(prompt="Reply with exactly: ContextHaus is live.", model=FLASH)
    return {"response": result}
