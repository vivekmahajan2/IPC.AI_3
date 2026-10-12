"""Search/action history logging service."""

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.history import SearchHistory


async def log_search(
    db: AsyncSession,
    user_id: int,
    module: str,
    query: str,
    response_summary: str = "",
) -> SearchHistory:
    """
    Log a search/action to history.

    Modules: 'legal_ai', 'converter', 'judgments', 'lawyers', 'fir'
    """
    entry = SearchHistory(
        user_id=user_id,
        module=module,
        query=query,
        response_summary=response_summary[:500] if response_summary else None,
    )
    db.add(entry)
    return entry
