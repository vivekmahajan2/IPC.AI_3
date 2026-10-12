import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text, JSON,
    Enum as SAEnum
)
from ..core.database import Base


class FIRStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    FINALIZED = "finalized"


class FIRDraft(Base):
    __tablename__ = "fir_drafts"

    id = Column(Integer, primary_key=True, index=True)
    client_uuid = Column(String(36), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    fir_number = Column(String(100), nullable=True)

    # Incident details as structured JSON
    incident_details = Column(JSON, nullable=False, default=dict)
    # e.g., {"complainant_name": "", "complainant_address": "", "incident_date": "",
    #        "incident_time": "", "incident_place": "", "accused_name": "",
    #        "accused_description": "", "description": "", "witness_details": ""}

    sections_applied = Column(JSON, default=list)
    status = Column(SAEnum(FIRStatus), default=FIRStatus.DRAFT, nullable=False, index=True)

    # Review fields
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_comments = Column(Text, nullable=True)

    # PDF
    pdf_url = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
