import socketio
from app.config import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
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
    if not token:
        return
    tok_str = str(token).strip()
    clean_token = tok_str.replace("portal-token-", "").replace("portal-", "").strip()
    await sio.enter_room(sid, tok_str)
    await sio.enter_room(sid, f"portal-{tok_str}")
    if clean_token != tok_str:
        await sio.enter_room(sid, clean_token)
        await sio.enter_room(sid, f"portal-{clean_token}")

@sio.event
async def join_quotation(sid, quotation_id):
    if not quotation_id:
        return
    q_str = str(quotation_id).strip()
    await sio.enter_room(sid, q_str)
    await sio.enter_room(sid, f"quotation-{q_str}")

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


async def broadcast_audit_event(quotation, audit_log):
    """
    Broadcasts real-time audit log events with guaranteed UTC ISO timestamps
    to dashboard, approvers, quotation room, and customer portal rooms.
    """
    from datetime import datetime, timezone
    if not audit_log:
        return

    created_at_str = None
    if hasattr(audit_log, "created_at") and audit_log.created_at:
        dt = audit_log.created_at
        if dt.tzinfo is None:
            created_at_str = dt.isoformat() + "Z"
        else:
            created_at_str = dt.isoformat()
    else:
        created_at_str = datetime.now(timezone.utc).isoformat()

    action_val = audit_log.action.value if hasattr(audit_log.action, "value") else str(audit_log.action)
    payload = {
        "id": str(audit_log.id),
        "quotation_id": str(audit_log.quotation_id) if audit_log.quotation_id else None,
        "quotationId": str(audit_log.quotation_id) if audit_log.quotation_id else None,
        "action": action_val,
        "details": audit_log.details,
        "created_at": created_at_str,
        "createdAt": created_at_str,
    }

    qid = str(getattr(quotation, "id", "")) if quotation else str(getattr(audit_log, "quotation_id", ""))
    tok = getattr(quotation, "portal_token", "") if quotation else ""
    cid = str(getattr(quotation, "customer_id", "")) if quotation else ""

    rooms = {"dashboard", "approvers"}
    if qid:
        rooms.add(qid)
        rooms.add(f"quotation-{qid}")
    if tok:
        tok_str = str(tok).strip()
        clean_tok = tok_str.replace("portal-token-", "").replace("portal-", "").strip()
        rooms.add(tok_str)
        rooms.add(f"portal-{tok_str}")
        rooms.add(clean_tok)
        rooms.add(f"portal-{clean_tok}")
    if cid:
        rooms.add(cid)
        rooms.add(f"portal-{cid}")
        rooms.add(f"user-{cid}")

    for r in rooms:
        try:
            await sio.emit("audit-created", payload, room=r)
        except Exception as e:
            print(f"[Socket Error] audit-created to {r}: {e}")


async def broadcast_quotation_update(quotation, extra_data: dict = None):
    """
    Broadcasts real-time quotation state updates to dashboard, approvers,
    quotation room, and customer portal rooms.
    """
    if not quotation:
        return
    qid = str(getattr(quotation, "id", ""))
    status_val = quotation.status.value if hasattr(quotation.status, "value") else str(quotation.status)
    payload = {
        "id": qid,
        "status": status_val,
        "quotationNumber": getattr(quotation, "quotation_number", ""),
        "total": float(quotation.total or 0) if hasattr(quotation, "total") else 0,
        "margin": float(quotation.margin or 0) if hasattr(quotation, "margin") else 0,
        "blendedRiskScore": float(quotation.blended_risk_score or 0) if hasattr(quotation, "blended_risk_score") else 0,
        **(extra_data or {})
    }

    tok = getattr(quotation, "portal_token", "")
    cid = str(getattr(quotation, "customer_id", ""))

    rooms = {"dashboard", "approvers"}
    if qid:
        rooms.add(qid)
        rooms.add(f"quotation-{qid}")
    if tok:
        tok_str = str(tok).strip()
        clean_tok = tok_str.replace("portal-token-", "").replace("portal-", "").strip()
        rooms.add(tok_str)
        rooms.add(f"portal-{tok_str}")
        rooms.add(clean_tok)
        rooms.add(f"portal-{clean_tok}")
    if cid:
        rooms.add(cid)
        rooms.add(f"portal-{cid}")
        rooms.add(f"user-{cid}")

    for r in rooms:
        try:
            await sio.emit("quotation-updated", payload, room=r)
        except Exception as e:
            print(f"[Socket Error] quotation-updated to {r}: {e}")

