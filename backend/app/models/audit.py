import enum
import uuid
from sqlalchemy import (
    Column, String, Text, DateTime, Enum as SAEnum,
    ForeignKey, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class AuditAction(str, enum.Enum):
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RETURNED = "RETURNED"
    SENT = "SENT"
    CONFIRMED = "CONFIRMED"
    NEGOTIATED = "NEGOTIATED"
    FULFILLED = "FULFILLED"
    INVOICED = "INVOICED"
    PAID = "PAID"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(SAEnum(AuditAction), nullable=False)
    details = Column(Text, nullable=True)
    meta = Column(JSONB, nullable=True)  # renamed from 'metadata' (reserved by SQLAlchemy)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    quotation = relationship("Quotation", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    is_read = Column(String, default="false")
    link = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")
