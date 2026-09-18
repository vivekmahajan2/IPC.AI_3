"""
RAG (Retrieval Augmented Generation) service for legal Q&A.

Pipeline:
1. Embed / retrieve relevant statute, judgment, or section mappings
2. Primary LLM: Google Gemini (3.7 Flash, 3.6 Flash, 3.5 Flash, 2.5 Flash)
3. Fallback LLM: Groq (groq/compound with compound-mini fallback)
4. Return verified answer with source citations
"""

import logging
from typing import Optional, List
import httpx

from ..core.config import get_settings

logger = logging.getLogger(__name__)


async def query_legal_ai(
    query: str,
    context_type: Optional[str] = None,
    context_chunks: Optional[List[dict]] = None,
) -> dict:
    """
    Execute the RAG pipeline for a legal query.
    Tries Google Gemini first (primary), then Groq (fallback).
    Returns dict with 'answer', 'sources', 'query', and 'provider'.
    """
    settings = get_settings()

    if context_chunks is None:
        context_chunks = await _retrieve_context(query)

    system_prompt = _build_system_prompt(context_type)
    user_prompt = _build_user_prompt(query, context_chunks)

    answer = None
    used_provider = None

    # Step 1: Try Primary LLM — Google Gemini
    if settings.GEMINI_API_KEY:
        gemini_result = await _call_gemini(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            api_key=settings.GEMINI_API_KEY,
            preferred_model=settings.GEMINI_MODEL,
        )
        if gemini_result:
            answer = gemini_result
            used_provider = "gemini"

    # Step 2: Fallback LLM — Groq (groq/compound)
    if not answer and settings.GROQ_API_KEY:
        groq_result = await _call_groq(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            api_key=settings.GROQ_API_KEY,
            preferred_model=settings.GROQ_MODEL,
        )
        if groq_result:
            answer = groq_result
            used_provider = "groq"

    # Step 3: Local Database Fallback if neither responded
    if not answer:
        answer = _fallback_response(query, context_chunks)
        used_provider = "database_fallback"

    sources = _extract_sources(context_chunks)

    return {
        "answer": answer,
        "sources": sources,
        "query": query,
        "provider": used_provider,
    }


async def _call_gemini(
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    preferred_model: str = "gemini-3.7-flash",
) -> Optional[str]:
    """
    Call Google Gemini generateContent API.
    Cascades through 3.7 Flash, 3.6 Flash, 3.5 Flash, 2.5 Flash, 2.0 Flash, 1.5 Flash.
    """
    models_to_try = []
    candidates = [
        preferred_model,
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]
    for m in candidates:
        if m and m not in models_to_try:
            models_to_try.append(m)

    combined_content = f"{system_prompt}\n\n---\n{user_prompt}"

    async with httpx.AsyncClient(timeout=35.0) as client:
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": combined_content}],
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 2048,
                },
            }
            try:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    candidates_data = data.get("candidates", [])
                    if candidates_data:
                        parts = candidates_data[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"]
                else:
                    logger.warning(f"Gemini model {model} returned HTTP {response.status_code}: {response.text[:200]}")
            except Exception as e:
                logger.warning(f"Gemini model {model} failed: {e}")

    return None


async def _call_groq(
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    preferred_model: str = "groq/compound",
) -> Optional[str]:
    """
    Call Groq completions API.
    Tries groq/compound first, then falls back to groq/compound-mini and available models.
    """
    models_to_try = []
    candidates = [
        preferred_model,
        "groq/compound",
        "groq/compound-mini",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
    ]
    for m in candidates:
        if m and m not in models_to_try:
            models_to_try.append(m)

    combined_content = f"{system_prompt}\n\nUser Question: {user_prompt}"

    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in models_to_try:
            try:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "user", "content": combined_content},
                        ],
                        "max_tokens": 1024,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "")
                else:
                    logger.warning(f"Groq model {model} returned HTTP {response.status_code}: {response.text[:200]}")
            except Exception as e:
                logger.warning(f"Groq model {model} failed: {e}")

    return None


async def _retrieve_context(query: str) -> list[dict]:
    """Placeholder for vector similarity search when embeddings are indexed."""
    return []


def _build_system_prompt(context_type: Optional[str] = None) -> str:
    base_prompt = (
        "You are IPC.ai, an authoritative Indian legal assistant specializing in criminal law, "
        "evidence law, and criminal procedure. You have comprehensive mastery of both legacy laws "
        "(Indian Penal Code - IPC, Code of Criminal Procedure - CrPC, Indian Evidence Act - IEA) and the "
        "new Sanhita codes (Bharatiya Nyaya Sanhita - BNS, Bharatiya Nagarik Suraksha Sanhita - BNSS, "
        "Bharatiya Sakshya Adhiniyam - BSA).\n\n"
        "Guidelines:\n"
        "1. Always cite specific section numbers for both old and new law counterparts where applicable.\n"
        "2. Explain essential ingredients, punishment, bailability, and cognizability when asked about offences.\n"
        "3. Provide actionable, practical guidance suitable for police investigating officers, lawyers, and citizens.\n"
        "4. If legal reference context is provided below, ground and prioritize your response on it."
    )

    if context_type == "fir_drafting":
        base_prompt += (
            "\n\nThe user is drafting a First Information Report (FIR). "
            "Help identify the exact cognizable sections to apply, crucial facts to specify, "
            "and necessary procedural steps under BNSS."
        )

    return base_prompt


def _build_user_prompt(query: str, context_chunks: list[dict]) -> str:
    if context_chunks:
        context_text = "\n\n".join(
            f"[{c.get('act', 'Reference')} Section {c.get('section', '')} - {c.get('title', '')}]:\n{c.get('text', '')}"
            for c in context_chunks
        )
        return (
            f"Verified Legal Knowledge Base References:\n\n{context_text}\n\n"
            f"User Question:\n{query}\n\n"
            f"Please provide a comprehensive and structured legal analysis with citations based on the above references and Indian statutory law."
        )
    return query


def _fallback_response(query: str, context_chunks: list[dict]) -> str:
    if context_chunks:
        summary = "Based on our legal reference database:\n\n"
        for c in context_chunks[:5]:
            summary += f"- **{c.get('act')} Section {c.get('section')}** ({c.get('title', '')}):\n  {c.get('text', '')[:250]}...\n\n"
        return summary
    return (
        f"I understand your legal question regarding: '{query}'.\n\n"
        "To enable real-time AI reasoning, configure `GEMINI_API_KEY` (Primary) or `GROQ_API_KEY` (Fallback) "
        "in your backend `.env` file. You can also look up statutory mappings directly in the Sanhita Converter tab."
    )


def _extract_sources(context_chunks: list[dict]) -> list[dict]:
    sources = []
    for chunk in context_chunks:
        sources.append({
            "act": chunk.get("act"),
            "section": chunk.get("section"),
            "title": chunk.get("title"),
            "text_snippet": chunk.get("text", "")[:250],
        })
    return sources
