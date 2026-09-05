import asyncio
from decimal import Decimal
from passlib.context import CryptContext
from sqlalchemy import select, delete

from app.database import AsyncSessionLocal
from app.models.models import (
    User, UserRole, CustomerTier, ProductCategory, Product,
    ProductVariant, PriceList, PriceListItem, DiscountTier,
    Warehouse, WarehouseStock, SubscriptionPlan, UpsellRule, BillingCycle
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed():
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding DealFlow360 database with SQLAlchemy 2.0...")

        # 1. Clean up existing records in dependency order
        for model in [
            UpsellRule, WarehouseStock, PriceListItem, ProductVariant,
            Product, ProductCategory, PriceList, Warehouse,
            DiscountTier, SubscriptionPlan, User
        ]:
            await db.execute(delete(model))
        await db.commit()

        # 2. Discount Tiers
        discount_tiers = [
            DiscountTier(tier=CustomerTier.BRONZE, max_discount=5.0, requires_manager=True, requires_finance=False),
            DiscountTier(tier=CustomerTier.SILVER, max_discount=10.0, requires_manager=True, requires_finance=False),
            DiscountTier(tier=CustomerTier.GOLD, max_discount=15.0, requires_manager=True, requires_finance=True),
        ]
        db.add_all(discount_tiers)

        # 3. Users (Admin, 2 Sales Reps, Sales Manager, Finance, 2 Customers)
        hashed_pw = pwd_context.hash("Password@123")
        users = [
            User(name="Admin User", email="admin@dealflow360.com", password=hashed_pw, role=UserRole.ADMIN),
            User(name="Sarah Jenkins", email="sarah.rep@dealflow360.com", password=hashed_pw, role=UserRole.SALES_REP),
            User(name="Michael Chang", email="michael.rep@dealflow360.com", password=hashed_pw, role=UserRole.SALES_REP),
            User(name="David Ross", email="david.manager@dealflow360.com", password=hashed_pw, role=UserRole.SALES_MANAGER),
            User(name="Emma Vance", email="emma.finance@dealflow360.com", password=hashed_pw, role=UserRole.FINANCE),
            User(name="Acme Corp (John)", email="john@acmecorp.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.GOLD, company_name="Acme Corp"),
            User(name="TechStart Inc (Alice)", email="alice@techstart.io", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.SILVER, company_name="TechStart Inc"),
        ]
        db.add_all(users)
        await db.commit()

        # 4. Product Categories with differing max_discount ceilings
        cat_hw = ProductCategory(name="Hardware", max_discount=15.0, description="Physical devices and hardware systems")
        cat_sw = ProductCategory(name="Software Licenses", max_discount=25.0, description="Enterprise software and platform licenses")
        cat_srv = ProductCategory(name="Services", max_discount=10.0, description="Consulting, onboarding, and training services")
        cat_cld = ProductCategory(name="Cloud Services", max_discount=20.0, description="Managed cloud infrastructure and SaaS")
        db.add_all([cat_hw, cat_sw, cat_srv, cat_cld])
        await db.commit()
        await db.refresh(cat_hw)
        await db.refresh(cat_sw)
        await db.refresh(cat_srv)
        await db.refresh(cat_cld)

        # 5. Products (8-12 products split across one-time and subscription)
        p1 = Product(name="Enterprise Server Rack X1", sku="HW-SRV-001", category_id=cat_hw.id, base_price=Decimal("120000.00"), cost_price=Decimal("85000.00"), tax=Decimal("18.00"), is_subscription=False)
        p2 = Product(name="Edge Gateway Pro", sku="HW-GW-002", category_id=cat_hw.id, base_price=Decimal("45000.00"), cost_price=Decimal("30000.00"), tax=Decimal("18.00"), is_subscription=False)
        p3 = Product(name="Smart Sensor Pod", sku="HW-SN-003", category_id=cat_hw.id, base_price=Decimal("8500.00"), cost_price=Decimal("5000.00"), tax=Decimal("18.00"), is_subscription=False)
        
        p4 = Product(name="DealFlow360 Enterprise Platform", sku="SW-CORE-001", category_id=cat_sw.id, base_price=Decimal("25000.00"), cost_price=Decimal("2000.00"), tax=Decimal("18.00"), is_subscription=True, billing_cycle=BillingCycle.YEARLY)
        p5 = Product(name="Advanced Analytics Suite", sku="SW-ANL-002", category_id=cat_sw.id, base_price=Decimal("12000.00"), cost_price=Decimal("1500.00"), tax=Decimal("18.00"), is_subscription=True, billing_cycle=BillingCycle.YEARLY)
        p6 = Product(name="API Connector Gateway", sku="SW-API-003", category_id=cat_sw.id, base_price=Decimal("5000.00"), cost_price=Decimal("500.00"), tax=Decimal("18.00"), is_subscription=True, billing_cycle=BillingCycle.MONTHLY)

        p7 = Product(name="Implementation & Onboarding", sku="SRV-IMP-001", category_id=cat_srv.id, base_price=Decimal("50000.00"), cost_price=Decimal("30000.00"), tax=Decimal("18.00"), is_subscription=False)
        p8 = Product(name="24/7 Premium Support", sku="SRV-SUP-002", category_id=cat_srv.id, base_price=Decimal("15000.00"), cost_price=Decimal("8000.00"), tax=Decimal("18.00"), is_subscription=True, billing_cycle=BillingCycle.YEARLY)
        p9 = Product(name="Cloud Storage 10TB Node", sku="CLD-STR-001", category_id=cat_cld.id, base_price=Decimal("8000.00"), cost_price=Decimal("4000.00"), tax=Decimal("18.00"), is_subscription=True, billing_cycle=BillingCycle.MONTHLY)

        db.add_all([p1, p2, p3, p4, p5, p6, p7, p8, p9])
        await db.commit()
        for p in [p1, p2, p3, p4, p5, p6, p7, p8, p9]:
            await db.refresh(p)

        # 6. Product Variants
        v1 = ProductVariant(product_id=p1.id, name="32 Core / 128GB RAM", attribute="Specification", value="32C-128G", extra_price=Decimal("20000.00"))
        v2 = ProductVariant(product_id=p1.id, name="64 Core / 256GB RAM", attribute="Specification", value="64C-256G", extra_price=Decimal("50000.00"))
        v3 = ProductVariant(product_id=p2.id, name="Outdoor IP67 Casing", attribute="Chassis", value="IP67", extra_price=Decimal("5000.00"))
        db.add_all([v1, v2, v3])

        # 7. Warehouses & Stock Levels
        wh_mum = Warehouse(name="Mumbai Main Hub", location="Bhiwandi, Mumbai", shipping_cost=Decimal("500.00"))
        wh_blr = Warehouse(name="Bengaluru Tech Depot", location="Electronic City, Bengaluru", shipping_cost=Decimal("450.00"))
        db.add_all([wh_mum, wh_blr])
        await db.commit()
        await db.refresh(wh_mum)
        await db.refresh(wh_blr)

        stocks = [
            WarehouseStock(warehouse_id=wh_mum.id, product_id=p1.id, quantity=25, reserved=2),
            WarehouseStock(warehouse_id=wh_mum.id, product_id=p2.id, quantity=80, reserved=5),
            WarehouseStock(warehouse_id=wh_mum.id, product_id=p3.id, quantity=300, reserved=20),
            WarehouseStock(warehouse_id=wh_blr.id, product_id=p1.id, quantity=15, reserved=1),
            WarehouseStock(warehouse_id=wh_blr.id, product_id=p2.id, quantity=60, reserved=0),
            WarehouseStock(warehouse_id=wh_blr.id, product_id=p3.id, quantity=250, reserved=10),
        ]
        db.add_all(stocks)

        # 8. Subscription Plans
        sp_monthly = SubscriptionPlan(name="Monthly Pro", billing_cycle=BillingCycle.MONTHLY, prorate_on_change=True, cancel_policy="Immediate cancel, no penalty")
        sp_annual = SubscriptionPlan(name="Annual Enterprise", billing_cycle=BillingCycle.YEARLY, prorate_on_change=True, cancel_policy="30-day notice, pro-rated refund", partial_refund=True)
        db.add_all([sp_monthly, sp_annual])

        # 9. Price Lists (Gold, Silver, Bronze)
        pl_gold = PriceList(name="Gold Strategic Partner", tier=CustomerTier.GOLD, currency="INR")
        pl_silver = PriceList(name="Silver Preferred", tier=CustomerTier.SILVER, currency="INR")
        db.add_all([pl_gold, pl_silver])
        await db.commit()
        await db.refresh(pl_gold)
        await db.refresh(pl_silver)

        items = [
            PriceListItem(price_list_id=pl_gold.id, product_id=p1.id, price=Decimal("105000.00")),
            PriceListItem(price_list_id=pl_gold.id, product_id=p4.id, price=Decimal("20000.00")),
            PriceListItem(price_list_id=pl_silver.id, product_id=p1.id, price=Decimal("112000.00")),
            PriceListItem(price_list_id=pl_silver.id, product_id=p4.id, price=Decimal("22500.00")),
        ]
        db.add_all(items)

        # 10. Upsell Rules
        upsells = [
            UpsellRule(source_product_id=p1.id, target_product_id=p8.id, score=85, is_promoted=True, min_margin=20.0),
            UpsellRule(source_product_id=p4.id, target_product_id=p5.id, score=90, is_promoted=True, min_margin=30.0),
            UpsellRule(source_product_id=p4.id, target_product_id=p7.id, score=75, is_promoted=False, min_margin=15.0),
        ]
        db.add_all(upsells)

        await db.commit()
        print("✅ Seed completed successfully with realistic CPQ dataset!")

if __name__ == "__main__":
    asyncio.run(seed())
