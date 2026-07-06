from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy import select
from backend.database import get_db,AsyncSession
from typing import Annotated
from backend.models import KnowledgeBase,Document
from backend.service import vector_store
from backend.schema import KnowledgeResponse,DocumentResponse
router = APIRouter(prefix="/knowledge",tags=["knowledge"])

@router.post("")
async def insert_knowledge(
    name: str,
    description: str,
    chunk_size: int,
    chunk_overlap: int,
    db: Annotated[AsyncSession,Depends(get_db)]
):
    kb = KnowledgeBase(name=name,description=description,chunk_size=chunk_size,chunk_overlap=chunk_overlap)
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    vector_store.get_collection(kb.id)
    return KnowledgeResponse.model_validate(kb)




@router.get("")
async def knowledge_list(db: Annotated[AsyncSession,Depends(get_db)]):
    result = await db.execute(select(KnowledgeBase).order_by(KnowledgeBase.created_at.desc()))
    items = result.scalars().all()
    return [
        KnowledgeResponse.model_validate(item)
        for item in items
    ]

@router.get("/defaults")
async def get_defaults():
    from backend.config import settings
    return {
        "chunk_size": settings.CHUNK_SIZE,
        "chunk_overlap": settings.CHUNK_OVERLAP
    }

@router.get("/{kb_id}")
async def get_one_knowledge(kb_id: str,db: Annotated[AsyncSession,Depends(get_db)]):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404,detail="没有该知识库")
    return KnowledgeResponse.model_validate(item)

@router.patch("/{kb_id}")
async def update_knowledge(
    kb_id: str,
    db: Annotated[AsyncSession,Depends(get_db)],
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404,detail="没有该知识库")
    if chunk_size is not None:
        item.chunk_size = chunk_size
    if chunk_overlap is not None:
        item.chunk_overlap = chunk_overlap
    await db.commit()
    await db.refresh(item)
    return KnowledgeResponse.model_validate(item)

@router.delete("/{kb_id}")
async def delete_one(kb_id: str,db: Annotated[AsyncSession,Depends(get_db)]):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404,detail="没有该知识库")
    vector_store.delete_collection(kb_id)
    await db.delete(item)
    await db.commit()
    return {"ok": True}
    