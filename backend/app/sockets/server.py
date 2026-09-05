import socketio
from app.config import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[settings.FRONTEND_URL] if settings.FRONTEND_URL else ["http://localhost:5173"],
)

@sio.event
async def connect(sid, environ):
    print("Connected:", sid)

@sio.event
async def join_dashboard(sid):
    await sio.enter_room(sid, "dashboard")
    await sio.enter_room(sid, "approvers")

@sio.event
async def join_workspace(sid, user_id):
    await sio.enter_room(sid, f"user-{user_id}")

@sio.event
async def join_portal(sid, token):
    await sio.enter_room(sid, f"portal-{token}")

@sio.event
async def compute_risk_live(sid, data):
    # NOTE: needs a DB session — open one directly here since this runs
    # outside the normal FastAPI Depends() request cycle.
    from app.database import AsyncSessionLocal
    from app.utils.blended_risk_engine import compute_blended_risk_score, compute_order_totals
    try:
        async with AsyncSessionLocal() as db:
            totals = compute_order_totals(data["lines"])
            risk = await compute_blended_risk_score(db, data["lines"], data["customerTier"])
            await sio.emit("risk-result", {**risk, "totals": totals}, room=sid)
    except Exception:
        await sio.emit("risk-result", {"error": "Computation failed"}, room=sid)

@sio.event
async def disconnect(sid):
    print("Disconnected:", sid)
