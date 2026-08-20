"""FIR business logic service — PDF generation, numbering, finalization."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models.fir import FIRDraft, FIRStatus
from ..models.audit import AuditLog
from .pdf_service import generate_fir_pdf
from .storage_service import upload_pdf


async def generate_fir_number(db: AsyncSession, station: str = "PS") -> str:
    """
    Generate a unique FIR number in the format: FIR-{STATION}-{YEAR}-{SEQ}
    e.g., FIR-PS-2026-0042
    """
    year = datetime.now(timezone.utc).year
    result = await db.execute(
        select(func.count(FIRDraft.id)).where(
            FIRDraft.fir_number.isnot(None),
            FIRDraft.fir_number.like(f"FIR-{station}-{year}-%"),
        )
    )
    count = result.scalar() or 0
    return f"FIR-{station}-{year}-{count + 1:04d}"


async def finalize_fir_with_pdf(
    fir: FIRDraft,
    db: AsyncSession,
    user_id: int,
    officer_name: str = "",
    station: str = "",
) -> FIRDraft:
    """
    Finalize an approved FIR:
    1. Generate FIR number
    2. Generate PDF
    3. Upload to R2 (if configured)
    4. Update FIR record
    """
    # Generate FIR number
    if not fir.fir_number:
        fir.fir_number = await generate_fir_number(db, station or "PS")

    # Generate PDF
    pdf_bytes = generate_fir_pdf(
        fir_number=fir.fir_number,
        title=fir.title,
        incident_details=fir.incident_details or {},
        sections_applied=fir.sections_applied or [],
        status="finalized",
        created_at=fir.created_at,
        officer_name=officer_name,
        station=station,
    )

    # Upload to R2
    pdf_key = f"firs/{fir.fir_number}.pdf"
    uploaded_key = await upload_pdf(pdf_bytes, pdf_key)

    if uploaded_key:
        fir.pdf_url = uploaded_key
    else:
        # R2 not configured — store a placeholder path
        fir.pdf_url = pdf_key

    # Update status
    fir.status = FIRStatus.FINALIZED
    fir.updated_at = datetime.now(timezone.utc)

    # Audit log
    audit = AuditLog(
        fir_id=fir.id,
        user_id=user_id,
        action="finalized",
        details={"fir_number": fir.fir_number, "pdf_key": pdf_key},
    )
    db.add(audit)

    return fir
