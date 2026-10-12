from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from ..core.database import Base


class LegalDictionary(Base):
    __tablename__ = "legal_dictionary"

    id = Column(Integer, primary_key=True, index=True)
    term = Column(String(255), unique=True, index=True, nullable=False)
    definition = Column(Text, nullable=False)
    simple_explanation = Column(Text, nullable=False)
    related_provisions = Column(JSON, default=list)
    examples = Column(Text, nullable=True)
    category = Column(String(100), index=True, default="Criminal Law")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
