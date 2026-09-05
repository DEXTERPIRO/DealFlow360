import enum
import uuid
from sqlalchemy import (
    Column, String, Boolean, Numeric, Integer,
    DateTime, Enum as SAEnum, Text, ForeignKey, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class BillingCycle(str, enum.Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    max_discount = Column(Numeric(5, 2), default=15)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    sku = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"), nullable=False)
    base_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), default=0)
    tax = Column(Numeric(5, 2), default=18)
    unit = Column(String, default="piece")
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_subscription = Column(Boolean, default=False)
    billing_cycle = Column(SAEnum(BillingCycle), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("ProductCategory", back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    warehouse_stocks = relationship("WarehouseStock", back_populates="product")
    upsell_rules = relationship("UpsellRule", foreign_keys="UpsellRule.source_product_id", back_populates="source_product")
    price_list_items = relationship("PriceListItem", back_populates="product")
    quotation_lines = relationship("QuotationLine", back_populates="product")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    name = Column(String, nullable=False)
    attribute = Column(String, nullable=False)
    value = Column(String, nullable=False)
    extra_price = Column(Numeric(12, 2), default=0)
    is_active = Column(Boolean, default=True)

    product = relationship("Product", back_populates="variants")


class DiscountTier(Base):
    __tablename__ = "discount_tiers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tier = Column(String, nullable=False, unique=True)
    max_discount = Column(Numeric(5, 2), nullable=False)
    requires_manager = Column(Boolean, default=False)
    requires_finance = Column(Boolean, default=False)


class PriceList(Base):
    __tablename__ = "price_lists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    tier = Column(String, nullable=True)
    currency = Column(String, default="INR")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("PriceListItem", back_populates="price_list", cascade="all, delete-orphan")


class PriceListItem(Base):
    __tablename__ = "price_list_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    price_list_id = Column(UUID(as_uuid=True), ForeignKey("price_lists.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)

    price_list = relationship("PriceList", back_populates="items")
    product = relationship("Product", back_populates="price_list_items")


class UpsellRule(Base):
    __tablename__ = "upsell_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    target_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    score = Column(Integer, default=50)
    is_promoted = Column(Boolean, default=False)
    min_margin = Column(Numeric(5, 2), default=0)

    source_product = relationship("Product", foreign_keys=[source_product_id], back_populates="upsell_rules")
    target_product = relationship("Product", foreign_keys=[target_product_id])


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    billing_cycle = Column(SAEnum(BillingCycle), nullable=False)
    prorate_on_change = Column(Boolean, default=True)
    partial_refund = Column(Boolean, default=False)
    cancel_policy = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
