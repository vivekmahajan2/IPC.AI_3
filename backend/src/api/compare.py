from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..models.mapping import SectionMapping

router = APIRouter(prefix="/compare", tags=["Sanhita Converter"])


# --- Schemas ---

class MappingResponse(BaseModel):
    id: int
    old_act: str
    old_section: str
    old_title: Optional[str] = None
    old_text: Optional[str] = None
    new_act: str
    new_section: str
    new_title: Optional[str] = None
    new_text: Optional[str] = None
    mapping_notes: Optional[str] = None
    is_identical: bool

    class Config:
        from_attributes = True


# --- Endpoints ---

@router.get("", response_model=list[MappingResponse])
async def compare_sections(
    section: Optional[str] = None,
    act: Optional[str] = None,
    q: Optional[str] = None,
    direction: str = Query("old_to_new", pattern="^(old_to_new|new_to_old)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Look up section mapping. Supports:
    - Specific section lookup: ?act=IPC&section=302
    - Search by text: ?q=murder
    - Direction: old_to_new (IPC→BNS) or new_to_old (BNS→IPC)
    """
    query = select(SectionMapping)

    if act:
        act_upper = act.upper()
        if act_upper in ["BNS", "BNSS", "BSA"]:
            query = query.where(SectionMapping.new_act == act_upper)
        else:
            query = query.where(SectionMapping.old_act == act_upper)

    if section:
        if direction == "old_to_new":
            query = query.where(SectionMapping.old_section == section)
        else:
            query = query.where(SectionMapping.new_section == section)
    elif q:
        search = f"%{q}%"
        query = query.where(
            or_(
                SectionMapping.old_title.ilike(search),
                SectionMapping.new_title.ilike(search),
                SectionMapping.old_text.ilike(search),
                SectionMapping.new_text.ilike(search),
                SectionMapping.old_section.ilike(search),
                SectionMapping.new_section.ilike(search),
            )
        )

    # If loading all sections, let's allow a larger limit (e.g. 1000) so the user can scroll through the acts
    limit_val = 1000 if (act and not section and not q) else 50
    query = query.limit(limit_val)
    result = await db.execute(query)
    mappings = result.scalars().all()

    return mappings


@router.get("/bulk")
async def get_bulk_mappings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all mappings as JSON for offline sync.
    The mobile app downloads this on first launch and caches in SQLite.
    """
    result = await db.execute(select(SectionMapping))
    mappings = result.scalars().all()

    data = []
    for m in mappings:
        data.append({
            "id": m.id,
            "old_act": m.old_act,
            "old_section": m.old_section,
            "old_title": m.old_title,
            "old_text": m.old_text,
            "new_act": m.new_act,
            "new_section": m.new_section,
            "new_title": m.new_title,
            "new_text": m.new_text,
            "mapping_notes": m.mapping_notes,
            "is_identical": m.is_identical,
        })

    return {"mappings": data, "count": len(data)}
