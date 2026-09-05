import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, Enum as SAEnum, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    SALES_REP = "SALES_REP"
    SALES_MANAGER = "SALES_MANAGER"
    FINANCE = "FINANCE"
    CUSTOMER = "CUSTOMER"


class CustomerTier(str, enum.Enum):
    BRONZE = "BRONZE"
    SILVER = "SILVER"
    GOLD = "GOLD"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.SALES_REP)
    avatar = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    customer_tier = Column(SAEnum(CustomerTier), nullable=True)
    company_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    magic_link_token = Column(String, nullable=True)
    magic_link_expiry = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    quotations_as_rep = relationship("Quotation", foreign_keys="Quotation.rep_id", back_populates="rep")
    quotations_as_customer = relationship("Quotation", foreign_keys="Quotation.customer_id", back_populates="customer")
    approvals = relationship("Approval", back_populates="approver")
    audit_logs = relationship("AuditLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
