from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, Date, DateTime, Index
from ..core.database import Base


class SectionMapping(Base):
    __tablename__ = "section_mapping"

    id = Column(Integer, primary_key=True, index=True)
    old_act = Column(String(10), nullable=False)  # IPC, CrPC, IEA
    old_section = Column(String(50), nullable=False)
    old_title = Column(String(500), nullable=True)
    old_text = Column(Text, nullable=True)
    new_act = Column(String(10), nullable=False)  # BNS, BNSS, BSA
    new_section = Column(String(50), nullable=False)
    new_title = Column(String(500), nullable=True)
    new_text = Column(Text, nullable=True)
    mapping_notes = Column(Text, nullable=True)
    is_identical = Column(Boolean, default=False)
    effective_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_old_act_section", "old_act", "old_section"),
        Index("ix_new_act_section", "new_act", "new_section"),
    )
