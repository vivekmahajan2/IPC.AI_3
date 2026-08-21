from typing import Optional
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..models.history import SearchHistory

router = APIRouter(prefix="/legal", tags=["Legal AI"])


class LegalQueryRequest(BaseModel):
    query: str
    context: Optional[str] = None  # e.g., "fir_drafting", "general"


class SourceReference(BaseModel):
    act: Optional[str] = None
    section: Optional[str] = None
    title: Optional[str] = None
    text_snippet: Optional[str] = None


class LegalQueryResponse(BaseModel):
    answer: str
    sources: list[SourceReference] = []
    query: str


@router.post("/query", response_model=LegalQueryResponse)
async def legal_query(
    request: LegalQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI-powered legal Q&A using RAG (Mock implementation using database query matches):
    1. Scan query for section numbers or keywords
    2. Query SectionMapping and Judgment tables for matching rows
    3. Construct a detailed summary response with cited sources
    """
    query_str = request.query.lower()
    
    from ..models.mapping import SectionMapping
    from ..models.judgment import Judgment
    
    # Extract digits to search by section number
    digits = re.findall(r'\d+', query_str)
    mappings = []
    
    if digits:
        db_query = select(SectionMapping).where(
            or_(
                SectionMapping.old_section.in_(digits),
                SectionMapping.new_section.in_(digits)
            )
        )
        result = await db.execute(db_query)
        mappings = result.scalars().all()
    
    # If no section numbers match, search using keywords
    if not mappings:
        keywords = [word for word in query_str.split() if len(word) > 3]
        if keywords:
            conditions = []
            for kw in keywords:
                search_term = f"%{kw}%"
                conditions.append(SectionMapping.old_title.ilike(search_term))
                conditions.append(SectionMapping.new_title.ilike(search_term))
                conditions.append(SectionMapping.old_text.ilike(search_term))
                conditions.append(SectionMapping.new_text.ilike(search_term))
            
            db_query = select(SectionMapping).where(or_(*conditions)).limit(5)
            result = await db.execute(db_query)
            mappings = result.scalars().all()

    # Search judgments for keywords
    judgments = []
    other_statutes = []
    keywords = [word for word in query_str.split() if len(word) > 3]
    if keywords:
        j_conditions = []
        for kw in keywords:
            search_term = f"%{kw}%"
            j_conditions.append(Judgment.case_title.ilike(search_term))
            j_conditions.append(Judgment.summary.ilike(search_term))
            j_conditions.append(Judgment.citation.ilike(search_term))
        
        judgment_query = select(Judgment).where(or_(*j_conditions)).limit(3)
        result = await db.execute(judgment_query)
        judgments = result.scalars().all()

        # Search Other Law Statutes for keywords
        from ..models.other_law import OtherLawStatute
        ol_conditions = []
        for kw in keywords:
            search_term = f"%{kw}%"
            ol_conditions.append(OtherLawStatute.act_name.ilike(search_term))
            ol_conditions.append(OtherLawStatute.section.ilike(search_term))
            ol_conditions.append(OtherLawStatute.title.ilike(search_term))
            ol_conditions.append(OtherLawStatute.description.ilike(search_term))
        
        ol_query = select(OtherLawStatute).where(or_(*ol_conditions)).limit(5)
        result = await db.execute(ol_query)
        other_statutes = result.scalars().all()

    sources = []
    answer = ""

    if mappings:
        answer += "According to the Sanhita section mappings in our database:\n\n"
        for m in mappings:
            answer += f"- **{m.old_act} Section {m.old_section}** ({m.old_title or 'Section details'}) corresponds to **{m.new_act} Section {m.new_section}** ({m.new_title or 'Section details'}).\n"
            if m.mapping_notes:
                answer += f"  *Notes: {m.mapping_notes}*\n"
            
            sources.append(
                SourceReference(
                    act=m.old_act,
                    section=m.old_section,
                    title=m.old_title or "Section details",
                    text_snippet=m.old_text[:200] if m.old_text else None
                )
            )
            sources.append(
                SourceReference(
                    act=m.new_act,
                    section=m.new_section,
                    title=m.new_title or "Section details",
                    text_snippet=m.new_text[:200] if m.new_text else None
                )
            )
    
    if judgments:
        if answer:
            answer += "\n"
        answer += "Relevant judicial precedents found:\n\n"
        for j in judgments:
            answer += f"- **{j.case_title}** ({j.citation}, {j.court_name}). Bench: {j.bench or 'N/A'}.\n  *Summary: {j.summary}*\n"
            sources.append(
                SourceReference(
                    act="Precedent",
                    section=j.citation,
                    title=j.case_title,
                    text_snippet=j.summary
                )
            )

    if other_statutes:
        if answer:
            answer += "\n"
        answer += "Relevant provisions from other law categories:\n\n"
        for s in other_statutes:
            answer += f"- **{s.act_name} {s.section}** ({s.title}): {s.description[:250]}...\n"
            sources.append(
                SourceReference(
                    act=s.act_name,
                    section=s.section,
                    title=s.title,
                    text_snippet=s.description[:200]
                )
            )


    # Contextual info on Constitution of India (COI)
    if "constitution" in query_str or "coi" in query_str or "part" in query_str or "preamble" in query_str:
        if answer:
            answer += "\n"
        answer += "Regarding the Constitution of India (COI):\n\nThe Constitution of India is the supreme law of India. It is divided into 22 parts containing 395 articles. Our database has structured navigation index for these parts, routing detailed article details to the AI helper."
        sources.append(
            SourceReference(
                act="COI",
                section="Preamble",
                title="Preamble to the Constitution",
                text_snippet="WE, THE PEOPLE OF INDIA, having solemnly resolved to constitute India into a SOVEREIGN SOCIALIST SECULAR DEMOCRATIC REPUBLIC..."
            )
        )

    if not answer:
        answer = (
            f"I understand your legal query: '{request.query}'.\n\n"
            "I could not locate specific matching section mappings or judgments in the local database. "
            "Please try querying using common keywords like 'murder' (IPC 302 / BNS 101), 'rape' (IPC 376 / BNS 63), 'cheating' (IPC 420 / BNS 318), "
            "or landmark case names like 'Bachan Singh' or 'Nanavati'."
        )

    # Log query to history
    history_entry = SearchHistory(
        user_id=current_user.id,
        module="legal_ai",
        query=request.query,
        response_summary=answer[:200],
    )
    db.add(history_entry)
    await db.commit()

    return LegalQueryResponse(
        answer=answer,
        sources=sources,
        query=request.query,
    )

