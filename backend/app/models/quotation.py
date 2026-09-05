import enum
import uuid
from sqlalchemy import (
    Column, String, Boolean, Numeric, Integer, Text,
    DateTime, Enum as SAEnum, ForeignKey, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class QuotationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_MANAGER = "PENDING_MANAGER"
    PENDING_FINANCE = "PENDING_FINANCE"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SENT_TO_CUSTOMER = "SENT_TO_CUSTOMER"
    UNDER_NEGOTIATION = "UNDER_NEGOTIATION"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class LineType(str, enum.Enum):
    ONE_TIME = "ONE_TIME"
    SUBSCRIPTION = "SUBSCRIPTION"


class FulfillmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PARTIALLY_FULFILLED = "PARTIALLY_FULFILLED"
    FULFILLED = "FULFILLED"
    BACKORDERED = "BACKORDERED"


class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_number = Column(String, unique=True, nullable=False, index=True)
    rep_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    customer_tier = Column(String, default="BRONZE")
    status = Column(SAEnum(QuotationStatus), default=QuotationStatus.DRAFT)
    blended_risk_score = Column(Numeric(6, 2), default=0)
    subtotal = Column(Numeric(14, 2), default=0)
    tax_amount = Column(Numeric(14, 2), default=0)
    discount_amount = Column(Numeric(14, 2), default=0)
    total = Column(Numeric(14, 2), default=0)
    margin = Column(Numeric(6, 2), default=0)
    portal_token = Column(String, unique=True, nullable=True)
    rep_notes = Column(Text, nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    rep = relationship("User", foreign_keys=[rep_id], back_populates="quotations_as_rep")
    customer = relationship("User", foreign_keys=[customer_id], back_populates="quotations_as_customer")
    lines = relationship("QuotationLine", back_populates="quotation", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="quotation", cascade="all, delete-orphan")
    negotiations = relationship("Negotiation", back_populates="quotation", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="quotation")
    subscriptions = relationship("Subscription", back_populates="quotation")
    audit_logs = relationship("AuditLog", back_populates="quotation")
    fulfillments = relationship("FulfillmentLine", back_populates="quotation")


class QuotationLine(Base):
    __tablename__ = "quotation_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id"), nullable=True)
    line_type = Column(SAEnum(LineType), default=LineType.ONE_TIME)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), default=0)
    discount = Column(Numeric(5, 2), default=0)
    tax = Column(Numeric(5, 2), default=18)
    line_total = Column(Numeric(14, 2), default=0)
    margin = Column(Numeric(6, 2), default=0)
    notes = Column(Text, nullable=True)

    quotation = relationship("Quotation", back_populates="lines")
    product = relationship("Product", back_populates="quotation_lines")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.id"), nullable=False)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    level = Column(Integer, default=1)
    action = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    quotation = relationship("Quotation", back_populates="approvals")
    approver = relationship("User", back_populates="approvals")


class Negotiation(Base):
    __tablename__ = "negotiations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.id"), nullable=False)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    message = Column(Text, nullable=True)
    counter_discount = Column(Numeric(5, 2), nullable=True)
    status = Column(String, default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    quotation = relationship("Quotation", back_populates="negotiations")


class FulfillmentLine(Base):
    __tablename__ = "fulfillment_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.id"), nullable=False)
    warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=True)
    status = Column(SAEnum(FulfillmentStatus), default=FulfillmentStatus.PENDING)
    fulfilled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    quotation = relationship("Quotation", back_populates="fulfillments")
    warehouse = relationship("Warehouse")
