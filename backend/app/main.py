"""app/main.py — FastAPI application entry point."""
import os
from contextlib import asynccontextmanager

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

# ── Socket.IO ─────────────────────────────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=os.getenv("FRONTEND_URL", "http://localhost:5173"),
)


@sio.event
async def connect(sid, environ):
    print(f"[Socket] Client connected: {sid}")


@sio.event
async def join(sid, data):
    room = data.get("room", "dashboard")
    await sio.enter_room(sid, room)
    print(f"[Socket] {sid} joined room: {room}")


@sio.event
async def disconnect(sid):
    print(f"[Socket] Client disconnected: {sid}")


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("✅ DealFlow360 FastAPI backend starting...")
    yield
    print("👋 DealFlow360 backend shutting down.")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="DealFlow360 API",
    description="CPQ & Deal Management Platform — FastAPI Backend",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Make sio accessible to routers via app state
app.state.sio = sio

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── Routers ───────────────────────────────────────────────────────────────────
from app.routers.auth import router as auth_router          # noqa: E402
from app.routers.products import router as products_router  # noqa: E402
from app.routers.quotations import router as quotations_router  # noqa: E402

app.include_router(auth_router)
app.include_router(products_router)
app.include_router(quotations_router)


@app.get("/api/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "DealFlow360", "version": "2.0.0"}


# ── Mount Socket.IO ───────────────────────────────────────────────────────────
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
