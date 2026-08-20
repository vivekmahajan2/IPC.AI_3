from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..models.history import SearchHistory

router = APIRouter(prefix="/history", tags=["History"])


class HistoryResponse(BaseModel):
    id: int
    module: str
    query: str
    response_summary: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[HistoryResponse])
async def list_history(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SearchHistory)
        .where(SearchHistory.user_id == current_user.id)
        .order_by(desc(SearchHistory.created_at))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.delete("/{history_id}")
async def delete_history(
    history_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SearchHistory).where(
            SearchHistory.id == history_id,
            SearchHistory.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    await db.delete(entry)
    return {"message": "History entry deleted"}
