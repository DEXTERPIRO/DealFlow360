# DealFlow360 — Frontend Explained (Judge Reference)

> **Stack**: React 18 · Vite 6 · Tailwind CSS 3 · Zustand · Socket.io-client · Axios · Recharts  
> **URL**: http://localhost:5173  
> **Source root**: `frontend/src/`  
> **Total pages**: 19 · **Total components**: 13 · **Total lines**: ~12,000

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Entry Points — main.jsx & App.jsx](#2-entry-points)
3. [Auth System — Login, Signup, Guard](#3-auth-system)
4. [State Management — Zustand Stores](#4-state-management)
5. [API Layer — Axios Client & Interceptors](#5-api-layer)
6. [Real-time Layer — Socket.io Hook](#6-real-time-layer)
7. [Layout System — AppLayout, Sidebar, Navbar](#7-layout-system)
8. [Dashboard Page](#8-dashboard-page)
9. [Quotation Builder (CPQ)](#9-quotation-builder-cpq)
10. [Quotations List & Pipeline Kanban](#10-quotations-list--pipeline-kanban)
11. [Approval Queue](#11-approval-queue)
12. [Fulfillment Page](#12-fulfillment-page)
13. [Subscriptions & Invoices](#13-subscriptions--invoices)
14. [Customer Portal](#14-customer-portal)
15. [Backend Config Pages](#15-backend-config-pages)
16. [UI Component Library](#16-ui-component-library)
17. [LiveMarginBar — The Signature Component](#17-livemarginbar--the-signature-component)
18. [Utility Functions](#18-utility-functions)
19. [Routing & Role-based Access Control](#19-routing--role-based-access-control)
20. [Common Interview Q&A](#20-common-interview-qa)

---

## 1. Architecture Overview

```
frontend/
├── src/
│   ├── main.jsx              ← React DOM root mount
│   ├── App.jsx               ← BrowserRouter + all Routes + Guard
│   ├── index.css             ← Tailwind directives + custom CSS tokens
│   ├── api/
│   │   ├── client.js         ← Axios instance + request/response interceptors
│   │   └── index.js          ← All API function exports
│   ├── store/
│   │   ├── authStore.js      ← Zustand: user, accessToken
│   │   └── dealStore.js      ← Zustand: pipeline deals state
│   ├── hooks/
│   │   └── useSocket.js      ← Socket.io-client hook
│   ├── components/
│   │   ├── AppInitializer.jsx ← Token refresh on page load
│   │   ├── layout/           ← AppLayout, Sidebar, Navbar
│   │   ├── charts/           ← PipelineChart, ValuationChart
│   │   ├── forms/            ← FileDropzone, NewDealModal
│   │   └── ui/               ← Reusable UI primitives
│   ├── pages/
│   │   ├── auth/             ← Login, Signup
│   │   ├── dashboard/        ← Dashboard
│   │   ├── workspace/        ← Quotations, Builder, Kanban, Approvals, Fulfillment, Subscriptions, Invoices
│   │   ├── backend/          ← Products, PriceLists, DiscountTiers, Warehouses, Plans, UpsellRules, Users
│   │   └── portal/           ← CustomerPortal, PortalLogin
│   └── utils/
│       └── formatters.js     ← formatCurrency, formatDate, STAGES, PRIORITY_COLORS
```

### Data Flow Diagram

```
User Action
    │
    ▼
React Component  ──useState/useMemo──►  Local UI State
    │
    ├─── Zustand store (authStore / dealStore) ←──── persisted in localStorage
    │
    ├─── Axios API call  ──► Express backend (port 5000) ──► PostgreSQL
    │         └── interceptor auto-attaches Bearer token
    │         └── interceptor auto-refreshes on 401
    │
    └─── Socket.io  ──► server event ──► broadcast to all clients in room
              └── real-time: risk scores, approvals, portal messages
```

---

## 2. Entry Points

### `main.jsx`

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Standard React 18 `createRoot` mount. StrictMode double-renders in dev to catch side effects.

---

### `App.jsx` — Master Router (126 lines)

```jsx
function Guard({ children, roles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;
  return children;
}
```

**Guard** is a simple HOC (Higher Order Component):
- If no user in Zustand → redirect to `/login`
- If user's role is not in the allowed `roles` array → redirect to `/dashboard`
- Otherwise render children

Every protected route is wrapped: `<Guard roles={['ADMIN']}><UsersPage /></Guard>`

**Customer Portal** is intentionally **outside** the Guard — it uses a magic token URL, no login required.

---

### `AppInitializer.jsx` — Token Hydration (46 lines)

```jsx
useEffect(() => {
  const init = async () => {
    if (user) {
      const res = await fetch('http://localhost:5000/api/auth/refresh', {
        method: 'POST', credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.accessToken);   // inject into Axios
        setAuth(user, data.accessToken);
      } else { logout(); }
    }
    setReady(true);
  };
  init();
}, []);
```

**Why this exists**: JWT access tokens expire in 15 minutes. On page refresh, Zustand re-hydrates `user` from localStorage (via `persist` middleware), but the old access token is stale. `AppInitializer` silently calls `/auth/refresh` using the httpOnly refresh cookie to get a fresh access token — transparent to the user.

If refresh fails → force logout. Shows animated loading screen during this check.

---

## 3. Auth System

### `Login.jsx` (307 lines)

**Key features:**
- Demo account cards for all 5 roles — clicking pre-fills the form
- Client-side validation (`emailRegex`, password min 8 chars)
- On success: stores `user` + `accessToken` in Zustand, calls `setToken()` to inject into Axios

```jsx
const demoAccounts = [
  { role: 'ADMIN',        email: 'admin@dealflow.com',   password: 'Admin@123' },
  { role: 'SALES_REP',   email: 'priya@dealflow.com',   password: 'Rep@123' },
  { role: 'SALES_MANAGER', email: 'manager@dealflow.com', password: 'Manager@123' },
  { role: 'FINANCE',     email: 'finance@dealflow.com', password: 'Finance@123' },
  { role: 'CUSTOMER',    email: 'buyer@acme.com',        password: 'Customer@123' },
];
```

```jsx
const res = await authAPI.login({ email, password });
setAuth(res.user, res.accessToken);  // into Zustand
setToken(res.accessToken);           // into Axios module-level variable
navigate('/dashboard');
```

**Magic Link flow**: separate input — sends email with a token URL `/portal/:token`. Used by CustomerPortal.

---

### `Signup.jsx` (257 lines)

- Role selection: SALES_REP, SALES_MANAGER, FINANCE, ADMIN, CUSTOMER
- Full client-side validation: name, email, password strength, confirm password
- Calls `POST /api/auth/signup` → auto-login on success

---

## 4. State Management

### `authStore.js` (14 lines) — Zustand

```js
export const useAuthStore = create(persist(
  (set) => ({
    user: null,
    accessToken: null,
    setAuth: (user, accessToken) => set({ user, accessToken }),
    updateToken: (accessToken) => set({ accessToken }),
    logout: () => set({ user: null, accessToken: null }),
  }),
  { name: 'dealflow-auth' }  // persists to localStorage key 'dealflow-auth'
));
```

**Why Zustand over Redux?**  
Zustand has zero boilerplate — no actions, reducers, or dispatchers. The `persist` middleware automatically serializes to localStorage so state survives page refreshes. `useAuthStore.getState()` (used in Axios interceptor) allows reading state outside React components.

**Shape of `user` object:**
```json
{
  "id": "uuid",
  "name": "Admin User",
  "email": "admin@dealflow.com",
  "role": "ADMIN",
  "tier": "GOLD",
  "isActive": true
}
```

---

### `dealStore.js` — Zustand (Pipeline State)

```js
export const useDealStore = create((set) => ({
  deals: [],
  isNewDealModalOpen: false,
  addOrUpdateDeal: (deal) => set((state) => ({ ... })),
  removeDeal: (id) => set((state) => ({ deals: state.deals.filter(d => d.id !== id) })),
  setIsNewDealModalOpen: (v) => set({ isNewDealModalOpen: v }),
}));
```

Used by `PipelineKanban`, `useSocket` hook, `Sidebar` (opens modal).

---

## 5. API Layer

### `client.js` — Axios (43 lines)

```js
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,   // send cookies (for refresh token)
});

let _token = null;
export const setToken = (t) => { _token = t; };

// REQUEST interceptor: attach Bearer token to every call
api.interceptors.request.use((config) => {
  const token = _token || useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// RESPONSE interceptor: auto-refresh on 401
api.interceptors.response.use(
  (res) => res.data,    // unwrap .data from every response automatically
  async (error) => {
    if (error.response?.status === 401 && !original._retry) {
      // silently get new access token using refresh cookie
      const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      _token = res.data.accessToken;
      useAuthStore.getState().updateToken(_token);
      return api(original);  // retry original request
    }
    return Promise.reject(error.response?.data || error);
  }
);
```

**Key design decisions:**
- `res.data` unwrap means every API call returns the data directly, no `.data.data` nesting
- `_token` is a module-level variable (not React state) so it's accessible from interceptors synchronously
- `_retry` flag prevents infinite loop on repeated 401s

### `api/index.js` — All Endpoints

```js
export const authAPI = {
  login: (body) => api.post('/auth/login', body),
  signup: (body) => api.post('/auth/signup', body),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  getUsers: () => api.get('/auth/users'),
  ...
};

export const quotationsAPI = {
  list: (params) => api.get('/quotations', { params }),
  get: (id) => api.get(`/quotations/${id}`),
  create: (body) => api.post('/quotations', body),
  update: (id, body) => api.put(`/quotations/${id}`, body),
  submit: (id) => api.put(`/quotations/${id}/submit`),
  decision: (id, body) => api.put(`/quotations/${id}/decision`, body),
  computeRisk: (body) => api.post('/quotations/compute-risk', body),
  sendToCustomer: (id) => api.put(`/quotations/${id}/send`),
  getPdf: (id) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }),
  ...
};
// + productsAPI, fulfillmentAPI, subscriptionsAPI, invoicesAPI,
//   negotiationsAPI, dashboardAPI, notificationsAPI, usersAPI
```

---

## 6. Real-time Layer

### `useSocket.js` (70 lines)

```js
export const useSocket = () => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io('http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('deal:created', (deal) => {
      addOrUpdateDeal(deal);
      toast.success(`New Deal: ${deal.title}`, { icon: '🚀' });
    });

    socket.on('deal:updated', (deal) => addOrUpdateDeal(deal));
    socket.on('deal:deleted', ({ id }) => removeDeal(id));

    return () => socket.disconnect();  // cleanup on unmount
  }, []);
};
```

**Socket rooms used across the app:**

| Room | Joined by | Events |
|---|---|---|
| `dashboard` | Dashboard.jsx | `dashboard:update` |
| `approvers` | ApprovalQueue.jsx | `approval:new` |
| `portal_{token}` | CustomerPortal.jsx | `negotiation:message`, `portal:confirmed` |
| `quotation_{id}` | QuotationBuilder.jsx | `risk-result` (live risk scoring) |
| `workspace_{id}` | various | `deal:activity` |

**Live Risk Scoring** (in QuotationBuilder):

```js
socket.emit('compute-risk-live', { lines, customerId, ... });
socket.on('risk-result', (result) => {
  setRiskResult(result);  // { score, level, breakdown }
});
```

The server runs `blendedRiskEngine.js` and emits back the score within milliseconds — the UI updates the risk LED and approval path in real time as the user types.

---

## 7. Layout System

### `AppLayout.jsx`

```jsx
<div className="flex h-screen overflow-hidden bg-slate-950">
  <AppSidebar />           {/* left nav: 256px wide */}
  <div className="flex-1 flex flex-col overflow-hidden">
    <Navbar />              {/* top bar: 64px high */}
    <main className="flex-1 overflow-y-auto p-6">
      <Outlet />            {/* react-router child page renders here */}
    </main>
  </div>
</div>
```

`<Outlet />` is from React Router — the parent route renders `AppLayout` and child routes render inside the `Outlet`. This means the Sidebar and Navbar are never re-mounted on navigation — only the `main` content swaps.

### `Sidebar.jsx` (90 lines)

- Brand logo with gradient
- NavLink-based navigation with `isActive` styling
- Active link: `bg-brand-600/10 text-brand-400 border border-brand-500/20`
- "New Deal Mandate" button triggers `dealStore.setIsNewDealModalOpen(true)`

### `Navbar.jsx`

- Shows logged-in user name + role badge
- `NotificationDropdown` component — bell icon with unread count badge
- Logout button → calls `authAPI.logout()` + `authStore.logout()` + `navigate('/login')`

---

## 8. Dashboard Page

**File**: `pages/dashboard/Dashboard.jsx` — **621 lines**  
**Route**: `/dashboard` — accessible to all authenticated roles

### State Structure

```js
const [data, setData] = useState({
  kpis: {
    totalQuotations: 0,    confirmedDeals: 0,
    confirmedValue: 0,     pendingApprovals: 0,
    totalRevenue: 0,       draftQuotations: 0,
    rejectedQuotations: 0, activeSubscriptions: 0,
    avgDealSize: 0,
  },
  stalledDeals: [],
  discountAnomalies: [],
  expiringQuotations: [],
  pipelineChart: [],
  revenueTrend: [],
  topReps: [],
  reps: [],
});
```

### Filters

```js
const [period, setPeriod] = useState('month');   // today | week | month | custom
const [selectedRep, setSelectedRep] = useState('');
```

When filter changes → `fetchMetrics()` re-runs → calls `GET /api/dashboard/metrics?period=month&rep_id=...`

### Charts Used (Recharts)

```jsx
// Revenue trend — AreaChart
<AreaChart data={data.revenueTrend}>
  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#gradient)" />
</AreaChart>

// Pipeline by status — BarChart
<BarChart data={data.pipelineChart}>
  <Bar dataKey="count" fill="#8b5cf6" />
</BarChart>
```

### AI-style Anomaly Cards

Dashboard shows **Discount Anomalies** — quotations where discount > threshold:

```jsx
{data.discountAnomalies.map(q => (
  <div key={q.id} className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3">
    <div>{q.quotationNumber} — {q.customerName}</div>
    <div className="text-amber-400">Discount: {q.maxDiscount}% (avg)</div>
  </div>
))}
```

### Socket.io in Dashboard

```js
useEffect(() => {
  const socket = io('http://localhost:5000', { withCredentials: true });
  socket.emit('join_dashboard');
  socket.on('dashboard:update', () => fetchMetrics());  // auto-refresh on any deal change
  return () => socket.disconnect();
}, []);
```

---

## 9. Quotation Builder (CPQ)

**File**: `pages/workspace/QuotationBuilder.jsx` — **760 lines**  
**Route**: `/quotations/new` (create) or `/quotations/:id` (edit/view)

This is the most complex page. It is the **Configure, Price, Quote** engine.

### Data Model (line items)

```js
const defaultLine = (product = null) => ({
  _id: genId(),               // temporary local ID ('tmp-abc123')
  product_id: product?.id || '',
  line_type: 'ONE_TIME',      // ONE_TIME | RECURRING | SERVICE
  quantity: 1,
  unit_price: product?.base_price || 0,
  cost_price: product?.cost_price || 0,
  discount: 0,                // percentage
  tax: product?.tax || 18,    // percentage (GST)
  notes: '',
});
```

### ProductPicker Sub-component

```jsx
function ProductPicker({ products, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = products.filter(p =>
    `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase())
  );
  // Renders modal overlay with search input + product cards
}
```

Opens as a modal overlay, auto-focuses the search input. Selecting a product calls `defaultLine(product)` and appends to lines array.

### Live Price Calculation

Every time a line changes, `useMemo` recomputes totals:

```js
const totals = useMemo(() => {
  return lines.reduce((acc, line) => {
    const effectivePrice = line.unit_price * (1 - line.discount / 100);
    const lineTotal = effectivePrice * line.quantity * (1 + line.tax / 100);
    acc.subtotal += effectivePrice * line.quantity;
    acc.taxAmount += effectivePrice * line.quantity * (line.tax / 100);
    acc.total += lineTotal;
    return acc;
  }, { subtotal: 0, taxAmount: 0, total: 0 });
}, [lines]);
```

### Upsell Suggestions

```js
const fetchUpsellSuggestions = useCallback(async () => {
  const productIds = lines.map(l => l.product_id).filter(Boolean);
  const res = await productsAPI.getUpsellSuggestions({ product_ids: productIds });
  setUpsellSuggestions(res.suggestions || []);
}, [lines]);
```

Called whenever lines change. Backend matches product IDs against `UpsellRule` table.

### Submit → Approval Flow

```
DRAFT  →  [Submit]  →  PENDING_MANAGER  →  [Approve/Reject]
                                        →  PENDING_FINANCE  →  [Approve/Reject]
                                                           →  APPROVED
                                                              [Send to Customer]  →  SENT_TO_CUSTOMER
```

### Quotation Status Machine

```
DRAFT → PENDING_MANAGER → PENDING_FINANCE → APPROVED → SENT_TO_CUSTOMER
     ↘  REJECTED (at any approval stage)
                                         → UNDER_NEGOTIATION (customer negotiates)
                                         → CONFIRMED (customer confirms)
                                         → CANCELLED
```

---

## 10. Quotations List & Pipeline Kanban

### `QuotationsList.jsx` (773 lines)

- Tab-based filter: All | Draft | Pending | Approved | Rejected | Sent | Confirmed
- Grid/List view toggle
- Search by quotation number or customer name
- Each card shows: status badge, customer, value, risk score, expiry
- Clicking a card → navigate to `/quotations/:id`

### `PipelineKanban.jsx` (488 lines)

- **react-beautiful-dnd** library for drag-and-drop columns
- Columns based on `STAGES` from `formatters.js`: LEAD → QUALIFICATION → DUE_DILIGENCE → NEGOTIATION → CLOSED_WON → CLOSED_LOST
- Dragging a card between columns updates the deal stage via API

```js
const onDragEnd = async (result) => {
  const { destination, draggableId } = result;
  if (!destination) return;
  await quotationsAPI.updateStage(draggableId, destination.droppableId);
};
```

---

## 11. Approval Queue

**File**: `pages/workspace/ApprovalQueue.jsx` — **630 lines**  
**Route**: `/approvals` — restricted to SALES_MANAGER, FINANCE, ADMIN

### Features

- Lists all quotations with `PENDING_MANAGER` or `PENDING_FINANCE` status
- **Batch Approve/Reject** — checkboxes + single action for multiple items

```js
const handleBatchDecision = async (action) => {
  await quotationsAPI.batchDecision({
    ids: selectedIds,      // array of quotation IDs
    action,                // 'approve' or 'reject'
    comment,
  });
  fetchQueue();
};
```

- Individual approve/reject with comment modal
- Real-time update: `socket.emit('join:approvals')` → receives `approval:new` events from backend

---

## 12. Fulfillment Page

**File**: `pages/workspace/Fulfillment.jsx` — **1,227 lines** (largest page)  
**Route**: `/fulfillment`

### Warehouse Split Logic

When a quotation is approved, fulfillment checks warehouse stock per product. If one warehouse doesn't have enough stock, it suggests a **split shipment**:

```js
const [splitPlan, setSplitPlan] = useState([]);

// Backend returns:
// [{ warehouseId, warehouseName, items: [{ productId, qty }] }]

const loadSplitPlan = async (quotationId) => {
  const plan = await fulfillmentAPI.getSplitPlan(quotationId);
  setSplitPlan(plan.splits);
};
```

- Shows a visual split allocation table per warehouse
- "Accept Split" button confirms the allocation plan

### Warehouse Stock Grid

```jsx
{warehouses.map(w => (
  <div key={w.id} className="bg-slate-900 rounded-xl p-4">
    <h3>{w.name} — {w.location}</h3>
    {w.stock.map(s => (
      <div key={s.productId}>
        {s.product.name}: {s.quantity} units
        <span className={s.quantity < 10 ? 'text-red-400' : 'text-green-400'}>
          {s.quantity < 10 ? '⚠ Low Stock' : '✓ In Stock'}
        </span>
      </div>
    ))}
  </div>
))}
```

---

## 13. Subscriptions & Invoices

### `Subscriptions.jsx` (981 lines)

- Lists all active subscriptions (linked to confirmed quotations)
- Shows: plan name, customer, billing cycle, next renewal date, MRR
- Cancel subscription → calls `PUT /api/subscriptions/:id/cancel`
- Subscription Plans management (inline tab): create/edit recurring billing plans

### `Invoices.jsx` (924 lines)

- Invoice CRUD — list, create, mark as paid
- **PDF Download**: calls `GET /api/invoices/:id/pdf` with `responseType: 'blob'`

```js
const downloadPDF = async (id) => {
  const blob = await invoicesAPI.getPdf(id);  // returns Blob
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
```

---

## 14. Customer Portal

**File**: `pages/portal/CustomerPortal.jsx` — **944 lines**  
**Route**: `/portal/:token` — **NO auth guard** — public URL

This is the external-facing B2B negotiation interface for customers.

### Token-based Access

```js
const { token } = useParams();

useEffect(() => {
  const loadQuotation = async () => {
    const res = await quotationsAPI.getByPortalToken(token);
    // GET /api/quotations/portal/:token
    setQuotation(res.quotation);
  };
  loadQuotation();
}, [token]);
```

The `token` is a UUID stored on the `Quotation` model. When sales rep clicks "Send to Customer", the backend generates/sets this token and emails the URL.

### QR Code

```jsx
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG
  value={`http://localhost:5173/portal/${token}`}
  size={96}
  bgColor="transparent"
  fgColor="#3b82f6"
/>
```

Customer can scan QR on mobile to open portal on their phone.

### Live Negotiation Room

```js
const socket = io('http://localhost:5000', { withCredentials: true });
socket.emit('join_portal', { token });

// Customer sends counteroffer message
socket.on('negotiation:message', (msg) => {
  setMessages(prev => [...prev, msg]);
});

const sendMessage = async () => {
  await negotiationsAPI.negotiate(quotation.id, {
    message: messageText,
    proposedPrice: counterPrice,
  });
};
```

Sales team sees the message in their `quotation_{id}` room in real-time.

### Confirm Deal

```js
const confirmDeal = async () => {
  await negotiationsAPI.confirmPortal(negotiation.id);
  // Quotation status → CONFIRMED
  toast.success('Deal Confirmed! 🎉');
};
```

### Time-to-Expiry Countdown

```jsx
const getRelativeTime = (dateStr) => {
  const diffSec = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diffSec < 60) return 'Just now';
  // ... minutes, hours, days
};
```

---

## 15. Backend Config Pages

These are admin-only pages for configuring the sales engine. All follow the same pattern:

```
Fetch data from API → render table/cards → CRUD modals → re-fetch
```

### `Products.jsx` (745 lines)

- Product catalog with image upload via FastAPI / Multer-compatible endpoint
- Image preview using `URL.createObjectURL(file)` before upload
- Category filter, search, sort
- Product variant management (size, color, etc.)
- Stock tracking per warehouse

### `PriceLists.jsx` (249 lines)

- Customer-tier based pricing (BRONZE, SILVER, GOLD tiers get different prices)
- Override base price per product per customer segment

### `DiscountTiers.jsx` (512 lines)

- Configures max discount per tier (BRONZE: 5%, SILVER: 10%, GOLD: 20%)
- Used by QuotationBuilder to enforce discount limits
- Sliders + input fields with real-time validation

### `Warehouses.jsx` (577 lines)

- Visual stock grid: rows = products, columns = warehouses
- Inline stock adjustment with optimistic UI update
- Low stock alert (< 10 units turns red)

### `UpsellRules.jsx` (504 lines)

- If-Then rule builder: IF product X is in cart → SUGGEST product Y
- Trigger types: `QUANTITY_THRESHOLD`, `PRODUCT_COMBO`, `CUSTOMER_TIER`
- Rules feed the `getUpsellSuggestions` endpoint

### `Users.jsx` (753 lines)

- Full user management: list, create, deactivate, reset password
- Role badge colors per role type
- Search/filter by role or status

---

## 16. UI Component Library

All in `components/ui/`, exported via `components/ui/index.js`.

### `StatusBadge.jsx`

```jsx
const CONFIG = {
  DRAFT:             { color: '#64748b', bg: 'rgba(100,116,139,0.15)', label: 'Draft' },
  PENDING_MANAGER:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Pending Manager' },
  PENDING_FINANCE:   { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'Pending Finance' },
  APPROVED:          { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'Approved' },
  REJECTED:          { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Rejected' },
  SENT_TO_CUSTOMER:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'Sent to Customer' },
  CONFIRMED:         { color: '#10b981', bg: 'rgba(16,185,129,0.2)', label: 'Confirmed' },
  CANCELLED:         { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'Cancelled' },
};

export default function StatusBadge({ status, size = 'sm' }) {
  const cfg = CONFIG[status] || CONFIG.DRAFT;
  return (
    <span style={{
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.color}40`,
      borderRadius: '9999px',
      padding: size === 'sm' ? '2px 10px' : '4px 14px',
      fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  );
}
```

### `KPICard.jsx`

```jsx
<KPICard
  title="Confirmed Deals"
  value={data.kpis.confirmedDeals}
  icon={CheckCircle}
  trend="+12% this month"
  color="emerald"
/>
```

### `RiskScore.jsx`

Circular progress ring showing risk 0–15 with color gradient: green → yellow → red.

### `Modal.jsx`

Generic modal with backdrop, ESC key handler, focus trap.

### `NotificationDropdown.jsx`

Bell icon with unread badge. Dropdown shows notification list. Mark-as-read on click.

---

## 17. LiveMarginBar — The Signature Component

**File**: `components/ui/LiveMarginBar.jsx` — **304 lines**

This is the most unique and impressive component. It's a **fixed bottom sticky bar** in QuotationBuilder that updates in real-time as the user adds/edits line items.

### What it shows

```
₹4,85,000     |  Margin: 34.2% [████████░░] 0% 15% 30% 50%+  |  🟢 5.2/15  |  ✅ Auto-Approved  |  3 items
  LIVE TOTAL        GROSS MARGIN                                   RISK SCORE    APPROVAL PATH     LINE ITEMS
```

### How it works

```js
const metrics = useMemo(() => {
  for (const line of lines) {
    const effectivePrice = unitPrice * (1 - discount / 100);
    const lineRevenue = effectivePrice * qty;
    const lineCost = costPrice * qty;
    const lineTotal = lineRevenue * (1 + tax / 100);

    // Risk: discount-weighted per line
    const lineRisk = Math.min((discount / 20) * 10 + (discount > 15 ? 5 : 0), 15);

    totalRevenue += lineRevenue;
    totalCost += lineCost;
    weightedRisk += lineRisk * lineRevenue;  // weighted by revenue
    totalWeight += lineRevenue;
  }

  const margin = (totalRevenue - totalCost) / totalRevenue * 100;
  const riskScore = weightedRisk / totalWeight;   // blended across lines
  return { total, margin, riskScore, discountToNextTier };
}, [lines]);
```

### Approval Path Hint

```js
if (avgDiscount < 5)       → '✅ Auto-Approved'
if (avgDiscount 5–10%)     → '⚠️ Needs Manager Review'
if (avgDiscount > 10%)     → '🔴 Needs Manager + Finance'
```

Also shows: *"Add 2.3% more avg discount → triggers Finance Approval"*

### Risk LED

```jsx
<div style={{
  background: riskColor,
  boxShadow: `0 0 16px ${riskColor}, 0 0 4px ${riskColor}`,  // glowing LED effect
  animation: riskScore > 10 ? 'ledpulse 1s infinite' : 'none',  // blinks red when critical
}} />
```

### Responsive to Sidebar Width

```js
const sidebarWidth = sidebarCollapsed ? 80 : 256;
// style: left: sidebarWidth  ← CSS transition 300ms to animate sidebar toggle
```

---

## 18. Utility Functions

### `formatters.js` (48 lines)

```js
export const formatCurrency = (val = 0) => {
  const n = Number(val || 0);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

export const STAGES = [
  { id: 'LEAD',           label: 'Lead Inflow',   color: 'border-slate-500' },
  { id: 'QUALIFICATION',  label: 'Qualification', color: 'border-blue-500' },
  { id: 'DUE_DILIGENCE',  label: 'Due Diligence', color: 'border-amber-500' },
  { id: 'NEGOTIATION',    label: 'Negotiation',   color: 'border-purple-500' },
  { id: 'CLOSED_WON',     label: 'Closed Won',    color: 'border-emerald-500' },
  { id: 'CLOSED_LOST',    label: 'Closed Lost',   color: 'border-rose-500' },
];
```

**INR formatting** (used in QuotationBuilder and CustomerPortal):
```js
const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n ?? 0);
// Output: ₹4,85,000
```

---

## 19. Routing & Role-Based Access Control

### Route Table

| URL | Component | Auth Required | Roles |
|---|---|---|---|
| `/login` | Login | No | — |
| `/signup` | Signup | No | — |
| `/portal/:token` | CustomerPortal | No | magic token |
| `/portal/login` | PortalLogin | No | — |
| `/dashboard` | Dashboard | Yes | All |
| `/products` | ProductsPage | Yes | ADMIN, SALES_MANAGER |
| `/price-lists` | PriceListsPage | Yes | ADMIN, SALES_MANAGER |
| `/discount-tiers` | DiscountTiersPage | Yes | ADMIN, SALES_MANAGER |
| `/warehouses` | WarehousesPage | Yes | ADMIN, SALES_MANAGER, FINANCE |
| `/subscription-plans` | SubscriptionPlansPage | Yes | ADMIN, SALES_MANAGER |
| `/upsell-rules` | UpsellRulesPage | Yes | ADMIN, SALES_MANAGER |
| `/users` | UsersPage | Yes | ADMIN |
| `/quotations` | QuotationsList | Yes | All |
| `/quotations/new` | QuotationBuilder | Yes | SALES_REP, SALES_MANAGER, ADMIN |
| `/quotations/:id` | QuotationBuilder | Yes | All |
| `/pipeline` | PipelineKanban | Yes | All |
| `/approvals` | ApprovalQueue | Yes | SALES_MANAGER, FINANCE, ADMIN |
| `/fulfillment` | FulfillmentPage | Yes | All |
| `/subscriptions` | SubscriptionsPage | Yes | All |
| `/invoices` | InvoicesPage | Yes | All |
| `*` | redirect → /dashboard | — | — |

### Guard HOC (in App.jsx)

```jsx
function Guard({ children, roles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;    // not logged in
  if (roles && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;          // wrong role
  return children;                                        // allowed
}
```

`replace` means the redirect doesn't add to browser history — user can't click Back to the protected page.

---

## 20. Common Interview Q&A

**Q: Why React 18?**  
A: Concurrent features, automatic batching of state updates, and `Suspense` support. We use `createRoot` (not `render`).

**Q: Why Zustand over Redux / Context?**  
A: Zero boilerplate, tiny bundle (~1KB), works outside React components (critical for Axios interceptors via `useAuthStore.getState()`), and `persist` middleware gives free localStorage sync.

**Q: How does the access token stay fresh?**  
A: Two-layer strategy. `AppInitializer` refreshes on page load. Axios response interceptor auto-retries on 401 with a silent refresh call using the httpOnly cookie. The `_retry` flag prevents loops.

**Q: Why not store token in localStorage?**  
A: The *access token* is in Zustand (memory + localStorage for hydration). The *refresh token* is in an httpOnly cookie — inaccessible to JavaScript, safe from XSS.

**Q: How does LiveMarginBar work without a re-render on every keystroke?**  
A: It uses `useMemo` — React only recomputes when the `lines` array changes. The bar itself is a pure functional component with no internal state — it's driven entirely by the parent's `lines` prop.

**Q: How is Socket.io connected per page?**  
A: Each page that needs real-time creates its own `io()` connection in a `useEffect` with a cleanup `socket.disconnect()` on unmount. The server manages rooms — clients join specific rooms like `portal_{token}` so messages are scoped.

**Q: How does the Customer Portal work without login?**  
A: The URL itself is the credential — `/portal/:token` where token is a UUID. The backend validates the token and returns the quotation. No JWT needed for portal access.

**Q: What happens when a quotation PDF is downloaded?**  
A: Axios calls `GET /api/quotations/:id/pdf` with `{ responseType: 'blob' }`. The server streams a `pdfkit` generated PDF. Frontend creates a blob URL, clicks a virtual `<a>` tag programmatically, then revokes the URL.

**Q: How does drag-and-drop in PipelineKanban work?**  
A: Uses `react-beautiful-dnd`. `onDragEnd` receives source column and destination column. It calls `quotationsAPI.updateStage()` to persist, and optimistically updates local state immediately for snappy UX.

**Q: What is the blended risk score formula?**  
A: `riskScore = Σ(lineRisk × lineRevenue) / Σ(lineRevenue)` — revenue-weighted average of per-line risk. Per-line risk = `min((discount/20 × 10) + (discount > 15 ? 5 : 0), 15)`. Score range 0–15.

**Q: How are upsell suggestions generated?**  
A: Frontend sends current product IDs to `POST /api/products/upsell-suggestions`. Backend queries `UpsellRule` table where `triggerProductId` matches any cart product. Returns `targetProduct` records with `message` text.

---

## Quick Cheatsheet for Demo

```
Login page:       http://localhost:5173/login
Dashboard:        http://localhost:5173/dashboard
New Quotation:    http://localhost:5173/quotations/new
Approval Queue:   http://localhost:5173/approvals
Customer Portal:  http://localhost:5173/portal/portal-token-acme-004
Products Admin:   http://localhost:5173/products
Kanban Pipeline:  http://localhost:5173/pipeline
Fulfillment:      http://localhost:5173/fulfillment
```

**Demo accounts** (click cards on login page):

| Role | Email | Password | Sees |
|---|---|---|---|
| Admin | admin@dealflow.com | Admin@123 | Everything |
| Sales Rep | priya@dealflow.com | Rep@123 | Create quotations |
| Manager | manager@dealflow.com | Manager@123 | Approve stage 1 |
| Finance | finance@dealflow.com | Finance@123 | Approve stage 2 |
| Customer | buyer@acme.com | Customer@123 | Customer portal |

---

*Generated: 2026-09-05 | DealFlow360 Frontend Reference v1.0*
