import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
import bcrypt
from sqlalchemy import delete

from app.database import AsyncSessionLocal
from app.models.models import (
    User, UserRole, CustomerTier, ProductCategory, Product,
    ProductVariant, PriceList, PriceListItem, DiscountTier,
    Warehouse, WarehouseStock, SubscriptionPlan, UpsellRule, BillingCycle,
    Quotation, QuotationLine, QuotationStatus, LineType,
    Approval, Negotiation, Invoice, InvoiceStatus, AuditLog, AuditAction
)

def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

async def seed():
    async with AsyncSessionLocal() as db:
        print("[INFO] Seeding DealFlow360 database with SQLAlchemy 2.0...")

        # 1. Clean up existing records in reverse dependency order
        for model in [
            AuditLog, Negotiation, Invoice, Approval, QuotationLine, Quotation,
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

        # 3. Users (Both dealflow.com and dealflow360.com suites)
        hashed_pw = hash_pw("Password@123")
        users = [
            # Primary suite (used in frontend login cards)
            User(name="Admin User", email="admin@dealflow.com", password=hashed_pw, role=UserRole.ADMIN),
            User(name="Priya Mehta", email="priya@dealflow.com", password=hashed_pw, role=UserRole.SALES_REP),
            User(name="Arjun Shah", email="arjun@dealflow.com", password=hashed_pw, role=UserRole.SALES_REP),
            User(name="Raj Patel", email="manager@dealflow.com", password=hashed_pw, role=UserRole.SALES_MANAGER),
            User(name="Sneha Joshi", email="finance@dealflow.com", password=hashed_pw, role=UserRole.FINANCE),
            User(name="Acme Corporation (Customer)", email="customer@acme.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.GOLD, company_name="Acme Corporation", phone="+91 9876543210"),
            User(name="Acme Buyer", email="buyer@acme.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.GOLD, company_name="Acme Corporation", phone="+91 9876543210"),
            User(name="Beta Industries", email="contact@beta.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.SILVER, company_name="Beta Industries Ltd"),
            User(name="Gamma Retail", email="purchase@gamma.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.BRONZE, company_name="Gamma Retail Pvt Ltd"),
            # Secondary suite
            User(name="Admin User (360)", email="admin@dealflow360.com", password=hashed_pw, role=UserRole.ADMIN),
            User(name="Sarah Jenkins", email="sarah.rep@dealflow360.com", password=hashed_pw, role=UserRole.SALES_REP),
            User(name="Michael Chang", email="michael.rep@dealflow360.com", password=hashed_pw, role=UserRole.SALES_REP),
            User(name="David Ross", email="david.manager@dealflow360.com", password=hashed_pw, role=UserRole.SALES_MANAGER),
            User(name="Emma Vance", email="emma.finance@dealflow360.com", password=hashed_pw, role=UserRole.FINANCE),
            User(name="John Doe", email="john@acmecorp.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.GOLD, company_name="Acme Corp"),
        ]
        db.add_all(users)
        await db.commit()

        # Re-fetch users for foreign keys
        user_map = {}
        for u in users:
            await db.refresh(u)
            user_map[u.email] = u

        # 4. Product Categories
        cat_hw = ProductCategory(name="Hardware", max_discount=15.0, description="Physical hardware products")
        cat_sw = ProductCategory(name="Software", max_discount=20.0, description="Software licenses & platforms")
        cat_srv = ProductCategory(name="Services", max_discount=10.0, description="Professional & implementation services")
        cat_sub = ProductCategory(name="Subscriptions", max_discount=25.0, description="Recurring cloud & support plans")
        db.add_all([cat_hw, cat_sw, cat_srv, cat_sub])
        await db.commit()
        for c in [cat_hw, cat_sw, cat_srv, cat_sub]:
            await db.refresh(c)

        # 5. Products
        p_laptop = Product(name="ProBook Laptop 15\"", sku="HW-001", category_id=cat_hw.id, base_price=Decimal("85000.00"), cost_price=Decimal("60000.00"), tax=Decimal("18.00"), unit="piece", description="High performance business laptop with Intel i7")
        p_monitor = Product(name="27\" 4K Monitor", sku="HW-002", category_id=cat_hw.id, base_price=Decimal("35000.00"), cost_price=Decimal("24000.00"), tax=Decimal("18.00"), unit="piece", description="Ultra sharp 4K display for professionals")
        p_keyboard = Product(name="Mechanical Keyboard", sku="HW-003", category_id=cat_hw.id, base_price=Decimal("4500.00"), cost_price=Decimal("2800.00"), tax=Decimal("18.00"), unit="piece", description="Wireless ergonomic mechanical keyboard")
        p_license = Product(name="DealFlow Enterprise License", sku="SW-001", category_id=cat_sw.id, base_price=Decimal("150000.00"), cost_price=Decimal("20000.00"), tax=Decimal("18.00"), unit="license", description="Annual per-tenant enterprise license")
        p_setup = Product(name="On-site Setup & Config", sku="SRV-001", category_id=cat_srv.id, base_price=Decimal("15000.00"), cost_price=Decimal("8000.00"), tax=Decimal("18.00"), unit="day", description="Professional installation and data migration")
        p_training = Product(name="Team Training (Half Day)", sku="SRV-002", category_id=cat_srv.id, base_price=Decimal("25000.00"), cost_price=Decimal("12000.00"), tax=Decimal("18.00"), unit="session", description="Instructor-led hands-on training")
        p_cloud = Product(name="Cloud Backup 1TB / mo", sku="SUB-001", category_id=cat_sub.id, base_price=Decimal("2400.00"), cost_price=Decimal("800.00"), tax=Decimal("18.00"), unit="month", is_subscription=True, billing_cycle=BillingCycle.MONTHLY, description="Automated daily encrypted offsite backup")
        p_support = Product(name="24/7 Priority Support", sku="SUB-002", category_id=cat_sub.id, base_price=Decimal("18000.00"), cost_price=Decimal("8000.00"), tax=Decimal("18.00"), unit="month", is_subscription=True, billing_cycle=BillingCycle.YEARLY, description="Dedicated account engineer with 1hr SLA")

        db.add_all([p_laptop, p_monitor, p_keyboard, p_license, p_setup, p_training, p_cloud, p_support])
        await db.commit()
        for p in [p_laptop, p_monitor, p_keyboard, p_license, p_setup, p_training, p_cloud, p_support]:
            await db.refresh(p)

        # 6. Product Variants
        v1 = ProductVariant(product_id=p_laptop.id, name="RAM 8GB", attribute="RAM", value="8GB", extra_price=Decimal("0.00"))
        v2 = ProductVariant(product_id=p_laptop.id, name="RAM 16GB", attribute="RAM", value="16GB", extra_price=Decimal("8000.00"))
        v3 = ProductVariant(product_id=p_laptop.id, name="RAM 32GB", attribute="RAM", value="32GB", extra_price=Decimal("18000.00"))
        db.add_all([v1, v2, v3])

        # 7. Warehouses & Stock Levels
        wh_mum = Warehouse(name="Mumbai Central Warehouse", location="Bhiwandi, Mumbai", shipping_cost=Decimal("500.00"))
        wh_del = Warehouse(name="Delhi NCR Depot", location="Okhla, New Delhi", shipping_cost=Decimal("600.00"))
        wh_blr = Warehouse(name="Bengaluru Tech Hub", location="Electronic City, Bengaluru", shipping_cost=Decimal("450.00"))
        db.add_all([wh_mum, wh_del, wh_blr])
        await db.commit()
        await db.refresh(wh_mum)
        await db.refresh(wh_del)
        await db.refresh(wh_blr)

        stocks = [
            WarehouseStock(warehouse_id=wh_mum.id, product_id=p_laptop.id, quantity=45, reserved=5),
            WarehouseStock(warehouse_id=wh_mum.id, product_id=p_monitor.id, quantity=30, reserved=2),
            WarehouseStock(warehouse_id=wh_mum.id, product_id=p_keyboard.id, quantity=120, reserved=10),
            WarehouseStock(warehouse_id=wh_del.id, product_id=p_laptop.id, quantity=25, reserved=3),
            WarehouseStock(warehouse_id=wh_del.id, product_id=p_monitor.id, quantity=40, reserved=0),
            WarehouseStock(warehouse_id=wh_blr.id, product_id=p_laptop.id, quantity=60, reserved=8),
            WarehouseStock(warehouse_id=wh_blr.id, product_id=p_monitor.id, quantity=50, reserved=4),
        ]
        db.add_all(stocks)

        # 8. Subscription Plans
        sp_monthly = SubscriptionPlan(name="Monthly Standard", billing_cycle=BillingCycle.MONTHLY, prorate_on_change=True, cancel_policy="Immediate cancel, no penalty")
        sp_annual = SubscriptionPlan(name="Annual Enterprise", billing_cycle=BillingCycle.YEARLY, prorate_on_change=True, cancel_policy="30-day notice", partial_refund=True)
        db.add_all([sp_monthly, sp_annual])

        # 9. Upsell Rules
        upsells = [
            UpsellRule(source_product_id=p_laptop.id, target_product_id=p_keyboard.id, score=85, is_promoted=False, min_margin=15.0),
            UpsellRule(source_product_id=p_laptop.id, target_product_id=p_setup.id, score=70, is_promoted=True, min_margin=25.0),
            UpsellRule(source_product_id=p_monitor.id, target_product_id=p_keyboard.id, score=75, is_promoted=False, min_margin=15.0),
            UpsellRule(source_product_id=p_setup.id, target_product_id=p_training.id, score=80, is_promoted=False, min_margin=30.0),
            UpsellRule(source_product_id=p_license.id, target_product_id=p_support.id, score=95, is_promoted=True, min_margin=40.0),
        ]
        db.add_all(upsells)
        await db.commit()

        # 9b. Customer Tier Contracted Price Lists
        pl_bronze = PriceList(name="Bronze Tier Standard Rates", tier=CustomerTier.BRONZE, currency="INR")
        pl_silver = PriceList(name="Silver Corporate Partner Rates", tier=CustomerTier.SILVER, currency="INR")
        pl_gold = PriceList(name="Gold Enterprise Preferred", tier=CustomerTier.GOLD, currency="INR")
        pl_platinum = PriceList(name="Platinum Global Key Accounts", tier=CustomerTier.PLATINUM, currency="INR")
        db.add_all([pl_bronze, pl_silver, pl_gold, pl_platinum])
        await db.commit()
        await db.refresh(pl_bronze)
        await db.refresh(pl_silver)
        await db.refresh(pl_gold)
        await db.refresh(pl_platinum)

        all_prods = [p_laptop, p_monitor, p_keyboard, p_license, p_setup, p_training, p_backup, p_support]
        discounts = {pl_bronze: Decimal("0.05"), pl_silver: Decimal("0.10"), pl_gold: Decimal("0.15"), pl_platinum: Decimal("0.20")}
        pl_items = []
        for pl, disc in discounts.items():
            for prod in all_prods:
                c_price = round(prod.base_price * (Decimal("1.00") - disc), 2)
                pl_items.append(PriceListItem(price_list_id=pl.id, product_id=prod.id, price=c_price))
        db.add_all(pl_items)
        await db.commit()

        # 10. Sample Quotations for Demo
        cust_acme = user_map["customer@acme.com"]
        cust_beta = user_map["contact@beta.com"]
        cust_gamma = user_map["purchase@gamma.com"]
        rep_priya = user_map["priya@dealflow.com"]
        rep_arjun = user_map["arjun@dealflow.com"]
        mgr_raj = user_map["manager@dealflow.com"]

        # Q1: Approved Quotation
        q1 = Quotation(
            quotation_number="QT-2024-001",
            rep_id=rep_priya.id,
            customer_id=cust_acme.id,
            customer_tier=CustomerTier.GOLD,
            status=QuotationStatus.APPROVED,
            blended_risk_score=12.5,
            subtotal=Decimal("285000.00"),
            tax_amount=Decimal("51300.00"),
            discount_amount=Decimal("42750.00"),
            total=Decimal("293550.00"),
            margin=28.5,
            portal_token="portal-token-acme-001",
            expiry_date=datetime.utcnow() + timedelta(days=30),
            last_activity_at=datetime.utcnow()
        )
        db.add(q1)
        await db.commit()
        await db.refresh(q1)

        ql1 = QuotationLine(
            quotation_id=q1.id, product_id=p_laptop.id, line_type=LineType.ONE_TIME,
            quantity=3, unit_price=Decimal("85000.00"), cost_price=Decimal("60000.00"),
            discount=12.0, tax=Decimal("18.00"), line_total=Decimal("224400.00"), margin=22.6
        )
        ql2 = QuotationLine(
            quotation_id=q1.id, product_id=p_setup.id, line_type=LineType.ONE_TIME,
            quantity=1, unit_price=Decimal("15000.00"), cost_price=Decimal("8000.00"),
            discount=8.0, tax=Decimal("18.00"), line_total=Decimal("16270.00"), margin=40.0
        )
        app1 = Approval(
            quotation_id=q1.id, approver_id=mgr_raj.id, level=1,
            action="APPROVED", reason="Gold customer strategic account", decided_at=datetime.utcnow()
        )
        inv1 = Invoice(
            invoice_number="INV-2024-001", quotation_id=q1.id,
            amount=Decimal("293550.00"), due_date=datetime.utcnow() + timedelta(days=15),
            status=InvoiceStatus.SENT
        )
        db.add_all([ql1, q2_line := ql2, app1, inv1])

        # Q2: Pending Manager Review
        q2 = Quotation(
            quotation_number="QT-2024-002",
            rep_id=rep_priya.id,
            customer_id=cust_beta.id,
            customer_tier=CustomerTier.SILVER,
            status=QuotationStatus.PENDING_MANAGER,
            blended_risk_score=8.2,
            subtotal=Decimal("145000.00"),
            tax_amount=Decimal("26100.00"),
            discount_amount=Decimal("14500.00"),
            total=Decimal("156600.00"),
            margin=31.2,
            portal_token="portal-token-beta-002",
            expiry_date=datetime.utcnow() + timedelta(days=15),
            last_activity_at=datetime.utcnow() - timedelta(days=2)
        )
        db.add(q2)
        await db.commit()
        await db.refresh(q2)

        ql3 = QuotationLine(
            quotation_id=q2.id, product_id=p_monitor.id, line_type=LineType.ONE_TIME,
            quantity=4, unit_price=Decimal("35000.00"), cost_price=Decimal("24000.00"),
            discount=10.0, tax=Decimal("18.00"), line_total=Decimal("148680.00"), margin=28.9
        )
        db.add(ql3)

        # Q3: Draft / Active Proposal
        q3 = Quotation(
            quotation_number="QT-2024-003",
            rep_id=rep_arjun.id,
            customer_id=cust_gamma.id,
            customer_tier=CustomerTier.BRONZE,
            status=QuotationStatus.SENT_TO_CUSTOMER,
            blended_risk_score=0.0,
            subtotal=Decimal("56000.00"),
            tax_amount=Decimal("10080.00"),
            discount_amount=Decimal("0.00"),
            total=Decimal("66080.00"),
            margin=38.5,
            portal_token="portal-token-gamma-003",
            expiry_date=datetime.utcnow() + timedelta(days=20),
            last_activity_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(q3)
        await db.commit()
        await db.refresh(q3)

        ql4 = QuotationLine(
            quotation_id=q3.id, product_id=p_keyboard.id, line_type=LineType.ONE_TIME,
            quantity=10, unit_price=Decimal("4500.00"), cost_price=Decimal("2800.00"),
            discount=0.0, tax=Decimal("18.00"), line_total=Decimal("53100.00"), margin=37.8
        )
        db.add(ql4)

        # Q4: Under Negotiation (Active Customer Portal Demo)
        q4 = Quotation(
            quotation_number="QT-2024-004",
            rep_id=rep_arjun.id,
            customer_id=cust_acme.id,
            customer_tier=CustomerTier.GOLD,
            status=QuotationStatus.UNDER_NEGOTIATION,
            blended_risk_score=18.5,
            subtotal=Decimal("520000.00"),
            tax_amount=Decimal("93600.00"),
            discount_amount=Decimal("78000.00"),
            total=Decimal("535600.00"),
            margin=24.1,
            portal_token="portal-token-acme-004",
            expiry_date=datetime.utcnow() + timedelta(days=7),
            last_activity_at=datetime.utcnow() - timedelta(hours=2)
        )
        db.add(q4)
        await db.commit()
        await db.refresh(q4)

        ql5 = QuotationLine(
            quotation_id=q4.id, product_id=p_laptop.id, line_type=LineType.ONE_TIME,
            quantity=5, unit_price=Decimal("85000.00"), cost_price=Decimal("60000.00"),
            discount=15.0, tax=Decimal("18.00"), line_total=Decimal("425000.00"), margin=18.8
        )
        ql6 = QuotationLine(
            quotation_id=q4.id, product_id=p_support.id, line_type=LineType.SUBSCRIPTION,
            quantity=5, unit_price=Decimal("18000.00"), cost_price=Decimal("8000.00"),
            discount=10.0, tax=Decimal("18.00"), line_total=Decimal("95310.00"), margin=49.7
        )
        neg1 = Negotiation(
            quotation_id=q4.id, requested_by="CUSTOMER",
            message="Can you do 20% on the laptops? We are purchasing 5 units and 5 support subscriptions.",
            counter_discount=20.0, status="PENDING"
        )
        db.add_all([ql5, ql6, neg1])

        # Also support demo-portal-token-acme for one-click portal links
        q_demo = Quotation(
            quotation_number="QT-2024-DEMO",
            rep_id=rep_priya.id,
            customer_id=cust_acme.id,
            customer_tier=CustomerTier.GOLD,
            status=QuotationStatus.SENT_TO_CUSTOMER,
            blended_risk_score=5.0,
            subtotal=Decimal("170000.00"),
            tax_amount=Decimal("30600.00"),
            discount_amount=Decimal("17000.00"),
            total=Decimal("183600.00"),
            margin=29.0,
            portal_token="demo-portal-token-acme",
            expiry_date=datetime.utcnow() + timedelta(days=14),
            last_activity_at=datetime.utcnow()
        )
        db.add(q_demo)
        await db.commit()
        await db.refresh(q_demo)

        ql_demo = QuotationLine(
            quotation_id=q_demo.id, product_id=p_laptop.id, line_type=LineType.ONE_TIME,
            quantity=2, unit_price=Decimal("85000.00"), cost_price=Decimal("60000.00"),
            discount=10.0, tax=Decimal("18.00"), line_total=Decimal("179640.00"), margin=25.0
        )
        db.add(ql_demo)

        await db.commit()
        print("[SUCCESS] Seed completed with comprehensive CPQ users, products, tiers, and quotations!")

if __name__ == "__main__":
    asyncio.run(seed())
