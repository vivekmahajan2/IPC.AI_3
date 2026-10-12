import re
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


def natural_sort_key_section(sec_str: Optional[str]) -> tuple:
    """Parses section strings like '304A', '1(2)', '2(1)(a)' into natural numeric sort tuples."""
    if not sec_str:
        return (999999, 999999, "")
    s = str(sec_str).strip()
    m = re.match(r"^(\d+)(.*)", s)
    if not m:
        return (999998, 0, s.lower())
    main_num = int(m.group(1))
    rest = m.group(2).strip()
    m_sub = re.search(r"\((\d+)\)", rest)
    sub_num = int(m_sub.group(1)) if m_sub else 0
    return (main_num, sub_num, rest.lower())


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

    is_new_act_selected = False
    if act:
        act_upper = act.upper()
        if act_upper in ["BNS", "BNSS", "BSA"]:
            is_new_act_selected = True
            query = query.where(SectionMapping.new_act == act_upper)
            if not section and not q:
                query = query.where(SectionMapping.new_section != "")
        else:
            query = query.where(SectionMapping.old_act == act_upper)
            if not section and not q:
                query = query.where(SectionMapping.old_section != "")

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

    # If browsing all sections of an act, allow a limit of 1000 so all sections are available
    limit_val = 1000 if (act and not section and not q) else 50
    query = query.limit(limit_val)
    result = await db.execute(query)
    mappings = list(result.scalars().all())

    # Sort in ascending natural numerical order
    def sort_key(m: SectionMapping):
        target_sec = m.new_section if (is_new_act_selected or (not act and direction == "new_to_old")) else m.old_section
        fallback_sec = m.old_section if (is_new_act_selected or (not act and direction == "new_to_old")) else m.new_section
        primary = natural_sort_key_section(target_sec)
        if primary[0] == 999999:
            return (1, natural_sort_key_section(fallback_sec))
        return (0, primary)

    mappings.sort(key=sort_key)
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
    mappings = list(result.scalars().all())

    act_order = {"IPC": 1, "BNS": 1, "CRPC": 2, "BNSS": 2, "IEA": 3, "BSA": 3}

    def bulk_sort_key(m: SectionMapping):
        rank = act_order.get((m.old_act or "").upper(), 9)
        sec = m.old_section or m.new_section
        return (rank, natural_sort_key_section(sec))

    mappings.sort(key=bulk_sort_key)

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
