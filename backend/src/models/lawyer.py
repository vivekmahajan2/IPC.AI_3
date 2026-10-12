from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON
from ..core.database import Base


class Lawyer(Base):
    __tablename__ = "lawyers"

    id = Column(Integer, primary_key=True, index=True)
    bar_council_id = Column(String(100), unique=True, nullable=True)
    name = Column(String(255), nullable=False)
    firm_name = Column(String(255), nullable=True)
    specialization = Column(JSON, default=list)
    practicing_courts = Column(JSON, default=list)
    years_of_exp = Column(Integer, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True, index=True)
    languages = Column(JSON, default=list)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

