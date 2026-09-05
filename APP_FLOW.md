# DealFlow360 — Application Flow (Admin & Customer)

---

## ADMIN FLOW

### Step 1 — Login
```
Open http://localhost:5173/login
  → Click "Admin" demo card  (pre-fills admin@dealflow.com / Admin@123)
  → Click "Sign In"
  → POST /api/auth/login
  → JWT access token stored in Zustand + localStorage
  → Refresh token stored as httpOnly cookie
  → Redirected to /dashboard
```

---

### Step 2 — Dashboard
```
/dashboard
  ├── KPI Cards (fetched from GET /api/dashboard/metrics)
  │     ├── Total Quotations
  │     ├── Confirmed Deals & Value
  │     ├── Pending Approvals
  │     ├── Active Subscriptions
  │     └── Avg Deal Size
  │
  ├── Charts
  │     ├── Revenue Trend (AreaChart — Recharts)
  │     └── Pipeline by Status (BarChart — Recharts)
  │
  ├── Anomaly Alerts
  │     ├── Stalled Deals (no update in 7 days)
  │     ├── Discount Anomalies (unusually high discount %)
  │     └── Expiring Quotations (validity < 7 days)
  │
  └── Socket.io joins 'dashboard' room
        → auto-refreshes on 'dashboard:update' event
```

---

### Step 3 — Product Catalog Setup
```
/products  (ADMIN only)
  ├── View all products (GET /api/products)
  ├── Add New Product
  │     ├── Fill: Name, SKU, Base Price, Cost Price, Tax %, Category
  │     ├── Upload product image (FastAPI UploadFile → uploads/products/)
  │     └── POST /api/products → product created
  │
  ├── Edit Product → PUT /api/products/:id
  ├── Add Variants (size/color) → POST /api/products/:id/variants
  └── Delete Product → DELETE /api/products/:id
```

---

### Step 4 — Configure Discount Tiers
```
/discount-tiers  (ADMIN, SALES_MANAGER)
  ├── View 3 tiers: BRONZE, SILVER, GOLD
  ├── Set max discount % per tier
  │     ├── BRONZE → 5%  (most basic customers)
  │     ├── SILVER → 10%
  │     └── GOLD   → 20% (enterprise customers)
  └── PUT /api/products/discount-tiers/:tier → saved
```

---

### Step 5 — Set Up Upsell Rules
```
/upsell-rules  (ADMIN, SALES_MANAGER)
  ├── Create rule: IF product A in cart → SUGGEST product B
  ├── Trigger types:
  │     ├── PRODUCT_COMBO  — specific product pairing
  │     ├── QUANTITY_THRESHOLD — qty > N triggers suggestion
  │     └── CUSTOMER_TIER — only show upsell to GOLD customers
  └── POST /api/products/upsell-rules → rule saved
        (QuotationBuilder auto-shows these suggestions)
```

---

### Step 6 — Manage Warehouses & Stock
```
/warehouses  (ADMIN, SALES_MANAGER, FINANCE)
  ├── View 3 warehouses (Main, East, West)
  ├── Stock grid: rows = products, columns = warehouses
  ├── Adjust stock → PUT /api/fulfillment/warehouses/:wId/stock/:pId
  └── Low stock warning (< 10 units → red badge)
```

---

### Step 7 — Manage Users
```
/users  (ADMIN only)
  ├── View all users (GET /api/auth/users)
  ├── Create new user
  │     ├── Assign role: ADMIN / SALES_REP / SALES_MANAGER / FINANCE / CUSTOMER
  │     └── POST /api/auth/users
  ├── Deactivate user → PUT /api/auth/users/:id/status
  └── Reset password → PUT /api/auth/users/:id/reset-password
```

---

### Step 8 — Create a Quotation
```
/quotations/new  (ADMIN, SALES_REP, SALES_MANAGER)
  │
  ├── Fill Header
  │     ├── Customer name
  │     ├── Validity date
  │     └── Payment terms
  │
  ├── Add Line Items
  │     ├── Click "Add Product" → ProductPicker modal opens
  │     ├── Search by name or SKU
  │     ├── Select product → line added with base price & cost
  │     ├── Adjust: Quantity, Discount %, Tax %
  │     └── LiveMarginBar updates in real-time:
  │             ├── LIVE TOTAL (₹ incl. tax)
  │             ├── GROSS MARGIN % (with color bar: red/yellow/green)
  │             ├── RISK SCORE (0–15, glowing LED)
  │             └── APPROVAL PATH hint
  │
  ├── Upsell Suggestions appear automatically
  │     └── (based on UpsellRules configured in Step 5)
  │
  ├── Save Draft → POST /api/quotations  (status: DRAFT)
  │
  └── Submit for Approval → PUT /api/quotations/:id/submit
          → status becomes PENDING_MANAGER
          → Notification sent to Sales Manager
          → Socket.io emits 'approval:new' to 'approvers' room
```

---

### Step 9 — Approve Quotations
```
/approvals  (SALES_MANAGER, FINANCE, ADMIN)
  │
  ├── Stage 1: PENDING_MANAGER queue
  │     ├── View all quotations needing manager approval
  │     ├── Click quotation → see line items, discount, risk score
  │     ├── Approve → PUT /api/quotations/:id/decision { action: 'approve' }
  │     │     → If discount > 10% → status: PENDING_FINANCE
  │     │     → If discount ≤ 10% → status: APPROVED
  │     └── Reject → status: REJECTED, comment saved
  │
  ├── Stage 2: PENDING_FINANCE queue  (Finance user)
  │     ├── Same flow — Finance reviews high-discount deals
  │     └── Approve → status: APPROVED
  │
  └── Batch Actions
        ├── Select multiple quotations via checkboxes
        └── "Approve All" / "Reject All" → POST /api/quotations/batch-decision
```

---

### Step 10 — Send to Customer
```
/quotations/:id  (after APPROVED status)
  │
  ├── Click "Send to Customer"
  │     → PUT /api/quotations/:id/send
  │     → Backend generates portal_token (UUID) on quotation
  │     → Email sent to customer with portal URL
  │     → status: SENT_TO_CUSTOMER
  │
  └── Portal URL format:
        http://localhost:5173/portal/{portal_token}
```

---

### Step 11 — Monitor Negotiation
```
After customer opens portal and counter-offers:
  │
  ├── Admin/Rep sees notification (bell icon in Navbar)
  ├── Socket.io: 'negotiation:message' arrives in quotation room
  ├── View negotiation messages on quotation detail page
  └── Customer confirms → status: CONFIRMED
```

---

### Step 12 — Fulfillment
```
/fulfillment  (after CONFIRMED)
  │
  ├── Quotation appears in fulfillment list
  ├── View split plan (if stock spread across warehouses)
  │     ├── GET /api/fulfillment/:id/split
  │     └── Shows: Warehouse A → 3 units, Warehouse B → 2 units
  ├── Accept Split → POST /api/fulfillment/:id/accept-split
  └── Stock deducted from warehouse automatically
```

---

### Step 13 — Generate Invoice
```
/invoices
  │
  ├── Create Invoice from confirmed quotation
  │     → POST /api/invoices
  ├── Download PDF → GET /api/invoices/:id/pdf
  │     (Axios: responseType: 'blob' → browser download)
  ├── Send Invoice → PUT /api/invoices/:id/send (email)
  └── Mark as Paid → PUT /api/invoices/:id/pay
```

---

### Step 14 — Subscription (for SaaS products)
```
/subscriptions
  │
  ├── Create subscription from confirmed quotation
  │     → POST /api/subscriptions/:quotationId
  ├── View: plan, billing cycle, MRR, renewal date
  └── Cancel → PUT /api/subscriptions/:id/cancel
```

---

### Admin Full Lifecycle Summary

```
LOGIN
  ↓
DASHBOARD (KPIs + Alerts)
  ↓
SETUP: Products → Discount Tiers → Upsell Rules → Warehouses → Users
  ↓
QUOTATION CREATED (Draft)
  ↓
SUBMITTED → PENDING_MANAGER
  ↓
APPROVED (or PENDING_FINANCE → APPROVED)
  ↓
SENT TO CUSTOMER → portal URL generated
  ↓
CUSTOMER NEGOTIATES / CONFIRMS
  ↓
FULFILLMENT → warehouse split → stock deducted
  ↓
INVOICE created → PDF → sent → paid
  ↓
SUBSCRIPTION activated (if recurring product)
```

---
---

## CUSTOMER FLOW

> Customers do NOT log into the main app.  
> They access a **magic link URL** sent by email.  
> No username/password needed — the token IS the credential.

---

### Step 1 — Receive Email
```
Customer receives email:
  Subject: "Your Quotation QT-2024-001 from DealFlow360"
  Body: "Click here to view and respond: 
         http://localhost:5173/portal/portal-token-acme-004"

  (OR scan QR code shown in the email / on the portal)
```

---

### Step 2 — Open Customer Portal
```
http://localhost:5173/portal/{token}   ← NO login required

  → React reads token from URL: useParams()
  → API call: GET /api/quotations/portal/{token}
  → Backend validates token → returns quotation data
  → CustomerPortal.jsx renders (944 lines)
```

---

### Step 3 — View Quotation Details
```
Customer sees:
  ├── Company branding header
  ├── Quotation number, issue date, validity date
  ├── ⏰ Expiry countdown ("Expires in 5 days")
  ├── Status badge (SENT_TO_CUSTOMER / UNDER_NEGOTIATION / CONFIRMED)
  │
  ├── Line Items Table
  │     ├── Product name, description, SKU
  │     ├── Quantity × Unit Price
  │     ├── Discount applied
  │     ├── Tax (GST 18%)
  │     └── Line total
  │
  ├── Summary
  │     ├── Subtotal
  │     ├── Tax amount
  │     └── TOTAL (bold, large)
  │
  ├── Payment Terms & Notes
  │
  └── QR Code
        → Scan on mobile to open same portal on phone
        (QRCodeSVG from qrcode.react library)
```

---

### Step 4 — Customer Decides: Accept or Negotiate

#### Path A — Direct Confirm (Accept as-is)
```
Customer clicks "Confirm & Accept"
  → POST /api/negotiations/:quotationId/confirm-portal
  → status: CONFIRMED
  → Socket.io emits 'portal:confirmed' to server
  → Sales team gets notification instantly
  → Portal shows "Deal Confirmed ✅" message
```

#### Path B — Negotiate (Counter-offer)
```
Customer clicks "Request Changes / Negotiate"
  ├── Types a message (e.g., "Can you reduce to ₹4,00,000?")
  ├── Optionally enters a counter price
  └── Clicks "Send"
       → POST /api/negotiations/:quotationId/negotiate
       → { message: "...", proposedPrice: 400000 }
       → status: UNDER_NEGOTIATION
       → Socket.io emits 'negotiation:message' to 'portal_{token}' room
       → Sales team sees message in real-time
```

---

### Step 5 — Live Negotiation Chat
```
CustomerPortal ← Socket.io → Sales Rep's screen

Customer types message  →  socket event: 'negotiation:message'
                                ↓
                        Sales Rep sees it instantly
                                ↓
                        Sales Rep responds (from main app)
                                ↓
                        Customer's portal auto-updates (no page refresh)
```

**Socket room joining:**
```js
// In CustomerPortal.jsx
const socket = io('http://localhost:5000', { withCredentials: true });
socket.emit('join_portal', { token });

socket.on('negotiation:message', (msg) => {
  setMessages(prev => [...prev, msg]);
});
```

---

### Step 6 — After Negotiation Resolved
```
Sales Rep updates quotation (new price/terms) in main app
  → status reverts to SENT_TO_CUSTOMER with updated values
  → Customer's portal refreshes showing new price
  → Customer reviews updated quotation
  → Customer clicks "Confirm & Accept"
  → status: CONFIRMED → deal done ✅
```

---

### Step 7 — Post-Confirmation (Customer side)
```
Portal shows:
  ├── "Your order has been confirmed!"
  ├── Reference number
  ├── "You will receive invoice shortly" 
  └── Download button (if PDF available)
```

---

### Customer Flow Summary

```
📧 EMAIL RECEIVED (magic link URL)
  ↓
🌐 OPEN PORTAL (no login)
  /portal/{token}
  ↓
📋 VIEW QUOTATION (items, prices, validity, QR code)
  ↓
  ├──── ✅ ACCEPT → CONFIRMED → Done
  │
  └──── 💬 NEGOTIATE → type message + counter price
              ↓
        🔄 UNDER NEGOTIATION
              ↓
        Sales team responds + updates quotation
              ↓
        Customer reviews updated price
              ↓
        ✅ CONFIRM → CONFIRMED → Done
```

---

## FULL SYSTEM FLOW — All Roles Together

```
ADMIN sets up:
  Products → Discount Tiers → Upsell Rules → Warehouses → Users

SALES REP creates:
  Quotation (Draft) → adds products → LiveMarginBar shows risk
  → Submits → PENDING_MANAGER

SALES MANAGER approves (Stage 1):
  Reviews discount/risk → Approves or Rejects
  If discount > 10% → PENDING_FINANCE

FINANCE approves (Stage 2):
  Final check → Approves → APPROVED

ADMIN/REP sends to customer:
  Clicks "Send" → portal URL generated → email sent
  Status: SENT_TO_CUSTOMER

CUSTOMER opens magic link:
  Views quotation → Negotiates or Accepts
  Socket.io: real-time chat with sales team

CUSTOMER confirms:
  Status: CONFIRMED
  Socket.io: instant notification to sales team

ADMIN processes fulfillment:
  Checks warehouse stock → split allocation
  Accepts split → stock deducted

FINANCE creates invoice:
  PDF generated (pdfkit) → email sent → customer pays
  Status: PAID

ADMIN activates subscription (if SaaS):
  Subscription created → recurring billing tracked
  MRR shown on dashboard
```

---

## Key Data States (Quotation Status Machine)

```
          ┌─────────┐
          │  DRAFT  │  ← Sales Rep creates
          └────┬────┘
               │ Submit
               ▼
    ┌──────────────────────┐
    │   PENDING_MANAGER    │  ← Manager reviews
    └──────────┬───────────┘
               │ Approve (discount ≤ 10%)    │ Reject
               ▼                             ▼
    ┌──────────────────────┐          ┌──────────┐
    │   PENDING_FINANCE    │          │ REJECTED │
    └──────────┬───────────┘          └──────────┘
               │ Approve              │ Reject
               ▼                     ▼
          ┌──────────┐         ┌──────────┐
          │ APPROVED │         │ REJECTED │
          └────┬─────┘         └──────────┘
               │ Send to Customer
               ▼
    ┌────────────────────┐
    │  SENT_TO_CUSTOMER  │  ← Customer views portal
    └──────────┬─────────┘
               │ Customer negotiates
               ▼
    ┌───────────────────────┐
    │  UNDER_NEGOTIATION    │  ← Real-time chat room
    └──────────┬────────────┘
               │ Customer confirms (or re-send after update)
               ▼
          ┌───────────┐
          │ CONFIRMED │  ← Fulfillment starts
          └───────────┘
               │
               ▼
    Invoice → PAID
    Subscription → ACTIVE (if recurring)

    (Any stage can go to CANCELLED)
```

---

## Role Permission Summary

| Action | ADMIN | MANAGER | FINANCE | SALES REP | CUSTOMER |
|---|:---:|:---:|:---:|:---:|:---:|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage Products | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configure Discount Tiers | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Quotation | ✅ | ✅ | ❌ | ✅ | ❌ |
| Submit Quotation | ✅ | ✅ | ❌ | ✅ | ❌ |
| Approve (Stage 1) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve (Stage 2) | ✅ | ❌ | ✅ | ❌ | ❌ |
| Send to Customer | ✅ | ✅ | ❌ | ✅ | ❌ |
| View Customer Portal | ❌ | ❌ | ❌ | ❌ | ✅ |
| Negotiate in Portal | ❌ | ❌ | ❌ | ❌ | ✅ |
| Confirm Deal | ❌ | ❌ | ❌ | ❌ | ✅ |
| Process Fulfillment | ✅ | ✅ | ✅ | ✅ | ❌ |
| Generate Invoice | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage Subscriptions | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Warehouses | ✅ | ✅ | ✅ | ❌ | ❌ |

---

*DealFlow360 — Application Flow Reference v1.0 | 2026-09-05*
