from fastapi import APIRouter, Depends,HTTPException
from backend.database import get_db
from backend.models import Session, Messages
from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("")
async def list_sessions(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Session).order_by(Session.updated_at.desc()))
    sessions = result.scalars().all()
    return [
        {"id": s.id, "name": s.name, "created_at": s.created_at.isoformat(), "updated_at": s.updated_at.isoformat()}
        for s in sessions
    ]


@router.post("")
async def create_session(db: Annotated[AsyncSession, Depends(get_db)]):
    session = Session(name=f"新会话")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"id": session.id, "name": session.name, "created_at": session.created_at.isoformat(), "updated_at": session.updated_at.isoformat()}


@router.get("/{session_id}/messages")
async def list_messages(session_id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(Messages).where(Messages.session_id == session_id).order_by(Messages.created_at)
    )
    msgs = result.scalars().all()
    return [
        {"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
        for m in msgs
    ]


@router.delete("/{session_id}")
async def delete_session(session_id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    s = await db.get(Session, session_id)
    if s:
        await db.execute(Messages.__table__.delete().where(Messages.session_id == session_id))
        await db.delete(s)
        await db.commit()
    return {"ok": True}

@router.put("")
async def updata_name(name: str,session_id: str,db: Annotated[AsyncSession,Depends(get_db)]):
    result = await db.execute(select(Session).where(Session.id == session_id))
    one = result.scalar_one_or_none()
    if not one:
        raise HTTPException(status_code=404,detail="没有该会话")
    one.name = name
    await db.commit()
    return {"ok":True}
