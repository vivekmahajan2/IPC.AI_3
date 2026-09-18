import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text, JSON,
    Enum as SAEnum
)
from ..core.database import Base


class ComplaintStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_INQUIRY = "under_inquiry"
    CONVERTED_TO_FIR = "converted_to_fir"
    CLOSED = "closed"


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    complaint_number = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    title = Column(String(500), nullable=False)
    incident_details = Column(JSON, nullable=False, default=dict)
    # e.g., {"complainant_name": "", "complainant_phone": "", "complainant_address": "",
    #        "incident_date": "", "incident_time": "", "incident_place": "",
    #        "description": "", "suspect_details": ""}

    status = Column(SAEnum(ComplaintStatus), default=ComplaintStatus.SUBMITTED, nullable=False, index=True)
    fir_id = Column(Integer, ForeignKey("fir_drafts.id"), nullable=True)
    remarks = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
