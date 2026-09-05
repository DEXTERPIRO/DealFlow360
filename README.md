# DealFlow360 — Intelligent Sales Operations Platform

## Architecture
- **Backend**: Node.js + Express + Prisma ORM (or FastAPI + SQLAlchemy)
- **Database**: PostgreSQL
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Real-time**: Socket.io (live risk, live approvals, live dashboard)
- **File Storage**: Local (Multer + Sharp for image optimization)
- **PDF Generation**: pdfkit / ReportLab (server-side branded export)

## Demo Credentials
| Role | Email | Password |
|---|---|---|
| Admin | admin@dealflow.com | Admin@123 |
| Sales Rep | priya@dealflow.com | Rep@123 |
| Sales Manager | manager@dealflow.com | Manager@123 |
| Finance | finance@dealflow.com | Finance@123 |
| Customer | buyer@acme.com | Customer@123 |

## Setup
1. `cd backend && npm install`
2. `npx prisma migrate dev --name init`
3. `npm run seed`
4. `npm run dev`
5. `cd ../frontend && npm install && npm run dev`

### Alternative Python / FastAPI Backend Setup
1. `cd backend`
2. `python -m venv venv && source venv/bin/activate` (or `.\venv\Scripts\activate` on Windows)
3. `pip install -r requirements.txt`
4. `uvicorn app.main:socket_app --reload --port 5000`
5. `cd ../frontend && npm install && npm run dev`

## Key Features Beyond PDF
- Product images with upload and optimization
- Live margin + risk meter (real-time as you type)
- Bulk approval from manager queue
- Quotation PDF export with branding
- Customer portal with countdown timer
- QR code for portal sharing
- Deal expiry auto-tracking
- Revenue forecast charts

## Demo Flow (5 minutes)
1. Login as Admin → configure discount tiers
2. Login as Sales Rep → create quotation with products
3. Apply high discount → watch risk score turn red
4. Submit → automatically routes to Manager
5. Login as Manager → approve from queue (bulk approve)
6. Back as Rep → send to customer portal
7. Open portal link → customer negotiates discount
8. Portal re-enters approval if threshold exceeded
9. Confirm → create invoice → mark paid
10. Dashboard shows all metrics updated live
