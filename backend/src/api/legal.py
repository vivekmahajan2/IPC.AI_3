from typing import Optional
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_user_optional
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
    current_user: Optional[User] = Depends(get_current_user_optional),
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

    # Convert retrieved rows to structured context chunks for the LLM
    context_chunks = []
    for m in mappings:
        context_chunks.append({
            "act": f"{m.old_act} / {m.new_act}",
            "section": f"{m.old_section} -> {m.new_section}",
            "title": f"{m.old_title or ''} / {m.new_title or ''}",
            "text": f"Old ({m.old_act} s.{m.old_section}): {m.old_text or ''}\nNew ({m.new_act} s.{m.new_section}): {m.new_text or ''}\nNotes: {m.mapping_notes or ''}",
        })
    for j in judgments:
        context_chunks.append({
            "act": "Precedent",
            "section": j.citation or "",
            "title": j.case_title,
            "text": f"Court: {j.court_name}. Bench: {j.bench or 'N/A'}. Summary: {j.summary or ''}",
        })
    for s in other_statutes:
        context_chunks.append({
            "act": s.act_name,
            "section": s.section,
            "title": s.title,
            "text": s.description,
        })

    # Call RAG Service (Gemini primary -> Groq fallback)
    from ..services.rag_service import query_legal_ai
    rag_result = await query_legal_ai(
        query=request.query,
        context_type=request.context,
        context_chunks=context_chunks,
    )

    # If Gemini or Groq answered, use the synthesized AI answer
    if rag_result.get("provider") in ("gemini", "groq"):
        answer = rag_result["answer"]
    elif not answer:
        answer = rag_result["answer"]

    # Log query to history if user is authenticated
    if current_user:
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


class SuggestSectionsRequest(BaseModel):
    description: str
    title: Optional[str] = None


class SectionSuggestion(BaseModel):
    section: str
    act: str
    title: str
    reason: str


class SuggestSectionsResponse(BaseModel):
    suggested_sections: list[str]
    details: list[SectionSuggestion]


@router.post("/suggest-sections", response_model=SuggestSectionsResponse)
async def suggest_sections(
    request: SuggestSectionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Analyze incident description and recommend applicable legal sections under BNS & IPC.
    Uses AI RAG pipeline with database section mapping fallback.
    """
    from ..models.mapping import SectionMapping
    from ..services.rag_service import query_legal_ai
    
    desc_lower = (request.description or "").lower()
    keywords = [w for w in desc_lower.split() if len(w) > 3]
    
    # Retrieve matching section mappings from DB
    mappings = []
    if keywords:
        conditions = []
        for kw in keywords[:10]:
            term = f"%{kw}%"
            conditions.append(SectionMapping.old_title.ilike(term))
            conditions.append(SectionMapping.new_title.ilike(term))
            conditions.append(SectionMapping.old_text.ilike(term))
            conditions.append(SectionMapping.new_text.ilike(term))
        query = select(SectionMapping).where(or_(*conditions)).limit(8)
        result = await db.execute(query)
        mappings = result.scalars().all()

    context_chunks = []
    for m in mappings:
        context_chunks.append({
            "act": f"{m.old_act} -> {m.new_act}",
            "section": f"{m.old_section} -> {m.new_section}",
            "title": f"{m.new_title or m.old_title or ''}",
            "text": f"Old: {m.old_text or ''}\nNew: {m.new_text or ''}",
        })

    prompt = (
        f"Incident Title: {request.title or 'N/A'}\n"
        f"Incident Description:\n{request.description}\n\n"
        "Based on Indian Criminal Law (Bharatiya Nyaya Sanhita 2023 and Indian Penal Code), "
        "identify the exact applicable legal sections for this incident. "
        "Format your answer clearly with the section code (e.g., 'BNS 303(2)' or 'IPC 379'), "
        "the legal title of the offence, and a 1-sentence legal justification."
    )

    rag_result = await query_legal_ai(
        query=prompt,
        context_type="fir_drafting",
        context_chunks=context_chunks,
    )

    suggested_sections: list[str] = []
    details: list[SectionSuggestion] = []

    # First, populate from database matches
    for m in mappings:
        sec_label = f"BNS {m.new_section}"
        if sec_label not in suggested_sections:
            suggested_sections.append(sec_label)
            details.append(
                SectionSuggestion(
                    section=sec_label,
                    act="BNS",
                    title=m.new_title or m.old_title or "Offence",
                    reason=f"Corresponds to legacy IPC Section {m.old_section} ({m.old_title or ''}).",
                )
            )

    # Extract any explicit section mentions from the LLM answer
    llm_answer = rag_result.get("answer", "")
    found_bns = re.findall(r'BNS\s*(?:Section\s*)?(\d+(?:\(\d+\))?)', llm_answer, re.IGNORECASE)
    for num in found_bns:
        s = f"BNS {num}"
        if s not in suggested_sections:
            suggested_sections.append(s)
            details.append(
                SectionSuggestion(
                    section=s,
                    act="BNS",
                    title="Suggested BNS Section",
                    reason="Identified by AI legal reasoning from incident facts.",
                )
            )

    found_ipc = re.findall(r'IPC\s*(?:Section\s*)?(\d+[A-Za-z]?)', llm_answer, re.IGNORECASE)
    for num in found_ipc:
        s = f"IPC {num}"
        if s not in suggested_sections:
            suggested_sections.append(s)
            details.append(
                SectionSuggestion(
                    section=s,
                    act="IPC",
                    title="Legacy IPC Section",
                    reason="Equivalent legacy section for reference.",
                )
            )

    return SuggestSectionsResponse(
        suggested_sections=suggested_sections[:6],
        details=details[:6],
    )


