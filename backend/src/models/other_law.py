from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime
from ..core.database import Base


class OtherLawStatute(Base):
    __tablename__ = "other_law_statutes"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(100), nullable=False, index=True)
    subcategory = Column(String(100), nullable=True, index=True)
    act_name = Column(String(255), nullable=False)
    section = Column(String(100), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
