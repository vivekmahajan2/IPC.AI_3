import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum as SAEnum
)
from ..core.database import Base


class UserRole(str, enum.Enum):
    POLICE = "police"
    SUPERIOR = "superior"
    STUDENT = "student"
    ADMIN = "admin"
    LAWYER = "lawyer"
    PUBLIC = "public"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.POLICE, nullable=False)
    verified = Column(Boolean, default=False)
    otp = Column(String(6), nullable=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    badge_number = Column(String(50), nullable=True)
    station = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
