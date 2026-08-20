from typing import Optional, List
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..models.judgment import Judgment

router = APIRouter(prefix="/judgments", tags=["Judgments"])


class JudgmentResponse(BaseModel):
    id: int
    case_title: str
    court_name: str
    bench: Optional[str] = None
    judgment_date: Optional[date] = None
    citation: Optional[str] = None
    case_number: Optional[str] = None
    summary: Optional[str] = None
    full_text_url: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("", response_model=List[JudgmentResponse])
async def list_judgments(
    q: Optional[str] = None,
    court: Optional[str] = None,
    year: Optional[int] = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Judgment)

    if q:
        search = f"%{q}%"
        query = query.where(
            or_(
                Judgment.case_title.ilike(search),
                Judgment.summary.ilike(search),
                Judgment.citation.ilike(search),
                Judgment.case_number.ilike(search),
            )
        )
    if court:
        query = query.where(Judgment.court_name.ilike(f"%{court}%"))
    if year:
        from sqlalchemy import extract
        query = query.where(extract("year", Judgment.judgment_date) == year)

    query = query.order_by(desc(Judgment.judgment_date)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/search", response_model=List[JudgmentResponse])
async def search_judgments(
    q: Optional[str] = None,
    court: Optional[str] = None,
    year: Optional[int] = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await list_judgments(q=q, court=court, year=year, skip=skip, limit=limit, db=db, current_user=current_user)



@router.get("/courts")
async def list_courts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import distinct
    result = await db.execute(select(distinct(Judgment.court_name)).order_by(Judgment.court_name))
    courts = [row[0] for row in result.all()]
    return {"courts": courts}


@router.get("/{judgment_id}", response_model=JudgmentResponse)
async def get_judgment(
    judgment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Judgment).where(Judgment.id == judgment_id))
    judgment = result.scalar_one_or_none()

    if not judgment:
        raise HTTPException(status_code=404, detail="Judgment not found")

    return judgment
