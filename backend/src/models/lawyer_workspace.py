from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from ..core.database import Base


class LawyerCaseNote(Base):
    __tablename__ = "lawyer_case_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    case_title = Column(String(255), nullable=False, index=True)
    court_name = Column(String(200), nullable=True)
    case_number = Column(String(100), nullable=True)
    sections_involved = Column(JSON, default=list)  # e.g. ["BNS 103", "BNS 303"]
    client_name = Column(String(200), nullable=True)
    notes_content = Column(Text, nullable=False)
    hearing_date = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="case_notes")


class LawyerBookmark(Base):
    __tablename__ = "lawyer_bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item_type = Column(String(50), nullable=False)  # "judgment", "statute", "dictionary"
    item_id = Column(String(100), nullable=True)
    title = Column(String(255), nullable=False)
    citation = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="bookmarks")
