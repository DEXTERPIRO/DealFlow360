"""backend/seed_100.py — Enterprise-Scale Seeder (100+ records in every core module)
DealFlow360 Database Populator
"""
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
import random
import uuid
import bcrypt
from sqlalchemy import delete, select

from app.database import AsyncSessionLocal
from app.models.models import (
    User, UserRole, CustomerTier, ProductCategory, Product,
    ProductVariant, PriceList, PriceListItem, DiscountTier,
    Warehouse, WarehouseStock, SubscriptionPlan, Subscription, UpsellRule, BillingCycle,
    Quotation, QuotationLine, QuotationStatus, LineType,
    Approval, Negotiation, Invoice, InvoiceStatus, AuditLog, AuditAction, Notification,
    FulfillmentLine, FulfillmentStatus, SystemConfig
)

def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

async def seed_enterprise_data():
    async with AsyncSessionLocal() as db:
        print("[1/14] Purging existing database records in reverse dependency order...")
        models_to_delete = [
            Notification, AuditLog, Negotiation, Invoice, Subscription,
            FulfillmentLine, Approval, QuotationLine, Quotation, UpsellRule,
            WarehouseStock, PriceListItem, ProductVariant, Product,
            ProductCategory, PriceList, Warehouse, DiscountTier,
            SubscriptionPlan, SystemConfig, User
        ]
        for model in models_to_delete:
            await db.execute(delete(model))
        await db.commit()

        hashed_pw = hash_pw("Password@123")
        now = datetime.utcnow()

        # =========================================================================
        # 2. SYSTEM CONFIGS & DISCOUNT TIERS
        # =========================================================================
        print("[2/14] Seeding System Configurations & Discount Tiers...")
        configs = [
            SystemConfig(key="currency_symbol", value="INR"),
            SystemConfig(key="currency_code", value="INR"),
            SystemConfig(key="tax_rate_default", value="18.00"),
            SystemConfig(key="company_name", value="DealFlow360 Technologies Pvt Ltd"),
            SystemConfig(key="portal_terms", value="Standard Enterprise SLA & Commercial Terms apply."),
            SystemConfig(key="support_email", value="support@dealflow360.com"),
        ]
        db.add_all(configs)

        discount_tiers = [
            DiscountTier(tier=CustomerTier.BRONZE, max_discount=5.0, requires_manager=True, requires_finance=False),
            DiscountTier(tier=CustomerTier.SILVER, max_discount=10.0, requires_manager=True, requires_finance=False),
            DiscountTier(tier=CustomerTier.GOLD, max_discount=15.0, requires_manager=True, requires_finance=True),
            DiscountTier(tier=CustomerTier.PLATINUM, max_discount=25.0, requires_manager=True, requires_finance=True),
        ]
        db.add_all(discount_tiers)
        await db.commit()

        # =========================================================================
        # 3. USERS (135+ Total: Admins, Managers, Reps, Finance, Customers)
        # =========================================================================
        print("[3/14] Seeding 130+ Enterprise Users...")
        users = []

        # Standard Demo Accounts
        core_users = [
            User(name="Admin User", email="admin@dealflow.com", password=hashed_pw, role=UserRole.ADMIN),
            User(name="Admin User (360)", email="admin@dealflow360.com", password=hashed_pw, role=UserRole.ADMIN),
            User(name="Raj Patel", email="manager@dealflow.com", password=hashed_pw, role=UserRole.SALES_MANAGER),
            User(name="David Ross", email="david.manager@dealflow360.com", password=hashed_pw, role=UserRole.SALES_MANAGER),
            User(name="Sneha Joshi", email="finance@dealflow.com", password=hashed_pw, role=UserRole.FINANCE),
            User(name="Emma Vance", email="emma.finance@dealflow360.com", password=hashed_pw, role=UserRole.FINANCE),
            User(name="Priya Mehta", email="priya@dealflow.com", password=hashed_pw, role=UserRole.SALES_REP),
            User(name="Arjun Shah", email="arjun@dealflow.com", password=hashed_pw, role=UserRole.SALES_REP),
            User(name="Sarah Jenkins", email="sarah.rep@dealflow360.com", password=hashed_pw, role=UserRole.SALES_REP),
            User(name="Michael Chang", email="michael.rep@dealflow360.com", password=hashed_pw, role=UserRole.SALES_REP),
            User(name="Acme Corporation (Customer)", email="customer@acme.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.GOLD, company_name="Acme Corporation", phone="+91 9876543210"),
            User(name="Acme Buyer", email="buyer@acme.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.GOLD, company_name="Acme Corporation", phone="+91 9876543210"),
            User(name="Beta Industries", email="contact@beta.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.SILVER, company_name="Beta Industries Ltd", phone="+91 9876543211"),
            User(name="Gamma Retail", email="purchase@gamma.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.BRONZE, company_name="Gamma Retail Pvt Ltd", phone="+91 9876543212"),
            User(name="John Doe", email="john@acmecorp.com", password=hashed_pw, role=UserRole.CUSTOMER, customer_tier=CustomerTier.GOLD, company_name="Acme Corp", phone="+91 9876543213"),
        ]
        users.extend(core_users)

        # 8 More Sales Managers (Total 10)
        mgr_names = [
            "Vikram Singhania", "Meera Nambiar", "Kabir Sengupta", "Rajeshwari Iyer",
            "Aniruddh Bose", "Sunita Deshmukh", "Farhan Akhtar", "Tanya Kapoor"
        ]
        for idx, name in enumerate(mgr_names, 3):
            slug = name.lower().replace(" ", ".")
            users.append(User(name=name, email=f"{slug}@dealflow.com", password=hashed_pw, role=UserRole.SALES_MANAGER, phone=f"+91 981100{idx:04d}"))

        # 8 More Finance Approvers (Total 10)
        fin_names = [
            "Sanjay Kulkarni", "Pooja Hegde", "Manish Tiwari", "Ritu Chawla",
            "Gaurav Mukherjee", "Alka Yagnik", "Suresh Raina", "Bhavna Jain"
        ]
        for idx, name in enumerate(fin_names, 3):
            slug = name.lower().replace(" ", ".")
            users.append(User(name=name, email=f"{slug}@dealflow.com", password=hashed_pw, role=UserRole.FINANCE, phone=f"+91 982200{idx:04d}"))

        # 21 More Sales Reps (Total 25)
        rep_names = [
            "Rohan Verma", "Neha Agarwal", "Karan Malhotra", "Divya Nair", "Ananya Das",
            "Siddharth Rao", "Kavita Pillai", "Aditya Joshi", "Ishaan Roy", "Shreya Bhat",
            "Varun Dhawan", "Tanvi Sharma", "Akash Mishra", "Deepika Padukone", "Harsh Vardhan",
            "Rhea Chakraborty", "Naveen Jindal", "Simran Kaur", "Prateek Kuhad", "Mallika Sarabhai", "Zoya Akhtar"
        ]
        for idx, name in enumerate(rep_names, 5):
            slug = name.lower().replace(" ", ".")
            users.append(User(name=name, email=f"{slug}@dealflow.com", password=hashed_pw, role=UserRole.SALES_REP, phone=f"+91 983300{idx:04d}"))

        # 75 Corporate Customer Accounts across India/Global Enterprise
        customer_companies = [
            ("Tata Consultancy Services", "Ratan Mistry", CustomerTier.PLATINUM),
            ("Infosys Technologies", "Sudha Murthy", CustomerTier.PLATINUM),
            ("Reliance Industries", "Mukesh Ambani", CustomerTier.PLATINUM),
            ("Wipro Digital Systems", "Azim Premji", CustomerTier.PLATINUM),
            ("HCL Technologies", "Roshni Nadar", CustomerTier.PLATINUM),
            ("Bharti Airtel Ltd", "Sunil Mittal", CustomerTier.PLATINUM),
            ("Larsen & Toubro Ltd", "Subrahmanyan SN", CustomerTier.PLATINUM),
            ("Mahindra Tech Solutions", "Anand Mahindra", CustomerTier.PLATINUM),
            ("HDFC Bank Corp", "Sashidhar Jagdishan", CustomerTier.PLATINUM),
            ("State Bank Global", "Dinesh Khara", CustomerTier.PLATINUM),
            ("ICICI Enterprise Bank", "Sandeep Bakhshi", CustomerTier.PLATINUM),
            ("Kotak Mahindra Group", "Uday Kotak", CustomerTier.PLATINUM),
            ("Axis Bank Corporate", "Amitabh Chaudhry", CustomerTier.PLATINUM),
            ("Adani Enterprises", "Gautam Adani", CustomerTier.PLATINUM),
            ("Bajaj Finserv Ltd", "Sanjiv Bajaj", CustomerTier.PLATINUM),
            ("Flipkart Internet Pvt Ltd", "Kalyan Krishnamurthy", CustomerTier.GOLD),
            ("Zomato Media Logistics", "Deepinder Goyal", CustomerTier.GOLD),
            ("Nykaa E-Commerce", "Falguni Nayar", CustomerTier.GOLD),
            ("Swiggy Bundl Technologies", "Sriharsha Majety", CustomerTier.GOLD),
            ("Paytm One97 Corp", "Vijay Shekhar", CustomerTier.GOLD),
            ("Ola Mobility Cabs", "Bhavish Aggarwal", CustomerTier.GOLD),
            ("Delhivery Supply Chain", "Sahil Barua", CustomerTier.GOLD),
            ("Razorpay Software Labs", "Harshil Mathur", CustomerTier.GOLD),
            ("Zerodha Broking Ltd", "Nithin Kamath", CustomerTier.GOLD),
            ("PolicyBazaar Insurance", "Yashish Dahiya", CustomerTier.GOLD),
            ("Freshworks India", "Girish Mathrubootham", CustomerTier.GOLD),
            ("Postman API Technologies", "Abhinav Asthana", CustomerTier.GOLD),
            ("Zoho Corporation", "Sridhar Vembu", CustomerTier.GOLD),
            ("Pine Labs Payments", "Amrish Rau", CustomerTier.GOLD),
            ("CRED Tech Systems", "Kunal Shah", CustomerTier.GOLD),
            ("Cars24 Services", "Vikram Chopra", CustomerTier.SILVER),
            ("Lenskart Eyewear", "Peyush Bansal", CustomerTier.SILVER),
            ("Boat Lifestyle Audio", "Aman Gupta", CustomerTier.SILVER),
            ("Mamaearth Honasa", "Ghazal Alagh", CustomerTier.SILVER),
            ("Groww Investments", "Lalit Keshre", CustomerTier.SILVER),
            ("Upstox Securities", "Ravi Kumar", CustomerTier.SILVER),
            ("Urban Company Services", "Abhiraj Bhal", CustomerTier.SILVER),
            ("Blinkit Commerce", "Albinder Dhindsa", CustomerTier.SILVER),
            ("Zepto Fast Delivery", "Aadit Palicha", CustomerTier.SILVER),
            ("BigBasket Supermarket", "Hari Menon", CustomerTier.SILVER),
            ("Cult.fit Healthcare", "Mukesh Bansal", CustomerTier.SILVER),
            ("PharmEasy Healthcare", "Siddharth Shah", CustomerTier.SILVER),
            ("Tata 1mg Digital", "Prashant Tandon", CustomerTier.SILVER),
            ("Netmeds Pharmacy", "Pradeep Dadha", CustomerTier.SILVER),
            ("Shadowfax Logistics", "Abhishek Bansal", CustomerTier.SILVER),
            ("Shiprocket Logistics", "Saahil Goel", CustomerTier.SILVER),
            ("Infra.Market Construction", "Souvik Sengupta", CustomerTier.SILVER),
            ("Moglix Industrial Supplies", "Rahul Garg", CustomerTier.SILVER),
            ("OfBusiness Raw Materials", "Asish Mohapatra", CustomerTier.SILVER),
            ("Udaan B2B Trade", "Amod Malviya", CustomerTier.SILVER),
            ("BharatPe Merchant Pay", "Suhail Sameer", CustomerTier.BRONZE),
            ("Khatabook Ledger", "Ravish Naresh", CustomerTier.BRONZE),
            ("OkCredit Digital", "Harsh Pokharna", CustomerTier.BRONZE),
            ("Dunzo Digital Express", "Kabeer Biswas", CustomerTier.BRONZE),
            ("Rapido Bike Taxi", "Aravind Sanka", CustomerTier.BRONZE),
            ("Bounce Mobility", "Vivekananda Hallekere", CustomerTier.BRONZE),
            ("Yulu Bikes Clean", "Amit Gupta", CustomerTier.BRONZE),
            ("Chalo Bus Transport", "Mohit Dubey", CustomerTier.BRONZE),
            ("Citymall Community", "Angad Kikla", CustomerTier.BRONZE),
            ("DealShare Social", "Vineet Rao", CustomerTier.BRONZE),
            ("Trell Media", "Pulkit Agrawal", CustomerTier.BRONZE),
            ("Josh Short Video", "Virendra Gupta", CustomerTier.BRONZE),
            ("ShareChat Social", "Ankush Sachdeva", CustomerTier.BRONZE),
            ("Glance InMobi Lockscreen", "Naveen Tewari", CustomerTier.BRONZE),
            ("Dailyhunt News", "Umang Bedi", CustomerTier.BRONZE),
            ("Pocket FM Audio", "Rohan Nayak", CustomerTier.BRONZE),
            ("Kuku FM Podcasting", "Lal Chand Bisu", CustomerTier.BRONZE),
            ("Stage OTT Regional", "Vinay Singhal", CustomerTier.BRONZE),
            ("Chingari Social App", "Sumit Ghosh", CustomerTier.BRONZE),
            ("WinZO Gaming", "Paavan Nanda", CustomerTier.BRONZE),
            ("Mobile Premier League", "Sai Srinivas", CustomerTier.BRONZE),
            ("Dream11 Fantasy Sports", "Harsh Jain", CustomerTier.BRONZE),
            ("Games24x7 Rummy", "Bhavin Pandya", CustomerTier.BRONZE),
            ("Nazara Games", "Nitish Mittersain", CustomerTier.BRONZE),
            ("Head Digital Works", "Deepak Gullapalli", CustomerTier.BRONZE),
        ]
        for idx, (company, contact, tier) in enumerate(customer_companies, 1):
            slug = contact.lower().replace(" ", ".")
            domain = company.lower().replace(" ", "").replace(".", "").replace(",", "")[:10] + ".com"
            users.append(User(
                name=f"{contact} ({company})",
                email=f"{slug}@{domain}",
                password=hashed_pw,
                role=UserRole.CUSTOMER,
                customer_tier=tier,
                company_name=company,
                phone=f"+91 99{idx:02d}00{idx:04d}"
            ))

        db.add_all(users)
        await db.commit()
        print(f"[3/14 SUCCESS] Seeded {len(users)} Total Users!")

        # Map users by role
        reps = [u for u in users if u.role == UserRole.SALES_REP]
        managers = [u for u in users if u.role == UserRole.SALES_MANAGER]
        finance_users = [u for u in users if u.role == UserRole.FINANCE]
        customers = [u for u in users if u.role == UserRole.CUSTOMER]

        # =========================================================================
        # 4. PRODUCT CATEGORIES (8 Categories)
        # =========================================================================
        print("[4/14] Seeding Product Categories...")
        categories = [
            ProductCategory(name="Hardware & Compute", max_discount=15.0, description="Enterprise servers, workstations, and high-performance laptops"),
            ProductCategory(name="Software & Platforms", max_discount=20.0, description="Per-seat and enterprise software licensing suites"),
            ProductCategory(name="Cloud & Infrastructure", max_discount=25.0, description="Managed cloud instances, Kubernetes clusters, and storage"),
            ProductCategory(name="Cyber Security", max_discount=18.0, description="Zero-trust firewalls, endpoint security, and SIEM monitoring"),
            ProductCategory(name="Professional Services", max_discount=12.0, description="Consulting, architecture sprints, and SLA implementations"),
            ProductCategory(name="Recurring Subscriptions", max_discount=25.0, description="Cloud backup, continuous compliance, and priority 24/7 SLAs"),
            ProductCategory(name="AI & Machine Learning", max_discount=20.0, description="GPU compute hours, vector databases, and GenAI models"),
            ProductCategory(name="Networking & Telecom", max_discount=15.0, description="Core switches, routers, SD-WAN devices, and optics"),
        ]
        db.add_all(categories)
        await db.commit()
        for cat in categories:
            await db.refresh(cat)

        cat_map = {c.name: c for c in categories}

        # =========================================================================
        # 5. PRODUCTS (110 Total Catalog Products)
        # =========================================================================
        print("[5/14] Seeding 110 Enterprise Catalog Products...")
        raw_products = [
            # Hardware & Compute (20)
            ("ProBook Executive 15\" Laptop", "HW-001", "Hardware & Compute", 85000, 60000, "piece", False, None, "Intel Core i7-13700H, 16GB RAM, 512GB NVMe SSD"),
            ("UltraBook Carbon 14\" Slim", "HW-002", "Hardware & Compute", 115000, 85000, "piece", False, None, "Intel Core i9-13900H, 32GB RAM, 1TB NVMe, OLED"),
            ("PowerEdge R750 Rack Server 2U", "HW-003", "Hardware & Compute", 420000, 310000, "piece", False, None, "Dual Xeon Gold 6330, 128GB ECC RAM, 8x 2.4TB SAS"),
            ("PowerEdge R650 Dense Server 1U", "HW-004", "Hardware & Compute", 340000, 250000, "piece", False, None, "Dual Xeon Silver 4314, 64GB ECC RAM, 4x 1.92TB NVMe"),
            ("Precision 7920 Tower Workstation", "HW-005", "Hardware & Compute", 280000, 200000, "piece", False, None, "Xeon W-2295, 64GB RAM, RTX A4000 16GB GPU"),
            ("ThinkStation P620 Threadripper", "HW-006", "Hardware & Compute", 390000, 285000, "piece", False, None, "AMD Threadripper Pro 3975WX, 128GB RAM, RTX A5000"),
            ("Dell UltraSharp 27\" 4K Monitor", "HW-007", "Hardware & Compute", 38000, 26000, "piece", False, None, "IPS Black Technology, USB-C 90W Hub, 100% sRGB"),
            ("Dell UltraSharp 34\" Curved USB-C", "HW-008", "Hardware & Compute", 68000, 48000, "piece", False, None, "WQHD Curved IPS Display with KVM Switch"),
            ("Logitech MX Master 3S + Craft Combo", "HW-009", "Hardware & Compute", 18500, 12000, "set", False, None, "Ergonomic wireless precision mouse and dial keyboard"),
            ("Synology 12-Bay RackStation NAS", "HW-010", "Hardware & Compute", 240000, 175000, "piece", False, None, "12x 18TB Enterprise SAS Drive Array with 10GbE SFP+"),
            ("QNAP 8-Bay All-Flash NVMe Array", "HW-011", "Hardware & Compute", 380000, 280000, "piece", False, None, "High-density flash storage for high-IOPS transactional DBs"),
            ("APC Smart-UPS RT 10kVA On-Line", "HW-012", "Hardware & Compute", 195000, 145000, "piece", False, None, "Double-conversion online power protection for server racks"),
            ("Eaton 9PX 6000W 3U Rack UPS", "HW-013", "Hardware & Compute", 145000, 105000, "piece", False, None, "High efficiency Unity power factor rackmount UPS system"),
            ("Polycom Studio X50 Video Bar", "HW-014", "Hardware & Compute", 125000, 92000, "piece", False, None, "All-in-one 4K video conferencing system for boardrooms"),
            ("Logitech Rally Plus Dual-Mic Hub", "HW-015", "Hardware & Compute", 175000, 130000, "set", False, None, "Modular ultra-HD conference camera system with beamforming"),
            ("Jabra Speak 810 Executive Speaker", "HW-016", "Hardware & Compute", 32000, 22000, "piece", False, None, "Omnidirectional conference speakerphone for up to 15 people"),
            ("YubiKey 5 NFC Enterprise (Pack of 10)", "HW-017", "Hardware & Compute", 45000, 31000, "pack", False, None, "FIDO2 / WebAuthn hardware authentication keys"),
            ("Zebra ZT411 Industrial Barcode Printer", "HW-018", "Hardware & Compute", 95000, 68000, "piece", False, None, "Thermal transfer warehouse tracking printer"),
            ("Honeywell Granit Industrial Scanner", "HW-019", "Hardware & Compute", 35000, 24000, "piece", False, None, "Rugged 2D barcode scanner for harsh logistics floors"),
            ("StarTech 42U Server Rack Cable Manager", "HW-020", "Hardware & Compute", 12500, 7500, "piece", False, None, "Horizontal and vertical cable ducts with finger duct covers"),

            # Software & Platforms (18)
            ("DealFlow CPQ Enterprise License", "SW-001", "Software & Platforms", 180000, 25000, "license", False, None, "Enterprise quote-to-cash CPQ engine with discount guards"),
            ("Oracle Database Enterprise Edition", "SW-002", "Software & Platforms", 650000, 120000, "core", False, None, "High-availability multi-tenant transactional database"),
            ("Microsoft Windows Server 2025 (16-Core)", "SW-003", "Software & Platforms", 85000, 52000, "license", False, None, "Datacenter edition with unlimited virtual machine containers"),
            ("Red Hat Enterprise Linux 9 Server", "SW-004", "Software & Platforms", 72000, 38000, "socket", False, None, "Standard 2-socket annual production OS subscription"),
            ("VMware vSphere 8 Enterprise Plus", "SW-005", "Software & Platforms", 240000, 65000, "cpu", False, None, "Full virtualisation stack with vMotion and DRS automation"),
            ("Tableau Server Enterprise (25 Users)", "SW-006", "Software & Platforms", 320000, 95000, "pack", False, None, "Self-service business intelligence and dashboard platform"),
            ("Salesforce Sales Cloud Connector", "SW-007", "Software & Platforms", 95000, 15000, "license", False, None, "Bidirectional sync pipeline for leads, quotes, and accounts"),
            ("SAP S/4HANA Finance Bridge", "SW-008", "Software & Platforms", 280000, 45000, "license", False, None, "Real-time ledger posting connector for ERP general ledger"),
            ("Jira Data Center (500 Users)", "SW-009", "Software & Platforms", 410000, 110000, "pack", False, None, "Enterprise issue tracking and agile sprint management"),
            ("Confluence Data Center (500 Users)", "SW-010", "Software & Platforms", 290000, 80000, "pack", False, None, "Centralized knowledge base and documentation intranet"),
            ("GitLab Ultimate Self-Managed", "SW-011", "Software & Platforms", 350000, 90000, "year", False, None, "DevSecOps platform with automated SAST/DAST pipelines"),
            ("Postman Enterprise Workspaces", "SW-012", "Software & Platforms", 125000, 35000, "pack", False, None, "API development and governance collaboration platform"),
            ("SonarQube Enterprise Code Quality", "SW-013", "Software & Platforms", 175000, 40000, "license", False, None, "Static code analysis supporting up to 5M lines of code"),
            ("Camunda BPM Enterprise Engine", "SW-014", "Software & Platforms", 220000, 55000, "license", False, None, "Workflow orchestration engine with BPMN 2.0 visual modeler"),
            ("Elasticsearch Platinum Cluster", "SW-015", "Software & Platforms", 390000, 110000, "cluster", False, None, "Enterprise search, log aggregation, and observability tier"),
            ("Kong Enterprise API Gateway", "SW-016", "Software & Platforms", 270000, 70000, "license", False, None, "Cloud-native microservices gateway with mutual TLS auth"),
            ("Apache Kafka Confluent Enterprise", "SW-017", "Software & Platforms", 480000, 130000, "cluster", False, None, "Enterprise event streaming platform with Schema Registry"),
            ("AppDynamics APM Production Agent", "SW-018", "Software & Platforms", 195000, 55000, "license", False, None, "Application performance monitoring with business transaction tracing"),

            # Cloud & Infrastructure (15)
            ("AWS Dedicated Cloud Direct Connect 10G", "CLD-001", "Cloud & Infrastructure", 160000, 95000, "month", True, BillingCycle.MONTHLY, "Dedicated fiber link into AWS Asia-Pacific data centers"),
            ("Azure Virtual WAN Hub Enterprise", "CLD-002", "Cloud & Infrastructure", 125000, 75000, "month", True, BillingCycle.MONTHLY, "Global transit architecture interconnecting all corporate branches"),
            ("Google Cloud BigQuery Flat-Rate Slot (100)", "CLD-003", "Cloud & Infrastructure", 210000, 140000, "month", True, BillingCycle.MONTHLY, "Dedicated processing capacity for real-time SQL analytics"),
            ("Kubernetes Dedicated EKS Cluster 3-Node", "CLD-004", "Cloud & Infrastructure", 85000, 45000, "month", True, BillingCycle.MONTHLY, "Production container orchestration with automated autoscaling"),
            ("Redis Enterprise In-Memory Cache 50GB", "CLD-005", "Cloud & Infrastructure", 55000, 28000, "month", True, BillingCycle.MONTHLY, "Sub-millisecond latency distributed caching layer"),
            ("PostgreSQL HA Managed Multi-AZ 1TB", "CLD-006", "Cloud & Infrastructure", 75000, 40000, "month", True, BillingCycle.MONTHLY, "Automated failover, point-in-time recovery, and read replicas"),
            ("Snowflake Data Cloud Credits (500)", "CLD-007", "Cloud & Infrastructure", 175000, 120000, "pack", False, None, "Elastic data warehouse query processing credits"),
            ("Databricks Lakehouse Compute Unit (500)", "CLD-008", "Cloud & Infrastructure", 195000, 130000, "pack", False, None, "Unified analytics and Apache Spark ETL processing credits"),
            ("Cloudflare Enterprise Edge CDN", "CLD-009", "Cloud & Infrastructure", 95000, 50000, "month", True, BillingCycle.MONTHLY, "Global DDoS mitigation, Anycast routing, and Web Application Firewall"),
            ("Fastly Edge Compute Worker Pool", "CLD-010", "Cloud & Infrastructure", 65000, 35000, "month", True, BillingCycle.MONTHLY, "Sub-millisecond edge compute running WebAssembly modules"),
            ("HashiCorp Terraform Cloud Enterprise", "CLD-011", "Cloud & Infrastructure", 145000, 60000, "year", True, BillingCycle.YEARLY, "Infrastructure as Code collaborative provisioning engine"),
            ("HashiCorp Vault Secrets Engine", "CLD-012", "Cloud & Infrastructure", 185000, 75000, "year", True, BillingCycle.YEARLY, "Centralized credential leasing and encryption as a service"),
            ("Datadog Pro Infrastructure (50 Hosts)", "CLD-013", "Cloud & Infrastructure", 92000, 52000, "month", True, BillingCycle.MONTHLY, "Real-time metrics, log streaming, and synthetic uptime guards"),
            ("New Relic APM Full Stack Observability", "CLD-014", "Cloud & Infrastructure", 88000, 48000, "month", True, BillingCycle.MONTHLY, "End-to-end distributed tracing across microservices"),
            ("PagerDuty Enterprise Incident Response", "CLD-015", "Cloud & Infrastructure", 42000, 18000, "month", True, BillingCycle.MONTHLY, "Intelligent alert on-call routing with automated escalation"),

            # Cyber Security (15)
            ("Fortinet FortiGate 200F Security Appliance", "SEC-001", "Cyber Security", 295000, 210000, "piece", False, None, "Next-Gen Firewall with 27 Gbps IPS throughput & SSL inspection"),
            ("Palo Alto PA-450 Enterprise Firewall", "SEC-002", "Cyber Security", 360000, 260000, "piece", False, None, "ML-powered NGFW with automated zero-day threat prevention"),
            ("CrowdStrike Falcon Complete EDR (100 Endpoints)", "SEC-003", "Cyber Security", 280000, 140000, "year", True, BillingCycle.YEARLY, "24/7 managed endpoint detection and active remediation"),
            ("SentinelOne Singularity Complete (100 Seats)", "SEC-004", "Cyber Security", 240000, 120000, "year", True, BillingCycle.YEARLY, "Autonomous AI endpoint protection with one-click ransomware rollback"),
            ("Splunk Enterprise SIEM (10GB/Day)", "SEC-005", "Cyber Security", 420000, 210000, "year", True, BillingCycle.YEARLY, "Security information and real-time threat analysis engine"),
            ("CyberArk Privileged Access Manager (25 Vaults)", "SEC-006", "Cyber Security", 350000, 160000, "year", True, BillingCycle.YEARLY, "Credential rotation and privileged session recording"),
            ("Okta Workforce Identity Cloud (100 Users)", "SEC-007", "Cyber Security", 120000, 50000, "year", True, BillingCycle.YEARLY, "Adaptive MFA, single sign-on, and lifecycle provisioning"),
            ("Zscaler Internet Access Enterprise (100 Users)", "SEC-008", "Cyber Security", 190000, 90000, "year", True, BillingCycle.YEARLY, "Secure Web Gateway and zero-trust cloud network security"),
            ("Qualys VMDR Vulnerability Management", "SEC-009", "Cyber Security", 160000, 70000, "year", True, BillingCycle.YEARLY, "Continuous asset discovery, risk prioritization, and auto-patching"),
            ("Tenable.io Cyber Exposure Platform", "SEC-010", "Cyber Security", 175000, 80000, "year", True, BillingCycle.YEARLY, "Cloud-based vulnerability scanner for modern attack surfaces"),
            ("KnowBe4 Phishing Security Training (250 Users)", "SEC-011", "Cyber Security", 85000, 35000, "year", True, BillingCycle.YEARLY, "Interactive security awareness tests and fake attack simulations"),
            ("DigiCert Wildcard SSL Multi-Domain Certificate", "SEC-012", "Cyber Security", 45000, 18000, "year", True, BillingCycle.YEARLY, "RSA 2048-bit encryption certificate with malware scanning"),
            ("Imperva Web Application Firewall (Cloud WAF)", "SEC-013", "Cyber Security", 140000, 70000, "year", True, BillingCycle.YEARLY, "Mitigation of OWASP Top 10 vulnerabilities & automated bot blocking"),
            ("Veeam Backup & Replication v12 Enterprise", "SEC-014", "Cyber Security", 195000, 85000, "license", False, None, "Immutable ransomware-proof backup repository for hybrid clouds"),
            ("Check Point Quantum Spark Security Gateway", "SEC-015", "Cyber Security", 215000, 155000, "piece", False, None, "Comprehensive branch security with threat emulation sandbox"),

            # Professional Services (13)
            ("Enterprise Architecture Review Sprint", "SRV-001", "Professional Services", 150000, 60000, "sprint", False, None, "2-week deep dive audit of cloud architecture and security controls"),
            ("Full Cloud Migration & Cutover Sprint", "SRV-002", "Professional Services", 350000, 140000, "project", False, None, "Turnkey data and application lift-and-shift to public cloud"),
            ("On-site Hardware Setup & Cabling", "SRV-003", "Professional Services", 25000, 12000, "day", False, None, "Rack mounting, PDU cabling, and server burn-in validation"),
            ("Staff Team Training & Enablement (1-Day)", "SRV-004", "Professional Services", 35000, 15000, "session", False, None, "Live instructor-led workshop with recording and lab handbooks"),
            ("Penetration Testing & Red Team Audit", "SRV-005", "Professional Services", 180000, 75000, "audit", False, None, "Simulated adversarial cyberattack with executive risk matrix"),
            ("SOC2 / ISO 27001 Compliance Audit Readiness", "SRV-006", "Professional Services", 220000, 90000, "audit", False, None, "Gap analysis and evidence collection for external security auditors"),
            ("Data Pipeline & ETL Engineering (1-Week)", "SRV-007", "Professional Services", 80000, 35000, "week", False, None, "Senior data engineer dedicated to building custom ingest pipelines"),
            ("Custom Salesforce Integration Sprint", "SRV-008", "Professional Services", 160000, 65000, "sprint", False, None, "Custom Apex triggers, REST webhooks, and field sync logic"),
            ("Disaster Recovery Simulation Drill", "SRV-009", "Professional Services", 95000, 40000, "session", False, None, "Live failover testing of backup infrastructure to secondary region"),
            ("High-Performance Database Tuning Sprint", "SRV-010", "Professional Services", 110000, 45000, "sprint", False, None, "Query optimization, index rebuilds, and connection pooling config"),
            ("Executive CISO Advisory Retainer", "SRV-011", "Professional Services", 120000, 50000, "month", True, BillingCycle.MONTHLY, "Dedicated fractional Chief Information Security Officer consultation"),
            ("Quarterly IT Strategy Review Workshop", "SRV-012", "Professional Services", 50000, 20000, "quarter", False, None, "Executive technology roadmap alignment and budget forecasting"),
            ("Cloud Cost Optimization & FinOps Review", "SRV-013", "Professional Services", 130000, 50000, "sprint", False, None, "Rightsizing analysis, reserved instances audit, and waste reduction plan"),

            # Recurring Subscriptions (14)
            ("Encrypted Cloud Backup 1TB / mo", "SUB-001", "Recurring Subscriptions", 2400, 800, "month", True, BillingCycle.MONTHLY, "Automated offsite backup with 30-day versioning"),
            ("Encrypted Cloud Backup 10TB / mo", "SUB-002", "Recurring Subscriptions", 18000, 6500, "month", True, BillingCycle.MONTHLY, "High-volume deduplicated cold and warm backup storage"),
            ("24/7 Priority Support Plan (1-Hr SLA)", "SUB-003", "Recurring Subscriptions", 25000, 9000, "month", True, BillingCycle.MONTHLY, "Designated Technical Account Manager with 24/7 hotline"),
            ("Platinum Mission-Critical Support (15-Min SLA)", "SUB-004", "Recurring Subscriptions", 75000, 28000, "month", True, BillingCycle.MONTHLY, "Instant escalation bridge to tier-3 principal systems architects"),
            ("Weekly Automated Vulnerability Scan", "SUB-005", "Recurring Subscriptions", 12000, 4000, "month", True, BillingCycle.MONTHLY, "Automated discovery of open ports, CVEs, and expired certs"),
            ("SOC Continuous Log Monitoring 24/7", "SUB-006", "Recurring Subscriptions", 95000, 38000, "month", True, BillingCycle.MONTHLY, "Managed security operations center analyzing event streams"),
            ("Managed Cloud Patching & Updates", "SUB-007", "Recurring Subscriptions", 15000, 5000, "month", True, BillingCycle.MONTHLY, "Zero-downtime rolling OS kernel updates and application patches"),
            ("SSL Certificate Auto-Renewal Manager", "SUB-008", "Recurring Subscriptions", 3500, 1000, "month", True, BillingCycle.MONTHLY, "Automated ACME DNS-01 verification and deployment to load balancers"),
            ("Database DBA-as-a-Service Retainer", "SUB-009", "Recurring Subscriptions", 45000, 18000, "month", True, BillingCycle.MONTHLY, "Weekly vacuuming, index health checks, and slow-query triage"),
            ("Office 365 E5 Cloud Tenant (50 Users)", "SUB-010", "Recurring Subscriptions", 85000, 65000, "month", True, BillingCycle.MONTHLY, "Full productivity suite with Microsoft Defender for Cloud"),
            ("Google Workspace Enterprise Plus (50 Users)", "SUB-011", "Recurring Subscriptions", 75000, 55000, "month", True, BillingCycle.MONTHLY, "Cloud email, 5TB drive storage, Vault eDiscovery, and Meet encryption"),
            ("Zoom Rooms Enterprise Suite (10 Rooms)", "SUB-012", "Recurring Subscriptions", 28000, 16000, "month", True, BillingCycle.MONTHLY, "Centralized room scheduling, wireless sharing, and digital signage"),
            ("GitHub Enterprise Cloud (50 Seats)", "SUB-013", "Recurring Subscriptions", 52000, 38000, "month", True, BillingCycle.MONTHLY, "Enterprise cloud git repositories with Advanced Security"),
            ("Notion Team Enterprise Workspace (50 Seats)", "SUB-014", "Recurring Subscriptions", 34000, 22000, "month", True, BillingCycle.MONTHLY, "Collaborative connected workspace with AI search and audit logs"),

            # AI & Machine Learning (15)
            ("NVIDIA H100 80GB SXM5 Dedicated Node", "AI-001", "AI & Machine Learning", 450000, 310000, "month", True, BillingCycle.MONTHLY, "Dedicated 8x H100 NVLink node for LLM pre-training and fine-tuning"),
            ("NVIDIA L40S Inference GPU Instance", "AI-002", "AI & Machine Learning", 140000, 95000, "month", True, BillingCycle.MONTHLY, "High throughput image generation and transformer inference"),
            ("OpenAI ChatGPT Enterprise (100 Users)", "AI-003", "AI & Machine Learning", 280000, 180000, "year", True, BillingCycle.YEARLY, "Unlimited high-speed GPT-4o with zero training retention"),
            ("Anthropic Claude 3.5 Sonnet Enterprise API", "AI-004", "AI & Machine Learning", 195000, 120000, "pack", False, None, "100M input/output tokens pool with 200k context window"),
            ("Pinecone Vector Database Enterprise", "AI-005", "AI & Machine Learning", 65000, 30000, "month", True, BillingCycle.MONTHLY, "Real-time semantic search index for RAG knowledge bases"),
            ("Qdrant Managed Vector Search Cluster", "AI-006", "AI & Machine Learning", 52000, 24000, "month", True, BillingCycle.MONTHLY, "Fast payload filtering and hybrid dense/sparse vector search"),
            ("Weaviate Cloud Dedicated RAG Cluster", "AI-007", "AI & Machine Learning", 58000, 26000, "month", True, BillingCycle.MONTHLY, "Production vector database with native multi-modal support"),
            ("Weights & Biases Enterprise ML Tracking", "AI-008", "AI & Machine Learning", 140000, 60000, "year", True, BillingCycle.YEARLY, "Experiment tracking, model registry, and dataset versioning"),
            ("Langfuse LLM Observability & Tracing", "AI-009", "AI & Machine Learning", 42000, 18000, "month", True, BillingCycle.MONTHLY, "Token cost analytics, latency tracing, and prompt evaluations"),
            ("Hugging Face Enterprise Hub Workspace", "AI-010", "AI & Machine Learning", 85000, 40000, "year", True, BillingCycle.YEARLY, "Private model repos, gated datasets, and dedicated inference endpoints"),
            ("Custom RAG Knowledge Retrieval Pipeline", "AI-011", "AI & Machine Learning", 260000, 105000, "project", False, None, "Turnkey ingestion of company PDFs, databases, and Notion docs into RAG"),
            ("Synthetic Data Generation Suite", "AI-012", "AI & Machine Learning", 175000, 70000, "license", False, None, "Privacy-preserving tabular and image data generation engine"),
            ("Model Drift & Accuracy Monitoring Agent", "AI-013", "AI & Machine Learning", 38000, 15000, "month", True, BillingCycle.MONTHLY, "Continuous statistical tests against live inference pipelines"),
            ("vLLM Production Inference Cluster", "AI-014", "AI & Machine Learning", 165000, 95000, "month", True, BillingCycle.MONTHLY, "PagedAttention high-throughput self-hosted open source LLM cluster"),
            ("Label Studio Enterprise Annotation Engine", "AI-015", "AI & Machine Learning", 98000, 42000, "year", True, BillingCycle.YEARLY, "Multi-modal active learning annotation platform for machine learning teams"),

            # Networking & Telecom (15)
            ("Cisco Catalyst 9300 48-Port PoE+ Switch", "NET-001", "Networking & Telecom", 185000, 135000, "piece", False, None, "Stackable enterprise layer 3 switch with 480 Gbps stacking"),
            ("Cisco Nexus 93180YC-FX3 Data Center Switch", "NET-002", "Networking & Telecom", 490000, 360000, "piece", False, None, "48x 25G SFP28 + 6x 100G QSFP28 high-density spine/leaf switch"),
            ("Aruba CX 6300M 48G Class 4 PoE Switch", "NET-003", "Networking & Telecom", 165000, 115000, "piece", False, None, "Cloud-native switch with Virtual Switching Framework"),
            ("Aruba AP-635 Wi-Fi 6E Campus AP", "NET-004", "Networking & Telecom", 38000, 26000, "piece", False, None, "Tri-radio 802.11ax access point for high-density office zones"),
            ("Ubiquiti UniFi Enterprise 48 PoE Switch", "NET-005", "Networking & Telecom", 85000, 62000, "piece", False, None, "Layer 3 switch with 2.5G RJ45 ports and 10G SFP+ uplinks"),
            ("Ubiquiti U6 Enterprise Wi-Fi 6E AP", "NET-006", "Networking & Telecom", 24000, 16000, "piece", False, None, "High-capacity ceiling access point supporting 600+ clients"),
            ("Palo Alto SD-WAN ION 3200 Gateway", "NET-007", "Networking & Telecom", 195000, 140000, "piece", False, None, "App-defined SD-WAN router with redundant LTE failover"),
            ("Cisco ISR 4431 Integrated Services Router", "NET-008", "Networking & Telecom", 280000, 205000, "piece", False, None, "Enterprise branch router with multicore architecture & 1Gbps crypto"),
            ("10G SFP+ Dual-LC Optical Transceiver (Pack of 10)", "NET-009", "Networking & Telecom", 28000, 16000, "pack", False, None, "850nm 300m multimode fiber transceivers for data centers"),
            ("100G QSFP28 SR4 Optical Transceiver", "NET-010", "Networking & Telecom", 45000, 28000, "piece", False, None, "High-speed optical module for top-of-rack leaf-to-spine links"),
            ("Cat6A Shielded RJ45 Patch Leads 2m (Pack of 50)", "NET-011", "Networking & Telecom", 18000, 9500, "pack", False, None, "500MHz 10G-ready copper patch cables with snagless boots"),
            ("APC NetShelter SX 42U Server Rack Enclosure", "NET-012", "Networking & Telecom", 95000, 68000, "piece", False, None, "Multi-vendor compatible IT rack enclosure with integrated cable management"),
            ("Juniper EX4400 48-Port Multi-Gigabit Switch", "NET-013", "Networking & Telecom", 210000, 150000, "piece", False, None, "AI-driven cloud-managed switch with telemetry streaming"),
            ("Fortinet FortiSwitch 424E-FPOE Switch", "NET-014", "Networking & Telecom", 135000, 95000, "piece", False, None, "Secure Ethernet switch with full PoE+ power budget and FortiLink"),
            ("MikroTik CCR2004 12S+2XS 100G Router", "NET-015", "Networking & Telecom", 82000, 56000, "piece", False, None, "Powerful ARM 64-bit multi-core carrier-grade border router")
        ]

        products = []
        for name, sku, cat_name, b_price, c_price, unit, is_sub, b_cycle, desc in raw_products:
            category = cat_map[cat_name]
            p = Product(
                name=name,
                sku=sku,
                category_id=category.id,
                base_price=Decimal(str(b_price)),
                cost_price=Decimal(str(c_price)),
                tax=Decimal("18.00"),
                unit=unit,
                is_subscription=is_sub,
                billing_cycle=b_cycle,
                description=desc
            )
            products.append(p)

        db.add_all(products)
        await db.commit()
        for p in products:
            await db.refresh(p)

        print(f"[5/14 SUCCESS] Seeded {len(products)} Catalog Products!")

        # =========================================================================
        # 6. PRODUCT VARIANTS (120+ Total Variants)
        # =========================================================================
        print("[6/14] Seeding 120+ Product Variants...")
        variants = []
        hardware_prods = [p for p in products if p.unit in ("piece", "set")]
        software_prods = [p for p in products if not p.is_subscription and p.unit not in ("piece", "set")]
        sub_prods = [p for p in products if p.is_subscription]

        # Variants for hardware (laptops, servers, switches, firewalls)
        for p in hardware_prods[:16]:
            variants.extend([
                ProductVariant(product_id=p.id, name=f"{p.name} - Standard Config", attribute="Configuration", value="Standard", extra_price=Decimal("0.00")),
                ProductVariant(product_id=p.id, name=f"{p.name} - High Performance Spec", attribute="Configuration", value="High Spec (+32GB / Dual PSU)", extra_price=Decimal("18000.00")),
                ProductVariant(product_id=p.id, name=f"{p.name} - Ultra High Density Spec", attribute="Configuration", value="Max Spec (+64GB / Dual 10G)", extra_price=Decimal("38000.00")),
            ])

        # Variants for software licenses & clusters
        for p in software_prods[:18]:
            variants.extend([
                ProductVariant(product_id=p.id, name=f"{p.name} - Team Tier (10 Users)", attribute="License Tier", value="Team (10)", extra_price=Decimal("0.00")),
                ProductVariant(product_id=p.id, name=f"{p.name} - Corporate Tier (50 Users)", attribute="License Tier", value="Corporate (50)", extra_price=Decimal("45000.00")),
                ProductVariant(product_id=p.id, name=f"{p.name} - Enterprise Site License", attribute="License Tier", value="Site License (Unlimited)", extra_price=Decimal("125000.00")),
            ])

        # Variants for cloud & subscriptions
        for p in sub_prods[:12]:
            variants.extend([
                ProductVariant(product_id=p.id, name=f"{p.name} - 8x5 Business Hours", attribute="SLA Level", value="8x5 Standard", extra_price=Decimal("0.00")),
                ProductVariant(product_id=p.id, name=f"{p.name} - 24x7 Mission Critical", attribute="SLA Level", value="24x7 Priority SLA", extra_price=Decimal("15000.00")),
            ])

        db.add_all(variants)
        await db.commit()
        print(f"[6/14 SUCCESS] Seeded {len(variants)} Product Variants!")

        # =========================================================================
        # 7. WAREHOUSES & REGIONAL STOCK (10 Warehouses, 500+ Stock Records)
        # =========================================================================
        print("[7/14] Seeding 10 Regional Warehouses & 500+ Stock Inventory Records...")
        warehouses = [
            Warehouse(name="Mumbai Central Distribution Hub", location="Bhiwandi, Mumbai", shipping_cost=Decimal("450.00")),
            Warehouse(name="Delhi NCR Logistics Depot", location="Okhla Phase III, New Delhi", shipping_cost=Decimal("500.00")),
            Warehouse(name="Bengaluru Tech Corridor Hub", location="Electronic City, Bengaluru", shipping_cost=Decimal("400.00")),
            Warehouse(name="Hyderabad Deccan Logistics", location="Shamshabad, Hyderabad", shipping_cost=Decimal("420.00")),
            Warehouse(name="Chennai Port Maritime Terminal", location="Ennore Express, Chennai", shipping_cost=Decimal("480.00")),
            Warehouse(name="Pune Western Industrial Depot", location="Chakan Auto Zone, Pune", shipping_cost=Decimal("430.00")),
            Warehouse(name="Kolkata Eastern Gateway", location="Dankuni Freight Complex, Kolkata", shipping_cost=Decimal("550.00")),
            Warehouse(name="Ahmedabad Western Logistics Park", location="Sanand Industrial Area, Ahmedabad", shipping_cost=Decimal("460.00")),
            Warehouse(name="Jaipur Northern Cargo Logistics", location="Sitapura Industrial Area, Jaipur", shipping_cost=Decimal("470.00")),
            Warehouse(name="Kochi Southern Maritime Hub", location="Willingdon Island, Kochi", shipping_cost=Decimal("490.00")),
        ]
        db.add_all(warehouses)
        await db.commit()
        for wh in warehouses:
            await db.refresh(wh)

        # Unique physical products to stock in warehouses
        physical_prods_dict = {
            p.id: p for p in products
            if p.unit in ("piece", "set", "pack", "license", "core", "socket", "cpu", "sprint") or not p.is_subscription
        }
        physical_prods = list(physical_prods_dict.values())

        stocks = []
        seen_stock_pairs = set()

        for wh in warehouses:
            for p in physical_prods:
                pair = (wh.id, p.id)
                if pair not in seen_stock_pairs:
                    seen_stock_pairs.add(pair)
                    qty = random.randint(25, 300)
                    res = random.randint(0, min(qty // 3, 20))
                    stocks.append(WarehouseStock(
                        warehouse_id=wh.id,
                        product_id=p.id,
                        quantity=qty,
                        reserved=res
                    ))

        db.add_all(stocks)
        await db.commit()
        print(f"[7/14 SUCCESS] Seeded {len(warehouses)} Warehouses with {len(stocks)} Stock records!")

        # =========================================================================
        # 8. CUSTOMER TIER PRICE LISTS & ITEMS (4 Price Lists, 440 Price Items)
        # =========================================================================
        print("[8/14] Seeding 4 Customer Tier Price Lists with 440 Tiered Price Items...")
        pl_bronze = PriceList(name="Bronze Tier Standard Rates", tier=CustomerTier.BRONZE, currency="INR")
        pl_silver = PriceList(name="Silver Corporate Partner Rates", tier=CustomerTier.SILVER, currency="INR")
        pl_gold = PriceList(name="Gold Enterprise Preferred", tier=CustomerTier.GOLD, currency="INR")
        pl_platinum = PriceList(name="Platinum Global Strategic Accounts", tier=CustomerTier.PLATINUM, currency="INR")
        price_lists = [pl_bronze, pl_silver, pl_gold, pl_platinum]

        db.add_all(price_lists)
        await db.commit()
        for pl in price_lists:
            await db.refresh(pl)

        tier_discounts = {
            pl_bronze: Decimal("0.05"),
            pl_silver: Decimal("0.10"),
            pl_gold: Decimal("0.15"),
            pl_platinum: Decimal("0.22"),
        }
        price_list_items = []
        for pl, disc in tier_discounts.items():
            for prod in products:
                discounted = round(prod.base_price * (Decimal("1.00") - disc), 2)
                price_list_items.append(PriceListItem(
                    price_list_id=pl.id,
                    product_id=prod.id,
                    price=discounted
                ))

        db.add_all(price_list_items)
        await db.commit()
        print(f"[8/14 SUCCESS] Seeded {len(price_lists)} Price Lists with {len(price_list_items)} Tiered Price Items!")

        # =========================================================================
        # 9. SUBSCRIPTION PLANS & UPSELL RULES (120+ Recommendation Rules)
        # =========================================================================
        print("[9/14] Seeding Subscription Plans & 120+ Upsell Recommendation Rules...")
        sp_monthly = SubscriptionPlan(name="Monthly Standard", billing_cycle=BillingCycle.MONTHLY, prorate_on_change=True, cancel_policy="Immediate cancellation, no penalty")
        sp_quarterly = SubscriptionPlan(name="Quarterly Growth Plan", billing_cycle=BillingCycle.QUARTERLY, prorate_on_change=True, cancel_policy="15-day notice")
        sp_annual = SubscriptionPlan(name="Annual Enterprise Agreement", billing_cycle=BillingCycle.YEARLY, prorate_on_change=True, cancel_policy="30-day notice, pro-rata refund", partial_refund=True)
        sp_strategic = SubscriptionPlan(name="Strategic Multi-Year Commitment", billing_cycle=BillingCycle.YEARLY, prorate_on_change=False, cancel_policy="60-day notice with annual lock-in")
        plans = [sp_monthly, sp_quarterly, sp_annual, sp_strategic]
        db.add_all(plans)
        await db.commit()
        for pln in plans:
            await db.refresh(pln)

        upsell_rules = []
        seen_pairs = set()

        # Pair hardware with security and support subscriptions
        sec_prods = [p for p in products if p.category_id == cat_map["Cyber Security"].id]
        srv_prods = [p for p in products if p.category_id in (cat_map["Professional Services"].id, cat_map["Recurring Subscriptions"].id)]

        for hw in hardware_prods[:25]:
            for sec in sec_prods[:3]:
                pair = (hw.id, sec.id)
                if pair not in seen_pairs and hw.id != sec.id:
                    seen_pairs.add(pair)
                    upsell_rules.append(UpsellRule(
                        source_product_id=hw.id,
                        target_product_id=sec.id,
                        score=random.randint(70, 98),
                        is_promoted=random.choice([True, False]),
                        min_margin=15.0
                    ))
            for srv in srv_prods[:3]:
                pair = (hw.id, srv.id)
                if pair not in seen_pairs and hw.id != srv.id:
                    seen_pairs.add(pair)
                    upsell_rules.append(UpsellRule(
                        source_product_id=hw.id,
                        target_product_id=srv.id,
                        score=random.randint(65, 95),
                        is_promoted=random.choice([True, False]),
                        min_margin=20.0
                    ))

        # Fill up to 125 rules
        while len(upsell_rules) < 125:
            p1 = random.choice(products)
            p2 = random.choice(products)
            if p1.id != p2.id and (p1.id, p2.id) not in seen_pairs:
                seen_pairs.add((p1.id, p2.id))
                upsell_rules.append(UpsellRule(
                    source_product_id=p1.id,
                    target_product_id=p2.id,
                    score=random.randint(50, 95),
                    is_promoted=random.choice([True, False]),
                    min_margin=float(random.choice([10, 15, 20, 25]))
                ))

        db.add_all(upsell_rules)
        await db.commit()
        print(f"[9/14 SUCCESS] Seeded {len(upsell_rules)} Upsell Recommendation Rules!")

        # =========================================================================
        # 10. QUOTATIONS / DEALS (148 Real Enterprise Quotations Across All Statuses)
        # =========================================================================
        print("[10/14] Seeding 145+ Quotations across all pipeline lifecycle stages...")
        quotation_statuses = [
            (QuotationStatus.CONFIRMED, 26),
            (QuotationStatus.APPROVED, 26),
            (QuotationStatus.SENT_TO_CUSTOMER, 22),
            (QuotationStatus.UNDER_NEGOTIATION, 22),
            (QuotationStatus.PENDING_FINANCE, 16),
            (QuotationStatus.PENDING_MANAGER, 16),
            (QuotationStatus.DRAFT, 12),
            (QuotationStatus.REJECTED, 5),
            (QuotationStatus.CANCELLED, 3)
        ]

        quotations = []
        q_counter = 1

        for status_enum, count in quotation_statuses:
            for _ in range(count):
                rep = random.choice(reps)
                customer = random.choice(customers)
                tier = customer.customer_tier or CustomerTier.BRONZE

                # Days back determines realistic time distribution
                days_ago = random.randint(1, 60)
                q_created_at = now - timedelta(days=days_ago, hours=random.randint(1, 23), minutes=random.randint(0, 59))
                q_updated_at = q_created_at + timedelta(hours=random.randint(2, 48))

                q_num = f"QT-2024-{q_counter:04d}"
                portal_tok = f"portal-token-deal-{q_counter:04d}"

                # Build 2 to 4 quotation lines
                num_lines = random.randint(2, 4)
                chosen_prods = random.sample(products, num_lines)

                subtotal = Decimal("0.00")
                discount_amount = Decimal("0.00")
                tax_amount = Decimal("0.00")
                total = Decimal("0.00")
                total_cost = Decimal("0.00")

                lines_for_quote = []
                for p in chosen_prods:
                    qty = random.randint(1, 10)
                    unit_p = p.base_price

                    if status_enum in (QuotationStatus.DRAFT, QuotationStatus.PENDING_MANAGER):
                        disc_pct = random.choice([0.0, 5.0, 8.0, 12.0, 18.0])
                    elif status_enum == QuotationStatus.PENDING_FINANCE:
                        disc_pct = random.choice([16.0, 20.0, 24.0])
                    elif status_enum == QuotationStatus.REJECTED:
                        disc_pct = random.choice([25.0, 30.0, 35.0])
                    else:
                        disc_pct = random.choice([0.0, 5.0, 10.0, 15.0])

                    line_gross = unit_p * Decimal(str(qty))
                    line_disc = round(line_gross * (Decimal(str(disc_pct)) / Decimal("100.0")), 2)
                    line_taxable = line_gross - line_disc
                    line_tax = round(line_taxable * Decimal("0.18"), 2)
                    line_tot = line_taxable + line_tax
                    line_c_total = p.cost_price * Decimal(str(qty))
                    line_margin = float(round(((line_taxable - line_c_total) / line_taxable * 100), 1)) if line_taxable > 0 else 0.0

                    subtotal += line_gross
                    discount_amount += line_disc
                    tax_amount += line_tax
                    total += line_tot
                    total_cost += line_c_total

                    l_type = LineType.SUBSCRIPTION if p.is_subscription else LineType.ONE_TIME
                    lines_for_quote.append((p, l_type, qty, unit_p, p.cost_price, disc_pct, line_tot, line_margin))

                overall_taxable = subtotal - discount_amount
                overall_margin = float(round(((overall_taxable - total_cost) / overall_taxable * 100), 1)) if overall_taxable > 0 else 0.0

                disc_ratio = float(discount_amount / subtotal) * 100 if subtotal > 0 else 0.0
                risk_score = round(min(100.0, max(0.0, (disc_ratio * 1.5) + (10.0 if overall_margin < 20 else 0.0))), 1)

                q = Quotation(
                    quotation_number=q_num,
                    rep_id=rep.id,
                    customer_id=customer.id,
                    customer_tier=tier,
                    status=status_enum,
                    blended_risk_score=risk_score,
                    subtotal=subtotal,
                    tax_amount=tax_amount,
                    discount_amount=discount_amount,
                    total=total,
                    margin=overall_margin,
                    portal_token=portal_tok,
                    customer_notes=f"Deployment contract for {customer.company_name} multi-location setup.",
                    rep_notes="Commercial scope reviewed. Payment term Net-30 approved.",
                    expiry_date=now + timedelta(days=random.randint(10, 45)),
                    last_activity_at=q_updated_at,
                    created_at=q_created_at,
                    updated_at=q_updated_at
                )
                quotations.append((q, lines_for_quote))
                q_counter += 1

        # Commit all quotations first to get their generated IDs
        for q, _ in quotations:
            db.add(q)
        await db.commit()

        print(f"[10/14 SUCCESS] Seeded {len(quotations)} Pipeline Quotations!")

        # =========================================================================
        # 11. QUOTATION LINES, APPROVALS, FULFILLMENTS, INVOICES, NEGOTIATIONS
        # =========================================================================
        print("[11/14] Linking Quotation Lines, Approvals, Invoices, Fulfillments, Subscriptions...")
        all_quotation_lines = []
        all_approvals = []
        all_fulfillments = []
        all_invoices = []
        all_negotiations = []
        all_subscriptions = []
        all_audit_logs = []
        all_notifications = []

        inv_counter = 1

        for q, lines_info in quotations:
            await db.refresh(q)

            # 1. Quotation Lines
            for p, l_type, qty, unit_p, c_price, disc_pct, line_tot, line_margin in lines_info:
                ql = QuotationLine(
                    quotation_id=q.id,
                    product_id=p.id,
                    line_type=l_type,
                    quantity=qty,
                    unit_price=unit_p,
                    cost_price=c_price,
                    discount=disc_pct,
                    tax=Decimal("18.00"),
                    line_total=line_tot,
                    margin=line_margin,
                    created_at=q.created_at
                )
                all_quotation_lines.append(ql)

                # Fulfillment Lines (for physical products on Confirmed, Approved, Sent quotes)
                if not p.is_subscription and q.status in (QuotationStatus.CONFIRMED, QuotationStatus.APPROVED, QuotationStatus.SENT_TO_CUSTOMER, QuotationStatus.UNDER_NEGOTIATION):
                    wh = random.choice(warehouses)
                    f_status = (
                        FulfillmentStatus.FULFILLED if q.status == QuotationStatus.CONFIRMED and random.random() > 0.3
                        else (FulfillmentStatus.PARTIALLY_FULFILLED if random.random() > 0.5 else FulfillmentStatus.PENDING)
                    )
                    f_qty = qty if f_status == FulfillmentStatus.FULFILLED else (max(1, qty // 2) if f_status == FulfillmentStatus.PARTIALLY_FULFILLED else 0)
                    all_fulfillments.append(FulfillmentLine(
                        quotation_id=q.id,
                        warehouse_id=wh.id,
                        product_id=p.id,
                        quantity_needed=qty,
                        quantity_fulfilled=f_qty,
                        status=f_status,
                        is_backorder=(f_status == FulfillmentStatus.PENDING and random.random() > 0.7),
                        created_at=q.created_at
                    ))

            # 2. Approvals (Ensuring 120+ Approvals across quotes)
            if q.status in (QuotationStatus.APPROVED, QuotationStatus.CONFIRMED, QuotationStatus.SENT_TO_CUSTOMER):
                mgr = random.choice(managers)
                all_approvals.append(Approval(
                    quotation_id=q.id,
                    approver_id=mgr.id,
                    level=1,
                    action="APPROVED",
                    reason=f"Approved under standard {q.customer_tier.value} governance limits.",
                    decided_at=q.updated_at,
                    created_at=q.created_at
                ))
                # Level 2 Finance approval
                fin = random.choice(finance_users)
                all_approvals.append(Approval(
                    quotation_id=q.id,
                    approver_id=fin.id,
                    level=2,
                    action="APPROVED",
                    reason="Finance cleared: gross profit margin and payment risk acceptable.",
                    decided_at=q.updated_at,
                    created_at=q.created_at
                ))
            elif q.status == QuotationStatus.PENDING_FINANCE:
                mgr = random.choice(managers)
                all_approvals.append(Approval(
                    quotation_id=q.id,
                    approver_id=mgr.id,
                    level=1,
                    action="APPROVED",
                    reason="Manager tier-1 approval granted. Escalating to Finance for high discount rate.",
                    decided_at=q.created_at + timedelta(hours=4),
                    created_at=q.created_at
                ))
                fin = random.choice(finance_users)
                all_approvals.append(Approval(
                    quotation_id=q.id,
                    approver_id=fin.id,
                    level=2,
                    action="PENDING",
                    reason="Awaiting commercial controller review.",
                    decided_at=None,
                    created_at=q.created_at + timedelta(hours=4)
                ))
            elif q.status == QuotationStatus.PENDING_MANAGER:
                mgr = random.choice(managers)
                all_approvals.append(Approval(
                    quotation_id=q.id,
                    approver_id=mgr.id,
                    level=1,
                    action="PENDING",
                    reason="Initial sales representative quote submission awaiting review.",
                    decided_at=None,
                    created_at=q.created_at
                ))
            elif q.status == QuotationStatus.REJECTED:
                mgr = random.choice(managers)
                all_approvals.append(Approval(
                    quotation_id=q.id,
                    approver_id=mgr.id,
                    level=1,
                    action="REJECTED",
                    reason="Requested discount exceeds authorized margin floor.",
                    decided_at=q.updated_at,
                    created_at=q.created_at
                ))
            elif q.status == QuotationStatus.UNDER_NEGOTIATION:
                mgr = random.choice(managers)
                all_approvals.append(Approval(
                    quotation_id=q.id,
                    approver_id=mgr.id,
                    level=1,
                    action="APPROVED",
                    reason="Pre-approved for negotiation within +/- 3% margin flexibility.",
                    decided_at=q.updated_at,
                    created_at=q.created_at
                ))

            # 3. Commercial Invoices (Ensuring 120+ Invoices)
            if q.status in (QuotationStatus.CONFIRMED, QuotationStatus.APPROVED, QuotationStatus.SENT_TO_CUSTOMER, QuotationStatus.UNDER_NEGOTIATION, QuotationStatus.PENDING_FINANCE):
                # Primary Invoice
                inv_stat = (
                    InvoiceStatus.PAID if q.status == QuotationStatus.CONFIRMED and random.random() > 0.25
                    else (
                        InvoiceStatus.DRAFT if q.status in (QuotationStatus.UNDER_NEGOTIATION, QuotationStatus.PENDING_FINANCE)
                        else (InvoiceStatus.SENT if q.status != QuotationStatus.SENT_TO_CUSTOMER else random.choice([InvoiceStatus.SENT, InvoiceStatus.DRAFT]))
                    )
                )
                if inv_stat == InvoiceStatus.SENT and (now - q.created_at).days > 30:
                    inv_stat = InvoiceStatus.OVERDUE

                paid_time = q.updated_at + timedelta(days=random.randint(1, 10)) if inv_stat == InvoiceStatus.PAID else None
                all_invoices.append(Invoice(
                    invoice_number=f"INV-2024-{inv_counter:04d}",
                    quotation_id=q.id,
                    status=inv_stat,
                    amount=q.total,
                    paid_at=paid_time,
                    due_date=q.created_at + timedelta(days=30),
                    payment_ref=f"TXN-{random.randint(100000, 999999)}" if inv_stat == InvoiceStatus.PAID else None,
                    is_recurring=any(l[1] == LineType.SUBSCRIPTION for l in lines_info),
                    created_at=q.updated_at
                ))
                inv_counter += 1

                # If confirmed and older, add historical milestone/monthly invoice
                if q.status == QuotationStatus.CONFIRMED and (now - q.created_at).days > 15:
                    all_invoices.append(Invoice(
                        invoice_number=f"INV-2024-{inv_counter:04d}",
                        quotation_id=q.id,
                        status=InvoiceStatus.PAID,
                        amount=round(q.total * Decimal("0.30"), 2),
                        paid_at=q.created_at + timedelta(days=5),
                        due_date=q.created_at + timedelta(days=15),
                        payment_ref=f"TXN-{random.randint(100000, 999999)}",
                        is_recurring=False,
                        created_at=q.created_at
                    ))
                    inv_counter += 1

            # 4. Negotiations (Ensuring 110+ Negotiation records)
            if q.status in (QuotationStatus.UNDER_NEGOTIATION, QuotationStatus.APPROVED, QuotationStatus.CONFIRMED):
                sample_messages = [
                    ("Customer Procurement", "Can you offer an additional 5% discount if we commit to annual upfront payment?", 14.0),
                    ("Sales Rep", "We can offer a 3.5% additional rebate with Net-15 payment terms.", 12.5),
                    ("Customer Procurement", "Agreed on 3.5% rebate. Please update the commercial schedule.", 12.5),
                    ("Finance Desk", "Commercial terms vetted. Net-15 payment clause approved.", None),
                    ("Customer Procurement", "Please confirm warranty extension from 1-year to 3-years on all hardware items.", None),
                    ("Sales Rep", "3-year enterprise warranty included under Platinum support package.", 10.0),
                ]
                # Pick 1 to 3 messages per negotiation-eligible quote
                chosen_msgs = random.sample(sample_messages, random.randint(1, 3))
                for sender, msg, counter in chosen_msgs:
                    all_negotiations.append(Negotiation(
                        quotation_id=q.id,
                        requested_by=sender,
                        message=msg,
                        counter_discount=counter,
                        status="COMPLETED" if q.status in (QuotationStatus.APPROVED, QuotationStatus.CONFIRMED) else "PENDING",
                        created_at=q.updated_at
                    ))

            # 5. Audit Logs
            all_audit_logs.append(AuditLog(
                quotation_id=q.id,
                user_id=q.rep_id,
                action=AuditAction.CREATED,
                details=f"Quotation {q.quotation_number} generated with {len(lines_info)} lines totaling INR {q.total:,.2f}",
                metadata_json={"total": float(q.total), "margin": q.margin},
                created_at=q.created_at
            ))
            if q.status in (QuotationStatus.APPROVED, QuotationStatus.CONFIRMED):
                all_audit_logs.append(AuditLog(
                    quotation_id=q.id,
                    user_id=q.rep_id,
                    action=AuditAction.APPROVED,
                    details=f"Quotation approved by management at blended risk score {q.blended_risk_score}%.",
                    metadata_json={"status": q.status.value},
                    created_at=q.updated_at
                ))
            if q.status == QuotationStatus.CONFIRMED:
                all_audit_logs.append(AuditLog(
                    quotation_id=q.id,
                    user_id=q.customer_id,
                    action=AuditAction.CONFIRMED,
                    details="Customer confirmed proposal online via client portal.",
                    metadata_json={"status": "CONFIRMED"},
                    created_at=q.updated_at
                ))

            # 6. Notifications
            all_notifications.append(Notification(
                user_id=q.rep_id,
                title=f"Deal Status: {q.quotation_number}",
                message=f"Quotation has transitioned to {q.status.value}",
                is_read=random.choice([True, False]),
                link=f"/builder/{q.id}",
                created_at=q.updated_at
            ))

        db.add_all(all_quotation_lines)
        db.add_all(all_approvals)
        db.add_all(all_fulfillments)
        db.add_all(all_invoices)
        db.add_all(all_negotiations)
        db.add_all(all_audit_logs)
        db.add_all(all_notifications)
        await db.commit()

        print(f"[11/14 SUCCESS] Seeded Quotation Lines ({len(all_quotation_lines)}), Approvals ({len(all_approvals)}), Invoices ({len(all_invoices)}), Fulfillments ({len(all_fulfillments)}), Negotiations ({len(all_negotiations)})!")

        # =========================================================================
        # 12. ACTIVE & STANDALONE CLIENT SUBSCRIPTIONS (115+ Subscriptions)
        # =========================================================================
        print("[12/14] Seeding 110+ Enterprise Subscriptions across clients...")
        sub_catalog_prods = [p for p in products if p.is_subscription or p.billing_cycle is not None]
        active_quotes = [q for q, _ in quotations if q.status in (QuotationStatus.CONFIRMED, QuotationStatus.APPROVED)]

        sub_counter = 0
        while len(all_subscriptions) < 115:
            q = random.choice(active_quotes)
            prod = random.choice(sub_catalog_prods)
            plan = random.choice(plans)
            qty = random.randint(1, 5)
            s_date = now - timedelta(days=random.randint(15, 180))
            sub_stat = random.choice(["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "PAST_DUE"])

            all_subscriptions.append(Subscription(
                quotation_id=q.id,
                plan_id=plan.id,
                product_id=prod.id,
                quantity=qty,
                unit_price=prod.base_price,
                start_date=s_date,
                next_billing_date=now + timedelta(days=random.randint(3, 30)),
                status=sub_stat,
                created_at=s_date
            ))
            sub_counter += 1

        db.add_all(all_subscriptions)
        await db.commit()
        print(f"[12/14 SUCCESS] Seeded {len(all_subscriptions)} Client Subscriptions!")

        # =========================================================================
        # 13. ADDITIONAL NOTIFICATIONS & AUDIT LOGS TO REACH 150+ / 250+
        # =========================================================================
        print("[13/14] Finalizing System Notifications & Audit Logs...")
        extra_notifs = []
        for u in reps[:15] + managers[:5] + finance_users[:5]:
            extra_notifs.append(Notification(
                user_id=u.id,
                title="Commercial Target Milestone",
                message="Q3 regional enterprise deals volume has surpassed INR 50,000,000.",
                is_read=True,
                link="/dashboard",
                created_at=now - timedelta(days=2)
            ))
            extra_notifs.append(Notification(
                user_id=u.id,
                title="System Policy Update",
                message="New discount delegation matrix v2.4 is now active for Gold and Platinum tiers.",
                is_read=False,
                link="/quotations",
                created_at=now - timedelta(hours=6)
            ))

        db.add_all(extra_notifs)
        await db.commit()

        # =========================================================================
        # 14. ENTERPRISE SEED SUMMARY AUDIT
        # =========================================================================
        print("\n===================================================================")
        print("  DEALFLOW360 ENTERPRISE SEED AUDIT — 100+ RECORDS EVERYWHERE      ")
        print("===================================================================")
        print(f" -> 1. Users (Admins, Managers, Reps, Customers): {len(users)}")
        print(f" -> 2. Product Categories:                        {len(categories)}")
        print(f" -> 3. Catalog Products:                           {len(products)}")
        print(f" -> 4. Product Variants:                           {len(variants)}")
        print(f" -> 5. Regional Warehouses:                        {len(warehouses)}")
        print(f" -> 6. Warehouse Stock Inventory Records:          {len(stocks)}")
        print(f" -> 7. Customer Tier Price Lists:                  {len(price_lists)}")
        print(f" -> 8. Discounted Tier Price Items:                {len(price_list_items)}")
        print(f" -> 9. Upsell & Cross-Sell Recommendation Rules:   {len(upsell_rules)}")
        print(f" -> 10. Pipeline Quotations / Enterprise Deals:    {len(quotations)}")
        print(f" -> 11. Quotation Line Items:                      {len(all_quotation_lines)}")
        print(f" -> 12. Deal Approvals History Records:            {len(all_approvals)}")
        print(f" -> 13. Warehouse Fulfillment Orders/Lines:        {len(all_fulfillments)}")
        print(f" -> 14. Commercial Invoices:                       {len(all_invoices)}")
        print(f" -> 15. Negotiation Threads & Counter-Offers:      {len(all_negotiations)}")
        print(f" -> 16. Active Client Subscriptions:               {len(all_subscriptions)}")
        print(f" -> 17. System Audit Trail Logs:                   {len(all_audit_logs)}")
        print(f" -> 18. In-App User Notifications:                 {len(all_notifications) + len(extra_notifs)}")
        print("===================================================================")
        print("[SUCCESS] Complete enterprise dataset populated with 100+ records in every core module!")

if __name__ == "__main__":
    asyncio.run(seed_enterprise_data())
