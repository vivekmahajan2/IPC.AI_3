from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
from ..core.database import Base


class Judgment(Base):
    __tablename__ = "judgments"

    id = Column(Integer, primary_key=True, index=True)
    case_title = Column(String(500), nullable=False)
    court_name = Column(String(255), nullable=False, index=True)
    bench = Column(String(500), nullable=True)
    judgment_date = Column(Date, nullable=True)
    citation = Column(String(255), nullable=True, index=True)
    case_number = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    full_text_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class JudgmentChunk(Base):
    __tablename__ = "judgment_chunks"

    id = Column(Integer, primary_key=True, index=True)
    judgment_id = Column(Integer, ForeignKey("judgments.id"), nullable=False, index=True)
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    # embedding column would be added via pgvector when needed
