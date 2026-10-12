from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_user_optional
from ..models.user import User
from ..models.other_law import OtherLawStatute

router = APIRouter(prefix="/other-law", tags=["Other Law"])


class OtherLawStatuteResponse(BaseModel):
    id: int
    category: str
    subcategory: Optional[str] = None
    act_name: str
    section: str
    title: str
    description: str

    class Config:
        from_attributes = True


class CategoryResponse(BaseModel):
    name: str
    subcategories: List[str]


@router.get("", response_model=List[OtherLawStatuteResponse])
async def list_other_law_statutes(
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    query = select(OtherLawStatute)

    if category:
        query = query.where(OtherLawStatute.category == category)
    if subcategory:
        query = query.where(OtherLawStatute.subcategory == subcategory)
    if q:
        search = f"%{q}%"
        query = query.where(
            or_(
                OtherLawStatute.act_name.ilike(search),
                OtherLawStatute.section.ilike(search),
                OtherLawStatute.title.ilike(search),
                OtherLawStatute.description.ilike(search),
                OtherLawStatute.subcategory.ilike(search),
                OtherLawStatute.category.ilike(search),
            )
        )

    limit_val = 500 if (category and limit == 50) else limit
    query = query.offset(skip).limit(limit_val)
    result = await db.execute(query)
    statutes = list(result.scalars().all())

    import re
    def statute_sort_key(s: OtherLawStatute):
        m = re.search(r"\d+", s.section or "")
        num = int(m.group()) if m else 999999
        return (s.act_name or "", num, s.section or "")

    statutes.sort(key=statute_sort_key)
    return statutes


@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories_and_subcategories(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    result = await db.execute(select(OtherLawStatute.category, OtherLawStatute.subcategory).distinct())
    rows = result.all()

    categories_dict: Dict[str, set] = {}
    expected_categories = [
        "Civil Law", "Family Law", "Commercial Law", "Cyber Law",
        "Labour Law", "State Laws", "Tax Law", "Food Law"
    ]
    for cat in expected_categories:
        categories_dict[cat] = set()

    for row in rows:
        cat, subcat = row[0], row[1]
        if cat:
            if cat not in categories_dict:
                categories_dict[cat] = set()
            if subcat:
                categories_dict[cat].add(subcat)

    response = []
    for cat, subcats in categories_dict.items():
        response.append(
            CategoryResponse(
                name=cat,
                subcategories=sorted(list(subcats))
            )
        )

    return response


@router.get("/{statute_id}", response_model=OtherLawStatuteResponse)
async def get_statute(
    statute_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    result = await db.execute(select(OtherLawStatute).where(OtherLawStatute.id == statute_id))
    statute = result.scalar_one_or_none()

    if not statute:
        raise HTTPException(status_code=404, detail="Statute not found")

    return statute
