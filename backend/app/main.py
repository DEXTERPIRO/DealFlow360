import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import socketio

from app.config import settings
from app.sockets.server import sio
from app.routers import (
    auth, products, quotations, fulfillment,
    subscriptions, invoices, negotiations, dashboard, notifications
)

app = FastAPI(title="DealFlow360 API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
os.makedirs("app/uploads/products", exist_ok=True)
os.makedirs("app/uploads/logos", exist_ok=True)

# Serve uploaded files (equivalent to express.static)
app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")

# Route wiring (equivalent to app.use('/api/...', require('./routes/...')))
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(quotations.router)
app.include_router(fulfillment.router)
app.include_router(subscriptions.router)
app.include_router(invoices.router)
app.include_router(negotiations.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)

@app.get("/health")
@app.get("/api/health")
async def health():
    from datetime import datetime
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

@app.get("/api/config")
async def get_config():
    return {
        "company_name": "DealFlow360",
        "currency": "INR",
        "currency_symbol": "₹",
        "tax_rate": 18.0,
        "environment": "production"
    }

# Global exception handler (equivalent to Express's error middleware)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc) or "Internal server error"})

# Mount Socket.io onto the FastAPI app (ASGI) — this is the ASGI app you actually run
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
