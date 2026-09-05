"""
app/models/base.py
Imports all models so SQLAlchemy metadata is populated for Alembic migrations.
"""
from app.models.user import User, UserRole, CustomerTier  # noqa
from app.models.product import (  # noqa
    ProductCategory, Product, ProductVariant,
    PriceList, PriceListItem, DiscountTier,
    UpsellRule, SubscriptionPlan, BillingCycle,
)
from app.models.warehouse import Warehouse, WarehouseStock  # noqa
from app.models.quotation import (  # noqa
    Quotation, QuotationLine, Approval,
    Negotiation, QuotationStatus, LineType, FulfillmentStatus,
)
from app.models.invoice import Invoice, Subscription, InvoiceStatus  # noqa
from app.models.audit import AuditLog, Notification, AuditAction  # noqa
from app.models.system import SystemConfig  # noqa

__all__ = [
    "User", "UserRole", "CustomerTier",
    "ProductCategory", "Product", "ProductVariant",
    "PriceList", "PriceListItem", "DiscountTier", "UpsellRule",
    "SubscriptionPlan", "BillingCycle",
    "Warehouse", "WarehouseStock",
    "Quotation", "QuotationLine", "Approval", "Negotiation",
    "QuotationStatus", "LineType", "FulfillmentStatus",
    "Invoice", "Subscription", "InvoiceStatus",
    "AuditLog", "Notification", "AuditAction",
    "SystemConfig",
]
