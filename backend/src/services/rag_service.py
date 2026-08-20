"""
RAG (Retrieval Augmented Generation) service for legal Q&A.

Pipeline:
1. Embed the user's query
2. Search pgvector for relevant statute/judgment chunks
3. Pass context + query to Groq LLM
4. Return answer with source citations
"""

from typing import Optional

from ..core.config import get_settings


async def query_legal_ai(
    query: str,
    context_type: Optional[str] = None,
) -> dict:
    """
    Execute the RAG pipeline for a legal query.
    Returns dict with 'answer', 'sources', and 'query'.
    """
    settings = get_settings()

    # Step 1: Retrieve relevant context from pgvector
    # TODO: Implement actual embedding + pgvector similarity search
    # when statute_chunks and judgment_chunks are populated
    context_chunks = await _retrieve_context(query)

    # Step 2: Build prompt with retrieved context
    system_prompt = _build_system_prompt(context_type)
    user_prompt = _build_user_prompt(query, context_chunks)

    # Step 3: Call Groq LLM
    if settings.GROQ_API_KEY:
        try:
            answer = await _call_groq(system_prompt, user_prompt, settings.GROQ_API_KEY)
        except Exception as e:
            print(f"Groq API error: {e}")
            answer = _fallback_response(query)
    else:
        answer = _fallback_response(query)

    # Step 4: Extract source references from context
    sources = _extract_sources(context_chunks)

    return {
        "answer": answer,
        "sources": sources,
        "query": query,
    }


async def _retrieve_context(query: str) -> list[dict]:
    """
    Retrieve relevant legal text chunks using pgvector similarity search.
    TODO: Implement when embeddings are loaded into the database.
    """
    # Placeholder: return empty context
    # In production, this would:
    # 1. Embed the query using an embedding model
    # 2. Run a cosine similarity search against statute_chunks and judgment_chunks
    # 3. Return top-k relevant chunks
    return []


def _build_system_prompt(context_type: Optional[str] = None) -> str:
    base_prompt = (
        "You are IPC.ai, an expert AI legal assistant specializing in Indian criminal law. "
        "You have deep knowledge of the Indian Penal Code (IPC), Bharatiya Nyaya Sanhita (BNS), "
        "Code of Criminal Procedure (CrPC), Bharatiya Nagarik Suraksha Sanhita (BNSS), "
        "Indian Evidence Act (IEA), and Bharatiya Sakshya Adhiniyam (BSA). "
        "Always cite specific sections when answering. "
        "If you are unsure, say so clearly. "
        "Provide practical, actionable guidance suitable for police officers and legal professionals."
    )

    if context_type == "fir_drafting":
        base_prompt += (
            "\n\nThe user is currently drafting a First Information Report (FIR). "
            "Help them identify applicable sections, proper legal language, "
            "and ensure all required elements are covered."
        )

    return base_prompt


def _build_user_prompt(query: str, context_chunks: list[dict]) -> str:
    if context_chunks:
        context_text = "\n\n".join(
            f"[{c.get('act', 'Unknown')} Section {c.get('section', '?')}]: {c.get('text', '')}"
            for c in context_chunks
        )
        return (
            f"Based on the following legal references:\n\n{context_text}\n\n"
            f"Answer this question: {query}"
        )
    return query


async def _call_groq(system_prompt: str, user_prompt: str, api_key: str) -> str:
    """Call Groq API for LLM completion."""
    import httpx

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.1-70b-versatile",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 2048,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


def _fallback_response(query: str) -> str:
    """Fallback when Groq API is not configured or fails."""
    return (
        f"I understand your question about: '{query}'. "
        "The AI assistant requires a Groq API key to be configured in the backend .env file. "
        "Once configured, I'll be able to provide detailed legal guidance with specific "
        "section references from IPC/BNS, CrPC/BNSS, and IEA/BSA."
    )


def _extract_sources(context_chunks: list[dict]) -> list[dict]:
    """Extract source references from retrieved context chunks."""
    sources = []
    for chunk in context_chunks:
        sources.append({
            "act": chunk.get("act"),
            "section": chunk.get("section"),
            "title": chunk.get("title"),
            "text_snippet": chunk.get("text", "")[:200],
        })
    return sources
