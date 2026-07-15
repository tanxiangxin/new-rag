from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.database import engine, base
from sqlalchemy import text
from backend.router.chat_router import router as chat_router
from backend.router.session_router import router as session_router
from backend.router.knowledge_base_router import router as kb_router
from backend.router.upload_router import router as upload_router
from backend.router.config_router import router as config_ai_router
from backend.service.vector_store import get_embedding_client
import os
os.environ["HF_HUB_OFFLINE"] = "1"  
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(base.metadata.create_all)
        for col, default in [("chunk_size", 1000), ("chunk_overlap", 200)]:
            try:
                await conn.execute(text(f"ALTER TABLE knowledge_bases ADD COLUMN {col} INTEGER DEFAULT {default}"))
            except Exception:
                pass
        try:
            await conn.execute(text("ALTER TABLE sessions ADD COLUMN summary TEXT"))
        except Exception:
            pass
    get_embedding_client()
    yield
    await engine.dispose()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(session_router)
app.include_router(kb_router)
app.include_router(upload_router)
app.include_router(config_ai_router)
