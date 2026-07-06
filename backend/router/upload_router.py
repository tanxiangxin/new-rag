from fastapi import APIRouter,UploadFile,Depends,HTTPException
from backend.database import get_db,AsyncSession
from typing import Annotated
from backend.models import KnowledgeBase,Document
from backend.service.loader import load_and_chunk
from backend.service.vector_store import add_document
from backend.config import settings
from backend.schema import DocumentResponse
from sqlalchemy import select
import uuid
import os
router = APIRouter(prefix="/upload",tags=["upload"])

@router.post("")
async def upload(kb_id: str,file:UploadFile,db: Annotated[AsyncSession,Depends(get_db)]):
    kb = await db.get(KnowledgeBase,kb_id)
    if not kb:
        raise HTTPException(status_code=404,detail="该知识库不存在")
    ext_list = ["txt","pdf","docx"]
    ext = file.filename.rsplit(".",1)[-1].lower() if "." in file.filename else ""
    if ext not in ext_list:
        raise HTTPException(status_code=400,detail="暂不支持此格式")
    doc_id = uuid.uuid4().hex
    file_path = os.path.join(settings.UPLOAD_URL,kb_id,f"{doc_id}.{ext}")
    os.makedirs(os.path.dirname(file_path),exist_ok=True)
    content = await file.read()
    with open(file_path,"wb") as f:
        f.write(content)
    chunks = load_and_chunk(file_path,chunk_size=kb.chunk_size,overlap=kb.chunk_overlap)
    if not chunks:
        os.remove(file_path)
        raise HTTPException(status_code=400,detail="文件解析失败或者内容为空")
    
    file_size = os.path.getsize(file_path)

    doc = Document(
        id=doc_id,
        kb_id=kb_id,
        filename=file.filename,
        file_type=ext,
        file_size=file_size,
        chunk_count=len(chunks),
        file_path=file_path
    )
    db.add(doc)

    metadata_list = [
        {"doc_id":doc_id,"kb_id":kb_id,"filename":file.filename}
        for _ in chunks
    ]
    add_document(kb_id,chunks,metadata_list)
    kb.chunk_count += len(chunks)
    kb.doc_count += 1

    await db.commit()

    return DocumentResponse.model_validate(doc)

@router.get("/doc/{doc_id}")
async def get_doc_metadata(doc_id: str,db: Annotated[AsyncSession,Depends(get_db)]):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    one = result.scalar_one_or_none()
    if not one:
        raise HTTPException(status_code=404,detail="没有该文档")
    return DocumentResponse.model_validate(one)

@router.get("")
async def document_list(kb_id:str,db:Annotated[AsyncSession,Depends(get_db)]):
    result = await db.execute(select(Document).where(Document.kb_id == kb_id))
    items = result.scalars().all()
    return [
        DocumentResponse.model_validate(item)
        for item in items
    ]

@router.delete("/{doc_id}")
async def remove_document(kb_id: str,doc_id: str,db: Annotated[AsyncSession,Depends(get_db)]):
    one = await db.execute(select(Document).where(Document.kb_id == kb_id).where(Document.id == doc_id))
    data = one.scalar_one_or_none()
    if not data:
        raise HTTPException(status_code=404,detail="该文档不存在")
    if os.path.exists(data.file_path):
        os.remove(data.file_path)
    kb = await db.get(KnowledgeBase,kb_id)
    kb.chunk_count -= data.chunk_count
    kb.doc_count -= 1
    await db.delete(data)
    await db.commit()
    return {"ok":True}