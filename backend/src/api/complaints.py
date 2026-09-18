import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.dependencies import get_current_user, require_role
from ..models.user import User
from ..models.complaint import Complaint, ComplaintStatus
from ..models.fir import FIRDraft, FIRStatus
from ..models.audit import AuditLog

router = APIRouter(prefix="/complaints", tags=["Complaints"])


# --- Schemas ---

class ComplaintCreateRequest(BaseModel):
    title: str
    incident_details: dict


class ComplaintResponse(BaseModel):
    id: int
    complaint_number: str
    user_id: int
    assigned_officer_id: Optional[int] = None
    title: str
    incident_details: dict
    status: str
    fir_id: Optional[int] = None
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConvertToFIRResponse(BaseModel):
    message: str
    complaint_id: int
    fir_id: int


# --- Helpers ---

async def generate_complaint_number(db: AsyncSession) -> str:
    year = datetime.now(timezone.utc).year
    result = await db.execute(
        select(func.count(Complaint.id)).where(
            Complaint.complaint_number.like(f"CMP-{year}-%")
        )
    )
    count = result.scalar() or 0
    return f"CMP-{year}-{count + 1:04d}"


# --- Endpoints ---

@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    request: ComplaintCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Citizens submit an official criminal/incident complaint."""
    cmp_number = await generate_complaint_number(db)

    complaint = Complaint(
        complaint_number=cmp_number,
        user_id=current_user.id,
        title=request.title,
        incident_details=request.incident_details,
        status=ComplaintStatus.SUBMITTED,
    )
    db.add(complaint)
    await db.commit()
    await db.refresh(complaint)
    return complaint


@router.get("/my", response_model=List[ComplaintResponse])
async def list_my_complaints(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all complaints submitted by the authenticated citizen."""
    result = await db.execute(
        select(Complaint)
        .where(Complaint.user_id == current_user.id)
        .order_by(desc(Complaint.created_at))
    )
    return result.scalars().all()


@router.get("", response_model=List[ComplaintResponse])
async def list_all_complaints(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("police", "superior", "admin")),
):
    """Police officers & superiors view submitted citizen complaints for inquiry."""
    query = select(Complaint).order_by(desc(Complaint.created_at))
    if status_filter:
        query = query.where(Complaint.status == status_filter)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{complaint_id}", response_model=ComplaintResponse)
async def get_complaint(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Authorize: only the filing citizen or police/admin can view
    if current_user.role.value not in ("police", "superior", "admin") and complaint.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return complaint


@router.post("/{complaint_id}/convert-to-fir", response_model=ConvertToFIRResponse)
async def convert_complaint_to_fir(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("police", "superior", "admin")),
):
    """
    Sub-Inspector converts an authorized citizen complaint into a formal FIR Draft.
    Prepopulates complainant, incident timestamp/location, and incident narrative.
    """
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if complaint.status == ComplaintStatus.CONVERTED_TO_FIR and complaint.fir_id:
        return ConvertToFIRResponse(
            message="Complaint has already been converted to an FIR",
            complaint_id=complaint.id,
            fir_id=complaint.fir_id,
        )

    # Create new FIR Draft
    new_fir = FIRDraft(
        client_uuid=str(uuid.uuid4()),
        user_id=current_user.id,
        title=complaint.title,
        incident_details=complaint.incident_details or {},
        sections_applied=[],
        status=FIRStatus.DRAFT,
    )
    db.add(new_fir)
    await db.flush()

    # Update Complaint record
    complaint.status = ComplaintStatus.CONVERTED_TO_FIR
    complaint.fir_id = new_fir.id
    complaint.assigned_officer_id = current_user.id
    complaint.updated_at = datetime.now(timezone.utc)

    # Log audit
    audit = AuditLog(
        fir_id=new_fir.id,
        user_id=current_user.id,
        action="converted_from_complaint",
        details={"complaint_number": complaint.complaint_number, "complaint_id": complaint.id},
    )
    db.add(audit)

    await db.commit()
    await db.refresh(new_fir)
    await db.refresh(complaint)

    return ConvertToFIRResponse(
        message="Complaint successfully converted to official FIR draft",
        complaint_id=complaint.id,
        fir_id=new_fir.id,
    )
