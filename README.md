# DealFlow360

**Enterprise Deal Pipeline and Client Portal**

DealFlow360 is a full-stack Configure, Price, Quote (CPQ) and deal management platform built for B2B sales teams. It covers the complete revenue lifecycle from product configuration and quotation building through multi-level approval workflows, fulfillment, invoicing, subscription management, and a branded self-service customer portal.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Core Modules](#core-modules)
- [User Roles and Permissions](#user-roles-and-permissions)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Real-Time System](#real-time-system)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Seeding Data](#seeding-data)
- [Running the Application](#running-the-application)
- [Application Routes](#application-routes)
- [Customer Portal](#customer-portal)
- [Discount and Approval Engine](#discount-and-approval-engine)
- [Deployment Notes](#deployment-notes)

---

## Overview

DealFlow360 is designed for organizations that need structured control over sales pricing, discount governance, and deal progression. The system enforces customer-tier-based pricing, configurable discount thresholds with automatic approval escalation, real-time deal health tracking, and end-to-end fulfillment management.

Key capabilities include:

- **CPQ Quotation Builder** with line-item discount controls, subscription line support, upsell suggestions, and PDF generation
- **Multi-stage Approval Workflow** with risk scoring, blended discount analysis, and bulk approval support
- **Pipeline Kanban Board** with drag-and-drop stage management and deal value aggregation
- **Subscription Lifecycle Management** with recurring billing cycle tracking, proration settings, and cancellation policies
- **Warehouse and Fulfillment Tracking** with per-facility stock visibility, reservation tracking, and order allocation
- **Invoice Management** with payment recording, partial payments, overdue tracking, and payment history
- **Customer Self-Service Portal** with tokenized secure access, quotation review, negotiation messaging, and subscription visibility
- **Real-Time Notifications** via WebSocket using Socket.IO for approval events, deal updates, and system alerts
- **Role-Based Access Control** with five distinct roles controlling visibility and action permissions throughout the system

---

## Architecture

```
DealFlow360/
  backend/          FastAPI application (Python 3.11+)
  frontend/         React 18 SPA (Vite)
  alembic/          Database migration scripts
```

The system follows a decoupled architecture:

- The **backend** exposes a REST API under `/api/` and mounts a Socket.IO server on the same ASGI process via `python-socketio`. All persistence is handled through SQLAlchemy 2.0 with an async PostgreSQL driver (`asyncpg`).
- The **frontend** is a single-page application that communicates exclusively via Axios REST calls and a Socket.IO client connection. State management uses Zustand for auth and global state, and TanStack Query for server-side data caching.
- There is no server-side rendering. The frontend builds to static assets and can be served independently from the backend.

---

## Technology Stack

### Backend

| Component         | Technology                              |
|-------------------|-----------------------------------------|
| Web Framework     | FastAPI 0.115+                          |
| ASGI Server       | Uvicorn with standard extras            |
| ORM               | SQLAlchemy 2.0 (async)                  |
| Database Driver   | asyncpg 0.29                            |
| Database          | PostgreSQL 14+                          |
| Migrations        | Alembic 1.13                            |
| Authentication    | JWT via python-jose and passlib/bcrypt  |
| Real-Time         | python-socketio 5.11                    |
| PDF Generation    | ReportLab 4.2                           |
| Email             | aiosmtplib 3.0                          |
| Rate Limiting     | slowapi 0.1.9                           |
| File Uploads      | python-multipart and Pillow             |
| HTTP Client       | httpx 0.27+                             |

### Frontend

| Component         | Technology                              |
|-------------------|-----------------------------------------|
| Framework         | React 18.3                              |
| Build Tool        | Vite 6.0                                |
| Routing           | React Router DOM 6.28                   |
| State Management  | Zustand 5.0                             |
| Server State      | TanStack React Query 5.62               |
| HTTP Client       | Axios 1.7                               |
| Real-Time         | socket.io-client 4.8                    |
| UI Icons          | Lucide React 0.468                      |
| Charts            | Recharts 2.15                           |
| Drag and Drop     | react-beautiful-dnd 13.1                |
| File Upload       | react-dropzone 14.3                     |
| Notifications     | react-hot-toast 2.4                     |
| QR Codes          | qrcode.react 4.2                        |
| Styling           | Tailwind CSS 3.4 with custom design tokens |

---

## Core Modules

### 1. Dashboard

Located at `/dashboard`. Provides a real-time overview of pipeline health, revenue metrics, pending approvals, deal stage distribution, and recent activity. Charts include revenue trends, deal funnel analysis, and product performance breakdowns.

### 2. Products and Catalog Management

Located at `/products`. Manages the product catalog including base pricing, SKU management, category assignment, product images, and per-category maximum discount limits. Supports grid and table view modes with full search and filtering.

### 3. Price Lists

Located at `/price-lists`. Defines contracted tier-specific pricing overrides for individual products. Each price list is associated with a customer tier (Bronze, Silver, Gold, Platinum) and specifies a fixed price per product SKU that supersedes the base price during quotation creation.

### 4. Discount Tiers and Governance

Located at `/discount-tiers`. Configures the discount authority thresholds per customer tier and product category. Each tier defines a maximum discount percentage, and whether Sales Manager and/or Finance approval is required when discounts exceed the tier limit.

### 5. Quotation Builder

Located at `/quotations/new` and `/quotations/:id`. The full CPQ interface where sales reps build proposals. Features include:

- Customer and tier selection with automatic price list application
- Line item entry with one-time and subscription product support
- Per-line discount entry with real-time validation against tier and category limits
- Blended risk score calculation across all line items
- Upsell recommendation panel driven by affinity rules
- Quotation PDF generation and download
- Negotiation notes and customer communication thread
- Status tracking across the full quotation lifecycle

### 6. Quotations List

Located at `/quotations`. High-density table view of all quotations with multi-field search, status filtering, sortable columns, and pagination. Supports bulk operations and direct navigation to the quotation builder.

### 7. Pipeline Kanban

Located at `/pipeline`. Visual drag-and-drop board showing all active deals organized by status stage. Displays deal value, customer tier, assigned rep, and days-in-stage indicators. Columns represent quotation lifecycle stages from Draft through Confirmed.

### 8. Approval Queue

Located at `/approvals`. The executive review interface for Sales Managers and Finance approvers. Features:

- Compact table list and expanded card views
- Risk score display with blended discount breakdown
- Line-by-line discount overage analysis
- Approve, Return for Revision, and Reject actions with required reason notes
- Bulk approval for multiple quotations simultaneously
- Audit trail per quotation showing all approval history
- Real-time updates via WebSocket

### 9. Fulfillment

Located at `/fulfillment`. Tracks the physical delivery of confirmed orders. Shows per-order fulfillment status (Pending, Partially Fulfilled, Fulfilled, Backordered), warehouse allocation, and dispatch management.

### 10. Subscriptions

Located at `/subscriptions`. Manages active recurring subscriptions generated from confirmed quotation subscription lines. Tracks billing cycle, next billing date, unit price, quantity, and subscription status (Active, Paused, Cancelled).

### 11. Subscription Plans Configuration

Located at `/subscription-plans`. Admin configuration for recurring plan definitions including billing cycle (Monthly, Quarterly, Yearly), proration on mid-cycle changes, cancellation policy terms, and partial refund eligibility.

### 12. Invoices

Located at `/invoices`. Manages the full invoicing lifecycle. Features include payment recording (full and partial), overdue tracking, payment history, and invoice status management (Draft, Sent, Paid, Overdue, Cancelled).

### 13. Deal Health

Located at `/deal-health`. Analytical view showing deal risk indicators, stalled deal detection, discount concentration analysis, and pipeline health scoring across the active deal book.

### 14. Reports

Located at `/reports`. Aggregated reporting across revenue, pipeline conversion rates, discount utilization, team performance, and subscription revenue.

### 15. Warehouses

Located at `/warehouses`. Manages physical storage facilities and live inventory across two sections:

- **Facilities**: Create, edit, and activate or deactivate warehouse locations with shipping cost configuration. Sortable by name, total units, SKU count, and shipping cost.
- **Stock Management**: Per-product per-warehouse inventory with quantity-on-hand, reserved (allocated to orders), and net-available calculations. Includes stock editing and product-to-warehouse connection management.

### 16. Upsell Rules

Located at `/upsell-rules`. Configures product affinity rules that drive the CPQ recommendation engine. Each rule defines a source product, a target recommendation, an affinity score (0 to 100), a minimum margin gate, and a promoted flag that pins the recommendation to the top of the quotation builder panel.

### 17. Users

Located at `/users`. Admin-only user management. Create, edit, deactivate, and manage user accounts with role assignment, customer tier linkage, and profile photo support.

### 18. Customer Portal

Located at `/portal/:token` and `/portal/login`. Tokenized self-service portal for customers. Features:

- Secure token-based access without a traditional internal login
- Quotation review and status tracking
- Negotiation message thread with sales reps
- Subscription visibility
- Invoice history and payment status
- QR code sharing for mobile access

---

## User Roles and Permissions

| Role            | Description                                                                    |
|-----------------|--------------------------------------------------------------------------------|
| `ADMIN`         | Full system access including user management and all configuration screens     |
| `SALES_MANAGER` | Product, pricing, discount tiers, warehouse access; approval authority         |
| `SALES_REP`     | Quotation creation and management; pipeline visibility; fulfillment access     |
| `FINANCE`       | Approval queue access for financial review stage; invoice management           |
| `CUSTOMER`      | Portal-only access; read-only view of own quotations and subscriptions         |

Route-level guards enforce role access on both the frontend (React Router Guard component) and backend (FastAPI dependency injection on each router).

---

## Database Schema

| Table                  | Purpose                                               |
|------------------------|-------------------------------------------------------|
| `users`                | All system users across all roles                     |
| `products`             | Product catalog with SKUs, pricing, and categories    |
| `categories`           | Product categories with max discount limits           |
| `price_lists`          | Tier-based contracted pricing overrides               |
| `price_list_items`     | Individual product entries within a price list        |
| `quotations`           | Deal proposals with status, risk score, and metadata  |
| `quotation_lines`      | Individual line items within a quotation              |
| `approvals`            | Approval decision records per quotation               |
| `audit_logs`           | Full audit trail for all quotation state changes      |
| `negotiations`         | Customer-rep negotiation message threads              |
| `subscriptions`        | Active recurring subscription records                 |
| `subscription_plans`   | Plan definitions (cycle, proration, cancel policy)    |
| `invoices`             | Generated invoices from confirmed orders              |
| `invoice_line_items`   | Line-level breakdown within each invoice              |
| `payments`             | Payment records against invoices                      |
| `fulfillment_orders`   | Fulfillment records linked to confirmed quotations    |
| `warehouses`           | Physical storage facility definitions                 |
| `warehouse_stock`      | Per-product per-warehouse inventory quantities        |
| `upsell_rules`         | Product affinity recommendation rules                 |
| `discount_tier_config` | Per-tier discount authority thresholds                |
| `notifications`        | System notification records per user                  |

Primary keys use UUID strings throughout. All timestamp columns use UTC datetimes. Soft deletion is implemented via `is_active` boolean flags.

---

## API Reference

All API endpoints are prefixed with `/api/`. A transparent middleware layer also handles requests without the `/api` prefix for compatibility.

| Router Module   | Base Path             | Key Responsibilities                                                     |
|-----------------|-----------------------|--------------------------------------------------------------------------|
| `auth`          | `/api/auth`           | Login, signup, token refresh, user profile                               |
| `products`      | `/api/products`       | Catalog CRUD, categories, discount tiers, upsell rules, price lists      |
| `quotations`    | `/api/quotations`     | Quotation CRUD, line management, approval decisions, negotiation, PDF    |
| `fulfillment`   | `/api/fulfillment`    | Warehouses, stock management, fulfillment orders                         |
| `subscriptions` | `/api/subscriptions`  | Subscription plans, active subscriptions, status changes                 |
| `invoices`      | `/api/invoices`       | Invoice management, payment recording                                    |
| `negotiations`  | `/api/negotiations`   | Customer-rep messaging threads                                           |
| `dashboard`     | `/api/dashboard`      | Aggregated analytics and KPI metrics                                     |
| `notifications` | `/api/notifications`  | User notification retrieval and mark-read                                |

Interactive API documentation: `http://localhost:5000/docs` (Swagger UI)

---

## Real-Time System

DealFlow360 uses Socket.IO for real-time event delivery. The Socket.IO server is mounted as ASGI middleware alongside FastAPI on the same port (5000).

Events delivered to connected clients:

- Approval queue updates when a quotation enters or exits a pending state
- Notification delivery for deal status changes
- Live pipeline updates when quotations change stages
- Fulfillment status changes

The frontend connects via `socket.io-client` and subscribes to user-specific rooms keyed to the authenticated user's ID.

---

## Project Structure

```
DealFlow360/
  backend/
    app/
      config.py               Settings loaded from environment variables
      database.py             Async SQLAlchemy engine and session factory
      main.py                 FastAPI app factory, CORS config, Socket.IO mount
      middleware/             Custom HTTP request middleware
      models/
        models.py             ORM model definitions and all enum types
        user.py               User model
        product.py            Product and category models
        quotation.py          Quotation and line item models
        invoice.py            Invoice and payment models
        warehouse.py          Warehouse and stock models
        audit.py              Audit log model
      routers/
        auth.py               Authentication endpoints
        products.py           Product catalog and pricing endpoints
        quotations.py         Quotation lifecycle endpoints
        fulfillment.py        Warehouse and fulfillment endpoints
        subscriptions.py      Subscription management endpoints
        invoices.py           Invoice and payment endpoints
        negotiations.py       Customer negotiation endpoints
        dashboard.py          Analytics and reporting endpoints
        notifications.py      Notification endpoints
      sockets/
        server.py             Socket.IO server instance and event handlers
      utils/                  Shared utilities (PDF generation, email, etc.)
    alembic/                  Migration version scripts
    alembic.ini               Alembic configuration file
    requirements.txt          Python dependency list
    seed.py                   Basic seed data script
    seed_100.py               Full 100-record seed data script
    init_db.py                Database table initialization script
    .env.example              Environment variable template

  frontend/
    src/
      App.jsx                 Root component with routing and role guards
      main.jsx                React entry point
      index.css               Global styles and Tailwind design system tokens
      api/                    Axios API client modules organized by domain
      components/
        layout/               AppLayout, sidebar, and navigation shell
        ui/                   Shared primitives (Pagination, Portal modal, etc.)
      hooks/                  Custom React hooks
      pages/
        auth/                 Login and Signup
        dashboard/            Dashboard
        backend/              Admin configuration pages
          Products.jsx
          PriceLists.jsx
          DiscountTiers.jsx
          Warehouses.jsx
          SubscriptionPlans.jsx
          UpsellRules.jsx
          Users.jsx
        workspace/            Sales workspace pages
          QuotationsList.jsx
          QuotationBuilder.jsx
          PipelineKanban.jsx
          ApprovalQueue.jsx
          Fulfillment.jsx
          Subscriptions.jsx
          Invoices.jsx
          DealHealth.jsx
          Reports.jsx
        portal/               Customer portal
          CustomerPortal.jsx
          PortalLogin.jsx
      store/                  Zustand global state stores
      utils/                  Helper functions (auth redirect, formatters, etc.)
    package.json
    vite.config.js
    tailwind.config.js
```

---

## Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher with npm
- PostgreSQL 14 or higher
- Git

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd DealFlow360
```

### 2. Backend Setup

```bash
cd backend

python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your PostgreSQL connection string and secret keys
```

### 4. Initialize the Database

```bash
alembic upgrade head
```

### 5. Seed Sample Data (Optional)

```bash
# Full realistic dataset
python seed_100.py

# Minimal dataset
python seed.py
```

### 6. Frontend Setup

```bash
cd ../frontend
npm install
```

---

## Environment Variables

Backend (`backend/.env`):

| Variable             | Required | Description                                                                                   |
|----------------------|----------|-----------------------------------------------------------------------------------------------|
| `DATABASE_URL`       | Yes      | Async connection string. Format: `postgresql+asyncpg://user:pass@host:port/dbname`            |
| `JWT_SECRET`         | Yes      | Secret for signing access tokens. Use a long random string in production.                     |
| `JWT_REFRESH_SECRET` | Yes      | Secret for signing refresh tokens. Must differ from `JWT_SECRET`.                             |
| `PORT`               | No       | Uvicorn listen port. Defaults to 5000.                                                        |
| `FRONTEND_URL`       | No       | Frontend origin for CORS. Defaults to `http://localhost:5173`.                                |
| `EMAIL_USER`         | No       | SMTP username for outbound email.                                                             |
| `EMAIL_PASS`         | No       | SMTP password for outbound email.                                                             |
| `UPLOAD_DIR`         | No       | Filesystem path for product images and logo file uploads.                                     |

Frontend (`frontend/.env`):

| Variable       | Description                            |
|----------------|----------------------------------------|
| `VITE_API_URL` | Base URL of the backend API server.    |

---

## Database Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Roll back the most recent migration
alembic downgrade -1

# Generate a migration from current model changes
alembic revision --autogenerate -m "description of change"

# Check current applied migration
alembic current
```

Always generate and review a migration script before applying changes to a shared or production environment.

---

## Seeding Data

### Basic Seed

One user per role, small product catalog, handful of quotations.

```bash
cd backend
python seed.py
```

### Full Seed

100+ records covering all entities in the system.

```bash
cd backend
python seed_100.py
```

Default credentials:

| Role          | Email                       | Password    |
|---------------|-----------------------------|-------------|
| Admin         | admin@dealflow360.com       | password123 |
| Sales Manager | manager@dealflow360.com     | password123 |
| Sales Rep     | salesrep@dealflow360.com    | password123 |
| Finance       | finance@dealflow360.com     | password123 |

---

## Running the Application

### Backend

```bash
cd backend
uvicorn app.main:socket_app --reload --host 0.0.0.0 --port 5000
```

- API: `http://localhost:5000`
- Swagger UI: `http://localhost:5000/docs`
- ReDoc: `http://localhost:5000/redoc`
- Health: `http://localhost:5000/health`

### Frontend

```bash
cd frontend
npm run dev
```

- App: `http://localhost:5173`

### Production Build

```bash
cd frontend
npm run build
# Output: frontend/dist/
```

---

## Application Routes

| Path                  | Access Level                       | Description                             |
|-----------------------|------------------------------------|----------------------------------------|
| `/login`              | Public                             | Login page                              |
| `/signup`             | Public                             | Account registration                    |
| `/dashboard`          | All authenticated roles            | KPI dashboard and activity overview     |
| `/products`           | Admin, Sales Manager               | Product catalog management              |
| `/price-lists`        | Admin, Sales Manager               | Tier pricing configuration              |
| `/discount-tiers`     | Admin, Sales Manager               | Discount governance settings            |
| `/warehouses`         | Admin, Sales Manager, Finance      | Facility and stock management           |
| `/subscription-plans` | Admin, Sales Manager               | Recurring plan configuration            |
| `/upsell-rules`       | Admin, Sales Manager               | CPQ recommendation rules                |
| `/users`              | Admin only                         | User account management                 |
| `/quotations`         | All internal roles                 | Quotations list                         |
| `/quotations/new`     | Sales Rep, Sales Manager, Admin    | New quotation builder                   |
| `/quotations/:id`     | All internal roles                 | View and edit a specific quotation      |
| `/pipeline`           | All internal roles                 | Kanban deal board                       |
| `/approvals`          | Sales Manager, Finance, Admin      | Approval review queue                   |
| `/fulfillment`        | All internal roles                 | Order fulfillment tracking              |
| `/subscriptions`      | All internal roles                 | Subscription management                 |
| `/invoices`           | All internal roles                 | Invoice management                      |
| `/deal-health`        | All internal roles                 | Deal health analytics                   |
| `/reports`            | All internal roles                 | Reporting dashboard                     |
| `/portal/:token`      | Customer (token-gated)             | Customer self-service portal            |
| `/portal/login`       | Public                             | Customer portal login                   |

---

## Customer Portal

The customer portal is a separate application surface accessible without an internal login. Customers receive a unique access token via email or QR code that grants access to `/portal/:token`.

The portal provides:

- Read-only view of the customer's quotations and status
- Negotiation message thread with their assigned sales rep
- Subscription details and billing status
- Invoice history with payment status
- QR code sharing for mobile access

Portal sessions are validated on every request. Tokens are bound to a specific customer user record in the database.

---

## Discount and Approval Engine

### Discount Limits

When a discount is entered on a quotation line, the system resolves:

1. **Tier Maximum**: Default values are Bronze 5%, Silver 10%, Gold 15%, Platinum configurable via admin settings.
2. **Category Maximum**: Each product category can define an independent ceiling.
3. **Effective Maximum**: The lower of the tier and category maximums is enforced.

### Risk Scoring

Each quotation receives a blended risk score from 0 to 20 based on the magnitude and frequency of discount overages across all line items, weighted by customer tier.

### Approval Routing

On submission, the system checks the configured discount tier rules:

- Discounts within limits: quotation auto-approves directly to `APPROVED`
- Discounts over limit with `requiresManager` enabled: quotation enters `PENDING_MANAGER`
- After Sales Manager approval, if `requiresFinance` is enabled: quotation escalates to `PENDING_FINANCE`
- Finance approval: quotation moves to `APPROVED`

### Approval Actions

- **Approve**: Advance to the next stage or grant final approval
- **Return for Revision**: Return to the sales rep with a required reason note
- **Reject**: Permanently reject with a required reason note

All actions are written to the audit log with timestamp, actor identity, and reason text.

---

## Deployment Notes

### Backend

- Run Uvicorn behind Nginx or Caddy in production
- Socket.IO requires sticky sessions when using multiple workers unless a Redis adapter is configured for the message queue
- Set strong, randomly generated values for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- The `uploads/` directory must be backed by persistent storage with a volume mount in containerized environments

### Frontend

- Build with `npm run build` and serve `dist/` from a static file host
- Set `VITE_API_URL` in the build environment to the production backend URL
- Configure the web server to redirect all non-asset paths to `index.html` for client-side routing

### Database

- Use a managed PostgreSQL service (AWS RDS, Google Cloud SQL, Railway, Neon, or Supabase) in production
- Run `alembic upgrade head` as part of the deployment pipeline before starting a new backend version
- Back up the database before applying any migrations in production

---

## License

This project is proprietary software. All rights reserved.
