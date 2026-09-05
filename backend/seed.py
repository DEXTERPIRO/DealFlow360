"""seed.py — Port of prisma/seed.js for the FastAPI + SQLAlchemy backend."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.database import AsyncSessionLocal, engine
from app.models.base import *  # noqa — registers all models
from app.database import Base
from app.models.user import User, UserRole, CustomerTier
from app.models.product import (
    ProductCategory, Product, ProductVariant,
    PriceList, PriceListItem, DiscountTier, UpsellRule, SubscriptionPlan, BillingCycle,
)
from app.models.warehouse import Warehouse, WarehouseStock
from app.models.quotation import Quotation, QuotationLine, Approval, Negotiation, QuotationStatus, LineType
from app.models.invoice import Invoice, InvoiceStatus
from app.models.audit import AuditLog, AuditAction
from app.models.system import SystemConfig
from datetime import datetime, timezone, timedelta
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def main():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # ── Clear in correct FK order ─────────────────────────────────────────
        for model in [
            AuditLog, Notification if 'Notification' in dir() else type(None),
            Negotiation, Invoice, Approval, QuotationLine, Quotation,
            UpsellRule, WarehouseStock, Warehouse,
            SubscriptionPlan, PriceListItem, PriceList,
            ProductVariant, Product, ProductCategory,
            DiscountTier, SystemConfig, User,
        ]:
            if hasattr(model, '__tablename__'):
                await db.execute(delete(model))
        await db.commit()

        def h(p): return pwd_context.hash(p)

        # ── USERS ─────────────────────────────────────────────────────────────
        admin = User(name="Admin User", email="admin@dealflow.com",
                     password=h("Admin@123"), role=UserRole.ADMIN)
        rep1  = User(name="Priya Mehta", email="priya@dealflow.com",
                     password=h("Rep@123"), role=UserRole.SALES_REP)
        rep2  = User(name="Arjun Shah", email="arjun@dealflow.com",
                     password=h("Rep@123"), role=UserRole.SALES_REP)
        mgr   = User(name="Raj Patel", email="manager@dealflow.com",
                     password=h("Manager@123"), role=UserRole.SALES_MANAGER)
        fin   = User(name="Sneha Joshi", email="finance@dealflow.com",
                     password=h("Finance@123"), role=UserRole.FINANCE)
        cust1 = User(name="Acme Corp", email="buyer@acme.com",
                     password=h("Customer@123"), role=UserRole.CUSTOMER,
                     customer_tier=CustomerTier.GOLD,
                     company_name="Acme Corporation", phone="+91 9876543210")
        cust2 = User(name="Beta Industries", email="contact@beta.com",
                     password=h("Customer@123"), role=UserRole.CUSTOMER,
                     customer_tier=CustomerTier.SILVER,
                     company_name="Beta Industries Ltd", phone="+91 9765432109")
        cust3 = User(name="Gamma Retail", email="purchase@gamma.com",
                     password=h("Customer@123"), role=UserRole.CUSTOMER,
                     customer_tier=CustomerTier.BRONZE,
                     company_name="Gamma Retail Pvt Ltd")

        for u in [admin, rep1, rep2, mgr, fin, cust1, cust2, cust3]:
            db.add(u)
        await db.flush()

        # ── CATEGORIES ────────────────────────────────────────────────────────
        hw  = ProductCategory(name="Hardware", max_discount=15, description="Physical hardware products")
        svc = ProductCategory(name="Services", max_discount=10, description="Professional services")
        sw  = ProductCategory(name="Software", max_discount=20, description="Software licenses")
        sub = ProductCategory(name="Subscriptions", max_discount=25, description="Recurring plans")
        for c in [hw, svc, sw, sub]: db.add(c)
        await db.flush()

        # ── PRODUCTS ─────────────────────────────────────────────────────────
        laptop = Product(name='ProBook Laptop 15"', sku="HW-001", category_id=hw.id,
                         base_price=85000, cost_price=60000, tax=18, unit="piece",
                         description="High performance business laptop with Intel i7")
        monitor = Product(name='27" 4K Monitor', sku="HW-002", category_id=hw.id,
                          base_price=35000, cost_price=24000, tax=18, unit="piece",
                          description="Ultra sharp 4K display for professionals")
        keyboard = Product(name="Wireless Keyboard + Mouse", sku="HW-003",
                           category_id=hw.id, base_price=4500, cost_price=2800, tax=18, unit="set")
        setup = Product(name="IT Setup Service", sku="SV-001", category_id=svc.id,
                        base_price=15000, cost_price=8000, tax=18, unit="visit",
                        description="Professional IT setup and configuration")
        training = Product(name="Staff Training (1 day)", sku="SV-002", category_id=svc.id,
                           base_price=25000, cost_price=12000, tax=18, unit="day",
                           description="On-site staff training by certified trainers")
        license_p = Product(name="Office Suite License", sku="SW-001", category_id=sw.id,
                            base_price=12000, cost_price=6000, tax=18, unit="license",
                            description="Annual office productivity suite license")
        support = Product(name="Annual Support Plan", sku="SUB-001", category_id=sub.id,
                          base_price=18000, cost_price=8000, tax=18, unit="year",
                          is_subscription=True, billing_cycle=BillingCycle.YEARLY,
                          description="Priority 24/7 technical support plan")
        cloud = Product(name="Cloud Storage 1TB", sku="SUB-002", category_id=sub.id,
                        base_price=2400, cost_price=800, tax=18, unit="month",
                        is_subscription=True, billing_cycle=BillingCycle.MONTHLY,
                        description="Secure cloud storage with automated backup")

        for p in [laptop, monitor, keyboard, setup, training, license_p, support, cloud]:
            db.add(p)
        await db.flush()

        # Variants for laptop
        for v in [
            ProductVariant(product_id=laptop.id, name="RAM 8GB",  attribute="RAM", value="8GB",  extra_price=0),
            ProductVariant(product_id=laptop.id, name="RAM 16GB", attribute="RAM", value="16GB", extra_price=8000),
            ProductVariant(product_id=laptop.id, name="RAM 32GB", attribute="RAM", value="32GB", extra_price=18000),
        ]:
            db.add(v)

        # ── DISCOUNT TIERS ────────────────────────────────────────────────────
        for dt in [
            DiscountTier(tier="BRONZE", max_discount=5,  requires_manager=False, requires_finance=False),
            DiscountTier(tier="SILVER", max_discount=10, requires_manager=True,  requires_finance=False),
            DiscountTier(tier="GOLD",   max_discount=15, requires_manager=True,  requires_finance=True),
        ]:
            db.add(dt)

        # ── WAREHOUSES ────────────────────────────────────────────────────────
        main_wh = Warehouse(name="Main Warehouse", location="Mumbai, Maharashtra",  shipping_cost=500)
        east_wh = Warehouse(name="East Depot",     location="Kolkata, West Bengal", shipping_cost=800)
        west_wh = Warehouse(name="West Hub",       location="Ahmedabad, Gujarat",   shipping_cost=300)
        for w in [main_wh, east_wh, west_wh]: db.add(w)
        await db.flush()

        # ── WAREHOUSE STOCK ───────────────────────────────────────────────────
        stock_data = [
            (main_wh.id, laptop.id,    25), (main_wh.id, monitor.id,   40),
            (main_wh.id, keyboard.id,  80), (east_wh.id, laptop.id,     8),
            (east_wh.id, monitor.id,   12), (west_wh.id, laptop.id,    15),
            (west_wh.id, keyboard.id,  50), (main_wh.id, license_p.id, 999),
            (main_wh.id, support.id,  999), (main_wh.id, cloud.id,     999),
        ]
        for wid, pid, qty in stock_data:
            db.add(WarehouseStock(warehouse_id=wid, product_id=pid, quantity=qty, reserved=0))

        # ── PRICE LIST ────────────────────────────────────────────────────────
        gold_pl = PriceList(name="Gold Customer Pricing", tier="GOLD", currency="INR")
        db.add(gold_pl)
        await db.flush()
        for item in [
            PriceListItem(price_list_id=gold_pl.id, product_id=laptop.id,  price=80000),
            PriceListItem(price_list_id=gold_pl.id, product_id=monitor.id, price=32000),
            PriceListItem(price_list_id=gold_pl.id, product_id=setup.id,   price=13000),
        ]:
            db.add(item)

        # ── SUBSCRIPTION PLANS ────────────────────────────────────────────────
        db.add(SubscriptionPlan(name="Monthly Plan", billing_cycle=BillingCycle.MONTHLY,
                                prorate_on_change=True, partial_refund=True,
                                cancel_policy="30 days notice required"))
        db.add(SubscriptionPlan(name="Annual Plan", billing_cycle=BillingCycle.YEARLY,
                                prorate_on_change=True, partial_refund=False,
                                cancel_policy="Non-refundable after 30 days"))

        # ── UPSELL RULES ──────────────────────────────────────────────────────
        upsell_data = [
            (laptop.id, monitor.id,   90, True,  20),
            (laptop.id, keyboard.id,  85, False, 15),
            (laptop.id, setup.id,     70, True,  25),
            (monitor.id, keyboard.id, 75, False, 15),
            (setup.id, training.id,   80, False, 30),
            (license_p.id, support.id, 95, True, 40),
        ]
        for src, tgt, score, promoted, margin in upsell_data:
            db.add(UpsellRule(source_product_id=src, target_product_id=tgt,
                              score=score, is_promoted=promoted, min_margin=margin))

        await db.flush()

        # ── QUOTATIONS ────────────────────────────────────────────────────────
        now = datetime.now(timezone.utc)

        q1 = Quotation(
            quotation_number="QT-2024-001", rep_id=rep1.id, customer_id=cust1.id,
            customer_tier="GOLD", status=QuotationStatus.APPROVED,
            blended_risk_score=12.5, subtotal=285000, tax_amount=51300,
            discount_amount=42750, total=293550, margin=28.5,
            expiry_date=now + timedelta(days=30),
            portal_token="portal-token-acme-001", last_activity_at=now,
        )
        db.add(q1)
        await db.flush()

        for line in [
            QuotationLine(quotation_id=q1.id, product_id=laptop.id, line_type=LineType.ONE_TIME,
                          quantity=3, unit_price=85000, cost_price=60000, discount=12, tax=18,
                          line_total=224400, margin=22.6),
            QuotationLine(quotation_id=q1.id, product_id=setup.id, line_type=LineType.ONE_TIME,
                          quantity=1, unit_price=15000, cost_price=8000, discount=8, tax=18,
                          line_total=16270, margin=40.0),
        ]:
            db.add(line)

        db.add(Approval(quotation_id=q1.id, approver_id=mgr.id, level=1,
                        action="APPROVED", reason="Gold customer, strategic account",
                        decided_at=now))

        q4 = Quotation(
            quotation_number="QT-2024-004", rep_id=rep2.id, customer_id=cust1.id,
            customer_tier="GOLD", status=QuotationStatus.UNDER_NEGOTIATION,
            blended_risk_score=18.5, subtotal=520000, tax_amount=93600,
            discount_amount=78000, total=535600, margin=24.1,
            expiry_date=now + timedelta(days=7),
            portal_token="portal-token-acme-004",
            last_activity_at=now - timedelta(days=1),
        )
        db.add(q4)
        await db.flush()

        for line in [
            QuotationLine(quotation_id=q4.id, product_id=laptop.id, line_type=LineType.ONE_TIME,
                          quantity=5, unit_price=85000, cost_price=60000, discount=15, tax=18,
                          line_total=425000, margin=18.8),
            QuotationLine(quotation_id=q4.id, product_id=support.id, line_type=LineType.SUBSCRIPTION,
                          quantity=5, unit_price=18000, cost_price=8000, discount=10, tax=18,
                          line_total=95310, margin=49.7),
        ]:
            db.add(line)

        db.add(Negotiation(quotation_id=q4.id, requested_by=cust1.id,
                           message="Can you do 20% on the laptops? We are buying 5 units.",
                           counter_discount=20, status="PENDING"))

        # ── INVOICE ───────────────────────────────────────────────────────────
        db.add(Invoice(
            invoice_number="INV-2024-001", quotation_id=q1.id,
            status=InvoiceStatus.PAID, amount=293550,
            due_date=now - timedelta(days=5),
            paid_at=now - timedelta(days=3), payment_ref="NEFT-20240701-001",
        ))

        # ── SYSTEM CONFIG ─────────────────────────────────────────────────────
        for key, val in [
            ("stall_threshold_days", "5"),
            ("company_name", "DealFlow360 Demo Co."),
            ("company_logo", ""),
            ("default_currency", "INR"),
            ("anomaly_threshold_pct", "25"),
        ]:
            db.add(SystemConfig(key=key, value=val))

        # ── AUDIT LOGS ────────────────────────────────────────────────────────
        for entry in [
            AuditLog(quotation_id=q1.id, user_id=rep1.id, action=AuditAction.CREATED, details="Quotation created"),
            AuditLog(quotation_id=q1.id, user_id=rep1.id, action=AuditAction.SUBMITTED, details="Submitted for approval"),
            AuditLog(quotation_id=q1.id, user_id=mgr.id,  action=AuditAction.APPROVED, details="Approved by manager",
                     metadata={"reason": "Strategic account"}),
            AuditLog(quotation_id=q4.id, user_id=rep2.id, action=AuditAction.SENT, details="Sent to customer portal"),
            AuditLog(quotation_id=q4.id, user_id=cust1.id, action=AuditAction.NEGOTIATED, details="Customer requested 20% discount"),
        ]:
            db.add(entry)

        await db.commit()

    print("\n✅ DealFlow360 seed completed successfully!\n")
    print("──────────────────────────────────────────────────────")
    print("  ROLE        EMAIL                      PASSWORD")
    print("──────────────────────────────────────────────────────")
    print("  Admin     : admin@dealflow.com       / Admin@123")
    print("  Sales Rep : priya@dealflow.com       / Rep@123")
    print("  Sales Rep : arjun@dealflow.com       / Rep@123")
    print("  Manager   : manager@dealflow.com     / Manager@123")
    print("  Finance   : finance@dealflow.com     / Finance@123")
    print("  Customer  : buyer@acme.com           / Customer@123")
    print("  Customer  : contact@beta.com         / Customer@123")
    print("  Customer  : purchase@gamma.com       / Customer@123")
    print("──────────────────────────────────────────────────────\n")


if __name__ == "__main__":
    asyncio.run(main())
