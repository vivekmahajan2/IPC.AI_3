from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.dependencies import get_current_user, require_role
from ..models.user import User
from ..models.fir import FIRDraft, FIRStatus
from ..models.audit import AuditLog

router = APIRouter(prefix="/fir", tags=["FIR"])


# --- Schemas ---

class FIRCreateRequest(BaseModel):
    client_uuid: str
    title: str
    incident_details: dict = {}
    sections_applied: List[str] = []


class FIRUpdateRequest(BaseModel):
    title: Optional[str] = None
    incident_details: Optional[dict] = None
    sections_applied: Optional[List[str]] = None


class FIRResponse(BaseModel):
    id: int
    client_uuid: str
    user_id: int
    title: str
    fir_number: Optional[str] = None
    incident_details: dict
    sections_applied: List[str]
    status: str
    reviewer_id: Optional[int] = None
    review_comments: Optional[str] = None
    pdf_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewRequest(BaseModel):
    comments: Optional[str] = None


# --- Helpers ---

async def log_audit(db: AsyncSession, fir_id: int, user_id: int, action: str, details: dict = None):
    audit = AuditLog(
        fir_id=fir_id,
        user_id=user_id,
        action=action,
        details=details or {},
    )
    db.add(audit)


def fir_to_response(fir: FIRDraft) -> dict:
    return {
        "id": fir.id,
        "client_uuid": fir.client_uuid,
        "user_id": fir.user_id,
        "title": fir.title,
        "fir_number": fir.fir_number,
        "incident_details": fir.incident_details or {},
        "sections_applied": fir.sections_applied or [],
        "status": fir.status.value if isinstance(fir.status, FIRStatus) else fir.status,
        "reviewer_id": fir.reviewer_id,
        "review_comments": fir.review_comments,
        "pdf_url": fir.pdf_url,
        "created_at": fir.created_at.isoformat() if fir.created_at else None,
        "updated_at": fir.updated_at.isoformat() if fir.updated_at else None,
    }


# --- Endpoints ---

@router.post("", response_model=FIRResponse)
async def create_or_upsert_fir(
    request: FIRCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("police", "superior", "admin")),
):
    # Check if client_uuid already exists (idempotent upsert)
    result = await db.execute(
        select(FIRDraft).where(FIRDraft.client_uuid == request.client_uuid)
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your FIR draft")
        if existing.status != FIRStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Can only update drafts")

        existing.title = request.title
        existing.incident_details = request.incident_details
        existing.sections_applied = request.sections_applied
        existing.updated_at = datetime.now(timezone.utc)
        await log_audit(db, existing.id, current_user.id, "updated")
        await db.flush()
        await db.refresh(existing)
        return existing

    fir = FIRDraft(
        client_uuid=request.client_uuid,
        user_id=current_user.id,
        title=request.title,
        incident_details=request.incident_details,
        sections_applied=request.sections_applied,
    )
    db.add(fir)
    await db.flush()
    await db.refresh(fir)
    await log_audit(db, fir.id, current_user.id, "created")

    return fir


@router.get("", response_model=List[FIRResponse])
async def list_firs(
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(FIRDraft)

    # Superiors see submitted/under_review FIRs; others see only their own
    if current_user.role.value == "superior":
        if status_filter:
            query = query.where(FIRDraft.status == FIRStatus(status_filter))
    elif current_user.role.value == "admin":
        if status_filter:
            query = query.where(FIRDraft.status == FIRStatus(status_filter))
    else:
        query = query.where(FIRDraft.user_id == current_user.id)
        if status_filter:
            query = query.where(FIRDraft.status == FIRStatus(status_filter))

    query = query.order_by(desc(FIRDraft.updated_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    firs = result.scalars().all()

    return firs


@router.get("/{fir_id}", response_model=FIRResponse)
async def get_fir(
    fir_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FIRDraft).where(FIRDraft.id == fir_id))
    fir = result.scalar_one_or_none()

    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    # Access check
    if current_user.role.value not in ("superior", "admin") and fir.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return fir


@router.put("/{fir_id}", response_model=FIRResponse)
async def update_fir(
    fir_id: int,
    request: FIRUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FIRDraft).where(FIRDraft.id == fir_id))
    fir = result.scalar_one_or_none()

    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if fir.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your FIR draft")
    if fir.status not in (FIRStatus.DRAFT, FIRStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Can only edit drafts or rejected FIRs")

    if request.title is not None:
        fir.title = request.title
    if request.incident_details is not None:
        fir.incident_details = request.incident_details
    if request.sections_applied is not None:
        fir.sections_applied = request.sections_applied

    fir.updated_at = datetime.now(timezone.utc)
    if fir.status == FIRStatus.REJECTED:
        fir.status = FIRStatus.DRAFT

    await log_audit(db, fir.id, current_user.id, "updated")
    await db.flush()
    await db.refresh(fir)
    return fir


@router.post("/{fir_id}/submit", response_model=FIRResponse)
async def submit_fir(
    fir_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("police", "superior", "admin")),
):
    result = await db.execute(select(FIRDraft).where(FIRDraft.id == fir_id))
    fir = result.scalar_one_or_none()

    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if fir.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your FIR")
    if fir.status != FIRStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only drafts can be submitted")

    fir.status = FIRStatus.SUBMITTED
    fir.updated_at = datetime.now(timezone.utc)
    await log_audit(db, fir.id, current_user.id, "submitted")
    await db.flush()
    await db.refresh(fir)
    return fir


@router.post("/{fir_id}/approve", response_model=FIRResponse)
async def approve_fir(
    fir_id: int,
    request: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("superior", "admin", verified=True)),
):
    result = await db.execute(select(FIRDraft).where(FIRDraft.id == fir_id))
    fir = result.scalar_one_or_none()

    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if fir.status not in (FIRStatus.SUBMITTED, FIRStatus.UNDER_REVIEW):
        raise HTTPException(status_code=400, detail="FIR is not pending review")

    fir.status = FIRStatus.APPROVED
    fir.reviewer_id = current_user.id
    fir.review_comments = request.comments
    fir.updated_at = datetime.now(timezone.utc)
    await log_audit(db, fir.id, current_user.id, "approved", {"comments": request.comments})
    await db.flush()
    await db.refresh(fir)
    return fir


@router.post("/{fir_id}/reject", response_model=FIRResponse)
async def reject_fir(
    fir_id: int,
    request: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("superior", "admin", verified=True)),
):
    result = await db.execute(select(FIRDraft).where(FIRDraft.id == fir_id))
    fir = result.scalar_one_or_none()

    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if fir.status not in (FIRStatus.SUBMITTED, FIRStatus.UNDER_REVIEW):
        raise HTTPException(status_code=400, detail="FIR is not pending review")

    fir.status = FIRStatus.REJECTED
    fir.reviewer_id = current_user.id
    fir.review_comments = request.comments
    fir.updated_at = datetime.now(timezone.utc)
    await log_audit(db, fir.id, current_user.id, "rejected", {"comments": request.comments})
    await db.flush()
    await db.refresh(fir)
    return fir


@router.post("/{fir_id}/finalize", response_model=FIRResponse)
async def finalize_fir(
    fir_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("police", "superior", "admin")),
):
    result = await db.execute(select(FIRDraft).where(FIRDraft.id == fir_id))
    fir = result.scalar_one_or_none()

    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if fir.status != FIRStatus.APPROVED:
        raise HTTPException(status_code=400, detail="FIR must be approved before finalization")

    # Generate PDF, assign FIR number, upload to R2, update status
    from ..services.fir_service import finalize_fir_with_pdf
    fir = await finalize_fir_with_pdf(
        fir=fir,
        db=db,
        user_id=current_user.id,
        officer_name=current_user.full_name,
        station=current_user.station or "",
    )
    await db.flush()
    await db.refresh(fir)
    return fir


class AuditLogResponse(BaseModel):
    id: int
    action: str
    user_id: int
    user_name: Optional[str] = None
    details: Optional[dict] = None
    timestamp: datetime

    class Config:
        from_attributes = True


@router.get("/{fir_id}/audit", response_model=List[AuditLogResponse])
async def get_fir_audit_trail(
    fir_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full chronological audit trail for this FIR."""
    result = await db.execute(select(FIRDraft).where(FIRDraft.id == fir_id))
    fir = result.scalar_one_or_none()
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if current_user.role.value not in ("superior", "admin") and fir.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(AuditLog, User.full_name)
        .join(User, AuditLog.user_id == User.id, isouter=True)
        .where(AuditLog.fir_id == fir_id)
        .order_by(AuditLog.timestamp.asc())
    )
    rows = result.all()
    audit_trail = []
    for audit, user_name in rows:
        audit_trail.append(
            AuditLogResponse(
                id=audit.id,
                action=audit.action,
                user_id=audit.user_id,
                user_name=user_name,
                details=audit.details,
                timestamp=audit.timestamp,
            )
        )
    return audit_trail


@router.get("/{fir_id}/pdf/stream")
async def stream_fir_pdf(
    fir_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dynamically generate and stream the official Indian FIR PDF format."""
    result = await db.execute(select(FIRDraft).where(FIRDraft.id == fir_id))
    fir = result.scalar_one_or_none()
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if current_user.role.value not in ("superior", "admin") and fir.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    from ..services.pdf_service import generate_fir_pdf
    pdf_bytes = generate_fir_pdf(
        fir_number=fir.fir_number or f"FIR-PS-{fir.id}",
        title=fir.title,
        incident_details=fir.incident_details or {},
        sections_applied=fir.sections_applied or [],
        status=fir.status.value,
        created_at=fir.created_at,
        officer_name=current_user.full_name or "Investigating Officer",
        station=current_user.station or "Central Police Station",
    )
    filename = f"{fir.fir_number or f'FIR_{fir.id}'}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"'
        },
    )


@router.get("/{fir_id}/pdf")
async def get_fir_pdf(
    fir_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FIRDraft).where(FIRDraft.id == fir_id))
    fir = result.scalar_one_or_none()

    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    if current_user.role.value not in ("superior", "admin") and fir.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if not fir.pdf_url and fir.status != FIRStatus.FINALIZED:
        raise HTTPException(status_code=400, detail="PDF is only available after FIR is finalized")

    # Try to generate a signed URL from R2, otherwise provide direct stream URL
    from ..services.storage_service import get_signed_url
    signed_url = await get_signed_url(fir.pdf_url) if fir.pdf_url else None
    stream_url = f"/fir/{fir_id}/pdf/stream"

    return {
        "pdf_url": signed_url or stream_url,
        "fir_number": fir.fir_number,
        "is_direct_stream": signed_url is None,
    }


class ProceduralStep(BaseModel):
    id: str
    bnss_section: str
    title: str
    category: str
    priority: str  # HIGH, MEDIUM, STANDARD
    description: str
    mandatory: bool


class ProceduralSuggestionsResponse(BaseModel):
    fir_id: int
    fir_number: Optional[str] = None
    summary: str
    steps: List[ProceduralStep]


@router.get("/{fir_id}/procedural-suggestions", response_model=ProceduralSuggestionsResponse)
async def get_fir_procedural_suggestions(
    fir_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Automatic Procedural Suggestions Engine (ps.md Section 3.C):
    Analyzes facts and applied sections to recommend context-aware BNSS investigation proceedings.
    """
    result = await db.execute(select(FIRDraft).where(FIRDraft.id == fir_id))
    fir = result.scalar_one_or_none()
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    sections = [s.upper() for s in (fir.sections_applied or [])]
    details = fir.incident_details or {}

    steps: List[ProceduralStep] = []

    # Step 1: Mandatory Electronic Audio-Video Recording of Search & Seizure
    steps.append(
        ProceduralStep(
            id="bnss-105",
            bnss_section="Section 105 BNSS",
            title="Audio-Video Electronic Recording of Search & Seizure",
            category="Evidence Preservation",
            priority="HIGH",
            description="All searches of places and seizure of articles/weapons must be recorded using mobile/electronic audio-video recording. Forward footage to the District Magistrate without delay.",
            mandatory=True,
        )
    )

    # Check for severe offences (7 years or more)
    severe_keywords = ["302", "103", "304", "105", "376", "63", "307", "109", "395", "310", "392", "309"]
    is_heinous = any(any(k in s for k in severe_keywords) for s in sections)

    # Step 2: Forensic Team Crime Scene Visit (Section 176(3) BNSS)
    if is_heinous or details.get("property_value"):
        steps.append(
            ProceduralStep(
                id="bnss-176-3",
                bnss_section="Section 176(3) BNSS",
                title="Mandatory Forensic Expert Crime Scene Inspection",
                category="Forensic Science",
                priority="HIGH",
                description="For offences punishable with 7+ years imprisonment, the Investigating Officer must requisition forensic experts to inspect the crime scene, collect physical samples, and video-record the process.",
                mandatory=is_heinous,
            )
        )

    # Step 3: Arrest Procedure & Section 35 BNSS Compliance
    if is_heinous:
        steps.append(
            ProceduralStep(
                id="bnss-35-severe",
                bnss_section="Section 35 & 58 BNSS",
                title="Arrest of Accused & Production within 24 Hours",
                category="Arrest & Custody",
                priority="HIGH",
                description="Arrest authorized without warrant for grave cognizable offences. Accused must be produced before the nearest Judicial Magistrate within 24 hours excluding travel time.",
                mandatory=True,
            )
        )
    else:
        steps.append(
            ProceduralStep(
                id="bnss-35-notice",
                bnss_section="Section 35(3) BNSS",
                title="Issue Notice of Appearance (Arnesh Kumar Compliance)",
                category="Notice & Summons",
                priority="MEDIUM",
                description="For offences punishable with imprisonment up to 7 years, direct arrest is restricted. Issue a formal Notice of Appearance under Section 35(3) BNSS requiring the accused to cooperate with inquiry.",
                mandatory=True,
            )
        )

    # Step 4: Medical Examination of Accused (Section 53 BNSS)
    steps.append(
        ProceduralStep(
            id="bnss-53",
            bnss_section="Section 53 BNSS",
            title="Medical Examination of Arrested Person",
            category="Medical & Health",
            priority="MEDIUM",
            description="Medical examination by a registered medical practitioner is mandatory immediately after arrest. If the arrested person or victim is female, the examination must be conducted by or under supervision of a female medical officer.",
            mandatory=True,
        )
    )

    # Step 5: Recording of Statements (Section 180 BNSS)
    steps.append(
        ProceduralStep(
            id="bnss-180",
            bnss_section="Section 180 BNSS",
            title="Recording of Witness Statements via Electronic Means",
            category="Investigation",
            priority="STANDARD",
            description="Examine persons acquainted with the facts. Statements may be recorded by audio-video electronic means as permitted under Section 180 BNSS.",
            mandatory=False,
        )
    )

    # Step 6: Case Diary Maintenance (Section 192 BNSS)
    steps.append(
        ProceduralStep(
            id="bnss-192",
            bnss_section="Section 192 BNSS",
            title="Daily Maintenance of Police Case Diary",
            category="Documentation",
            priority="HIGH",
            description="Enter day-by-day proceedings of investigation in the prescribed Case Diary, including time of information, places visited, and statement summaries.",
            mandatory=True,
        )
    )

    # Step 7: Statutory Final Report / Charge Sheet Deadline (Section 193 BNSS)
    deadline_days = 90 if is_heinous else 60
    steps.append(
        ProceduralStep(
            id="bnss-193",
            bnss_section="Section 193 BNSS",
            title=f"Completion of Investigation within {deadline_days} Days",
            category="Statutory Deadline",
            priority="HIGH",
            description=f"Investigation should be completed without unnecessary delay. Final Police Report (Charge Sheet) must be submitted before the Magistrate within {deadline_days} days to prevent default bail under Section 187 BNSS.",
            mandatory=True,
        )
    )

    return ProceduralSuggestionsResponse(
        fir_id=fir.id,
        fir_number=fir.fir_number,
        summary=f"Automated statutory proceedings recommendation under Bharatiya Nagarik Suraksha Sanhita (BNSS, 2023) for FIR {fir.fir_number or fir.id}.",
        steps=steps,
    )


