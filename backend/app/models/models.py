from datetime import datetime
from decimal import Decimal
from enum import Enum as PyEnum
import uuid

from sqlalchemy import (
    String, Boolean, Integer, Float, DateTime, ForeignKey,
    Numeric, JSON, Enum, UniqueConstraint
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column, relationship
)

class Base(DeclarativeBase):
    pass

def gen_uuid() -> str:
    return str(uuid.uuid4())

# ---------- ENUMS ----------

class UserRole(str, PyEnum):
    ADMIN = "ADMIN"
    SALES_REP = "SALES_REP"
    SALES_MANAGER = "SALES_MANAGER"
    FINANCE = "FINANCE"
    CUSTOMER = "CUSTOMER"

class CustomerTier(str, PyEnum):
    BRONZE = "BRONZE"
    SILVER = "SILVER"
    GOLD = "GOLD"
    PLATINUM = "PLATINUM"

class QuotationStatus(str, PyEnum):
    DRAFT = "DRAFT"
    PENDING_MANAGER = "PENDING_MANAGER"
    PENDING_FINANCE = "PENDING_FINANCE"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SENT_TO_CUSTOMER = "SENT_TO_CUSTOMER"
    UNDER_NEGOTIATION = "UNDER_NEGOTIATION"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"

class LineType(str, PyEnum):
    ONE_TIME = "ONE_TIME"
    SUBSCRIPTION = "SUBSCRIPTION"

class BillingCycle(str, PyEnum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"

class FulfillmentStatus(str, PyEnum):
    PENDING = "PENDING"
    PARTIALLY_FULFILLED = "PARTIALLY_FULFILLED"
    FULFILLED = "FULFILLED"
    BACKORDERED = "BACKORDERED"

class InvoiceStatus(str, PyEnum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    CANCELLED = "CANCELLED"

class AuditAction(str, PyEnum):
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

# ---------- MODELS ----------

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, unique=True)
    password: Mapped[str] = mapped_column(String)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.SALES_REP)
    avatar: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    customer_tier: Mapped[CustomerTier | None] = mapped_column(Enum(CustomerTier), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    magic_link_token: Mapped[str | None] = mapped_column(String, nullable=True)
    magic_link_expiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    quotations_as_rep = relationship("Quotation", foreign_keys="Quotation.rep_id", back_populates="rep")
    quotations_as_customer = relationship("Quotation", foreign_keys="Quotation.customer_id", back_populates="customer")
    approvals = relationship("Approval", back_populates="approver")
    audit_logs = relationship("AuditLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")


class ProductCategory(Base):
    __tablename__ = "product_categories"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String, unique=True)
    max_discount: Mapped[float] = mapped_column(Float, default=15)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String)
    sku: Mapped[str] = mapped_column(String, unique=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("product_categories.id"))
    base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=18)
    unit: Mapped[str] = mapped_column(String, default="piece")
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_subscription: Mapped[bool] = mapped_column(Boolean, default=False)
    billing_cycle: Mapped[BillingCycle | None] = mapped_column(Enum(BillingCycle), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("ProductCategory", back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    price_list_items = relationship("PriceListItem", back_populates="product")
    quotation_lines = relationship("QuotationLine", back_populates="product")
    warehouse_stocks = relationship("WarehouseStock", back_populates="product")
    upsell_rules = relationship("UpsellRule", foreign_keys="UpsellRule.source_product_id", back_populates="source_product")


class ProductVariant(Base):
    __tablename__ = "product_variants"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    attribute: Mapped[str] = mapped_column(String)
    value: Mapped[str] = mapped_column(String)
    extra_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    product = relationship("Product", back_populates="variants")


class PriceList(Base):
    __tablename__ = "price_lists"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String)
    tier: Mapped[CustomerTier] = mapped_column(Enum(CustomerTier))
    currency: Mapped[str] = mapped_column(String, default="INR")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    items = relationship("PriceListItem", back_populates="price_list", cascade="all, delete-orphan")


class PriceListItem(Base):
    __tablename__ = "price_list_items"
    __table_args__ = (UniqueConstraint("price_list_id", "product_id", name="uq_price_list_product"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    price_list_id: Mapped[str] = mapped_column(ForeignKey("price_lists.id", ondelete="CASCADE"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    price_list = relationship("PriceList", back_populates="items")
    product = relationship("Product", back_populates="price_list_items")


class DiscountTier(Base):
    __tablename__ = "discount_tiers"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    tier: Mapped[CustomerTier] = mapped_column(Enum(CustomerTier), unique=True)
    max_discount: Mapped[float] = mapped_column(Float)
    requires_manager: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_finance: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Warehouse(Base):
    __tablename__ = "warehouses"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    stocks = relationship("WarehouseStock", back_populates="warehouse")
    fulfillments = relationship("FulfillmentLine", back_populates="warehouse")


class WarehouseStock(Base):
    __tablename__ = "warehouse_stocks"
    __table_args__ = (UniqueConstraint("warehouse_id", "product_id", name="uq_warehouse_product"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    warehouse_id: Mapped[str] = mapped_column(ForeignKey("warehouses.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    reserved: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    warehouse = relationship("Warehouse", back_populates="stocks")
    product = relationship("Product", back_populates="warehouse_stocks")


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String)
    billing_cycle: Mapped[BillingCycle] = mapped_column(Enum(BillingCycle))
    prorate_on_change: Mapped[bool] = mapped_column(Boolean, default=True)
    cancel_policy: Mapped[str | None] = mapped_column(String, nullable=True)
    partial_refund: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    subscriptions = relationship("Subscription", back_populates="plan")


class UpsellRule(Base):
    __tablename__ = "upsell_rules"
    __table_args__ = (UniqueConstraint("source_product_id", "target_product_id", name="uq_upsell_source_target"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    source_product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    target_product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    score: Mapped[int] = mapped_column(Integer, default=50)
    is_promoted: Mapped[bool] = mapped_column(Boolean, default=False)
    min_margin: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    source_product = relationship("Product", foreign_keys=[source_product_id], back_populates="upsell_rules")
    target_product = relationship("Product", foreign_keys=[target_product_id])


class Quotation(Base):
    __tablename__ = "quotations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    quotation_number: Mapped[str] = mapped_column(String, unique=True)
    rep_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    customer_tier: Mapped[CustomerTier] = mapped_column(Enum(CustomerTier), default=CustomerTier.BRONZE)
    status: Mapped[QuotationStatus] = mapped_column(Enum(QuotationStatus), default=QuotationStatus.DRAFT)
    blended_risk_score: Mapped[float] = mapped_column(Float, default=0)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    margin: Mapped[float] = mapped_column(Float, default=0)
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    portal_token: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    customer_notes: Mapped[str | None] = mapped_column(String, nullable=True)
    rep_notes: Mapped[str | None] = mapped_column(String, nullable=True)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rep = relationship("User", foreign_keys=[rep_id], back_populates="quotations_as_rep")
    customer = relationship("User", foreign_keys=[customer_id], back_populates="quotations_as_customer")
    lines = relationship("QuotationLine", back_populates="quotation", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="quotation", cascade="all, delete-orphan")
    fulfillments = relationship("FulfillmentLine", back_populates="quotation", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="quotation", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="quotation")
    audit_logs = relationship("AuditLog", back_populates="quotation")
    negotiations = relationship("Negotiation", back_populates="quotation", cascade="all, delete-orphan")


class QuotationLine(Base):
    __tablename__ = "quotation_lines"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    quotation_id: Mapped[str] = mapped_column(ForeignKey("quotations.id", ondelete="CASCADE"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    variant_id: Mapped[str | None] = mapped_column(String, nullable=True)
    line_type: Mapped[LineType] = mapped_column(Enum(LineType), default=LineType.ONE_TIME)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    discount: Mapped[float] = mapped_column(Float, default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=18)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    margin: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    quotation = relationship("Quotation", back_populates="lines")
    product = relationship("Product", back_populates="quotation_lines")


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    quotation_id: Mapped[str] = mapped_column(ForeignKey("quotations.id", ondelete="CASCADE"))
    approver_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    level: Mapped[int] = mapped_column(Integer)
    action: Mapped[str | None] = mapped_column(String, nullable=True)
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    quotation = relationship("Quotation", back_populates="approvals")
    approver = relationship("User", back_populates="approvals")


class FulfillmentLine(Base):
    __tablename__ = "fulfillment_lines"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    quotation_id: Mapped[str] = mapped_column(ForeignKey("quotations.id", ondelete="CASCADE"))
    warehouse_id: Mapped[str | None] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    quantity_needed: Mapped[int] = mapped_column(Integer)
    quantity_fulfilled: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[FulfillmentStatus] = mapped_column(Enum(FulfillmentStatus), default=FulfillmentStatus.PENDING)
    is_backorder: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    quotation = relationship("Quotation", back_populates="fulfillments")
    warehouse = relationship("Warehouse", back_populates="fulfillments")


class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    quotation_id: Mapped[str] = mapped_column(ForeignKey("quotations.id", ondelete="CASCADE"))
    plan_id: Mapped[str] = mapped_column(ForeignKey("subscription_plans.id"))
    product_id: Mapped[str] = mapped_column(String)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    start_date: Mapped[datetime] = mapped_column(DateTime)
    next_billing_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    quotation = relationship("Quotation", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    invoice_number: Mapped[str] = mapped_column(String, unique=True)
    quotation_id: Mapped[str] = mapped_column(ForeignKey("quotations.id"))
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime)
    payment_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    quotation = relationship("Quotation", back_populates="invoices")


class Negotiation(Base):
    __tablename__ = "negotiations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    quotation_id: Mapped[str] = mapped_column(ForeignKey("quotations.id", ondelete="CASCADE"))
    requested_by: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(String)
    counter_discount: Mapped[float | None] = mapped_column(Float, nullable=True)
    line_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    quotation = relationship("Quotation", back_populates="negotiations")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    quotation_id: Mapped[str | None] = mapped_column(ForeignKey("quotations.id"), nullable=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction))
    details: Mapped[str | None] = mapped_column(String, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    quotation = relationship("Quotation", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(String)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    link: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="notifications")


class SystemConfig(Base):
    __tablename__ = "system_configs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    key: Mapped[str] = mapped_column(String, unique=True)
    value: Mapped[str] = mapped_column(String)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
