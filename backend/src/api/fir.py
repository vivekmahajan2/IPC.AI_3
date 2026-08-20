from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
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
    if not fir.pdf_url:
        raise HTTPException(status_code=404, detail="PDF not generated yet")

    # Try to generate a signed URL from R2, otherwise return the stored key
    from ..services.storage_service import get_signed_url
    signed_url = await get_signed_url(fir.pdf_url)
    return {"pdf_url": signed_url or fir.pdf_url}
