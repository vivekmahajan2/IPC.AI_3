from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..models.lawyer import Lawyer

router = APIRouter(prefix="/lawyers", tags=["Lawyers"])


class LawyerResponse(BaseModel):
    id: int
    bar_council_id: Optional[str] = None
    name: str
    firm_name: Optional[str] = None
    specialization: List[str] = []
    practicing_courts: List[str] = []
    years_of_exp: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    languages: List[str] = []
    is_verified: bool = False

    class Config:
        from_attributes = True


@router.get("", response_model=List[LawyerResponse])
async def list_lawyers(
    q: Optional[str] = None,
    specialization: Optional[str] = None,
    city: Optional[str] = None,
    court: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Lawyer)

    if q:
        search = f"%{q}%"
        query = query.where(
            or_(
                Lawyer.name.ilike(search),
                Lawyer.firm_name.ilike(search),
            )
        )
    # Use LIKE on the JSON column (works with both SQLite and PostgreSQL)
    if specialization:
        query = query.where(
            cast(Lawyer.specialization, String).ilike(f"%{specialization}%")
        )
    if city:
        query = query.where(Lawyer.city.ilike(f"%{city}%"))
    if court:
        query = query.where(
            cast(Lawyer.practicing_courts, String).ilike(f"%{court}%")
        )

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{lawyer_id}", response_model=LawyerResponse)
async def get_lawyer(
    lawyer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Lawyer).where(Lawyer.id == lawyer_id))
    lawyer = result.scalar_one_or_none()

    if not lawyer:
        raise HTTPException(status_code=404, detail="Lawyer not found")

    return lawyer
