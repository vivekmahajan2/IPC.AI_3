import json
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.dependencies import require_role
from ..models.user import User
from ..models.mapping import SectionMapping

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/reindex")
async def reindex(
    current_user: User = Depends(require_role("admin")),
):
    """
    Trigger re-ingestion of RAG chunks (statute_chunks, judgment_chunks).
    TODO: Implement actual re-indexing logic.
    """
    return {"message": "Re-indexing started", "status": "pending"}


@router.post("/seed/mappings")
async def seed_mappings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Load section_mappings.json into the database.
    Skips entries that already exist (by old_act + old_section).
    """
    # Find the data file relative to the backend directory
    data_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "data",
        "section_mappings.json",
    )

    if not os.path.exists(data_file):
        raise HTTPException(
            status_code=404,
            detail=f"section_mappings.json not found at {data_file}",
        )

    with open(data_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    mappings = data if isinstance(data, list) else data.get("mappings", [])
    if not mappings:
        return {"message": "No mappings found in file", "inserted": 0}

    # Count existing records
    existing_count_result = await db.execute(select(func.count(SectionMapping.id)))
    existing_count = existing_count_result.scalar() or 0

    inserted = 0
    skipped = 0
    for item in mappings:
        # Check if this mapping already exists
        result = await db.execute(
            select(SectionMapping).where(
                SectionMapping.old_act == item.get("old_act", ""),
                SectionMapping.old_section == item.get("old_section", ""),
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            skipped += 1
            continue

        mapping = SectionMapping(
            old_act=item.get("old_act", ""),
            old_section=item.get("old_section", ""),
            old_title=item.get("old_title"),
            old_text=item.get("old_text"),
            new_act=item.get("new_act", ""),
            new_section=item.get("new_section", ""),
            new_title=item.get("new_title"),
            new_text=item.get("new_text"),
            mapping_notes=item.get("mapping_notes"),
            is_identical=item.get("is_identical", False),
        )
        db.add(mapping)
        inserted += 1

    return {
        "message": "Mappings seeded successfully",
        "inserted": inserted,
        "skipped": skipped,
        "total_in_db": existing_count + inserted,
    }
