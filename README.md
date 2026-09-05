# DealFlow360 🚀

DealFlow360 is an enterprise-grade full-stack platform for M&A dealflow orchestration, deal pipeline management, real-time collaboration, and investor portal communication.

---

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js & Express.js
- **Database & ORM**: PostgreSQL & Prisma ORM
- **Real-Time Engine**: Socket.io
- **Media & File Processing**: Multer + Sharp
- **Document Generation**: PDFKit
- **Email Dispatch**: Nodemailer
- **Authentication & Security**: JWT with httpOnly refresh cookies, bcryptjs, Helmet, Express-Rate-Limit

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS (with custom brand tokens & dark mode)
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query + Axios
- **Real-Time Client**: Socket.io-client
- **UI & Visualization**: Recharts, Lucide React, React Hot Toast, React Dropzone, React Beautiful DnD

---

## 📁 Project Structure

```text
dealflow360/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Prisma models & Postgres configuration
│   │   └── seed.js             # Initial database seeder
│   ├── src/
│   │   ├── controllers/        # Request handlers (auth, deals, uploads, etc.)
│   │   ├── middleware/         # Auth, file processing, error handlers
│   │   ├── routes/             # API route definitions
│   │   ├── socket/             # Real-time event handlers
│   │   ├── uploads/            # Upload directories (products, logos)
│   │   └── utils/              # JWT, Nodemailer, PDFKit, Prisma clients
│   ├── .env                    # Environment secrets
│   ├── package.json
│   └── server.js               # Main HTTP & Socket.io server entry
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios instance & endpoints
│   │   ├── components/         # UI, layouts, charts, forms
│   │   ├── hooks/              # Custom hooks (auth, socket, deals)
│   │   ├── pages/              # Auth, workspace, portal, dashboard, backend
│   │   ├── store/              # Zustand stores
│   │   ├── utils/              # Formatters & constants
│   │   ├── App.jsx             # Router & app root
│   │   ├── index.css           # Tailwind & typography directives
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── .gitignore
└── README.md
```

---

## ⚡ Getting Started

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL (running locally or remotely)
- Git

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env   # Configure DATABASE_URL, JWT secrets, etc.
npx prisma generate
npx prisma db push     # Sync schema with PostgreSQL (or npx prisma migrate dev)
npm run seed           # Seed initial users and sample deals
npm run dev            # Start dev server on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev            # Start Vite dev server on http://localhost:5173
```

---

## 🛡 Environment Variables (`backend/.env`)

```env
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/dealflow360"
JWT_SECRET="dealflow360_jwt_secret_2024_xyz"
JWT_REFRESH_SECRET="dealflow360_refresh_secret_2024_abc"
PORT=5000
FRONTEND_URL="http://localhost:5173"
EMAIL_USER=""
EMAIL_PASS=""
UPLOAD_DIR="./src/uploads"
```

---

## 👥 Default Roles & Pipeline Stages
- **Roles**: `ADMIN`, `BROKER`, `CLIENT`, `ANALYST`
- **Pipeline Stages**:
  - `LEAD`
  - `QUALIFICATION`
  - `DUE_DILIGENCE`
  - `NEGOTIATION`
  - `CLOSED_WON`
  - `CLOSED_LOST`
