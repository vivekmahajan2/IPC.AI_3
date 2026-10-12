from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime
from ..core.database import Base


class StatuteChunk(Base):
    __tablename__ = "statute_chunks"

    id = Column(Integer, primary_key=True, index=True)
    act = Column(String(10), nullable=False, index=True)
    section = Column(String(50), nullable=False)
    chunk_text = Column(Text, nullable=False)
    title = Column(String(500), nullable=True)
    # embedding column would be added via pgvector when needed
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
