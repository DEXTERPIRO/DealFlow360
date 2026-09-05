"""app/routers/negotiations.py — Quotation customer discount negotiations."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token
from app.models.models import Negotiation, Quotation, QuotationStatus, AuditLog, AuditAction
from app.sockets.server import sio

router = APIRouter(prefix="/api/negotiations", tags=["negotiations"])


class NegotiationCreate(BaseModel):
    quotationId: Optional[str] = None
    message: str
    counterDiscount: Optional[float] = None
    lineId: Optional[str] = None
    requestedBy: Optional[str] = "CUSTOMER"


class NegotiationDecision(BaseModel):
    status: str  # ACCEPTED, REJECTED
    notes: Optional[str] = None


@router.get("/{quotation_id}")
async def get_negotiations(
    quotation_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List negotiations for a quotation (public/portal accessible)."""
    stmt = (
        select(Negotiation)
        .where(Negotiation.quotation_id == quotation_id)
        .order_by(Negotiation.created_at.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
@router.post("/{quotation_id}/negotiate", status_code=status.HTTP_201_CREATED)
async def create_negotiation(
    body: NegotiationCreate,
    quotation_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Customer submits negotiation counter-offer or message."""
    target_qid = quotation_id or body.quotationId
    if not target_qid:
        raise HTTPException(status_code=400, detail="quotationId is required")

    q_res = await db.execute(select(Quotation).where(Quotation.id == target_qid))
    quotation = q_res.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    quotation.status = QuotationStatus.UNDER_NEGOTIATION

    negotiation = Negotiation(
        quotation_id=target_qid,
        requested_by=body.requestedBy or "CUSTOMER",
        message=body.message,
        counter_discount=body.counterDiscount,
        line_id=body.lineId,
        status="PENDING"
    )
    db.add(negotiation)

    # Log in audit trail
    discount_msg = f" (Requested discount: {body.counterDiscount}%)" if body.counterDiscount else ""
    audit = AuditLog(
        quotation_id=target_qid,
        user_id=quotation.customer_id or quotation.rep_id,
        action=AuditAction.UPDATED,
        details=f"Customer requested changes{discount_msg}: {body.message}",
        metadata_json={"message": body.message, "counterDiscount": body.counterDiscount}
    )
    db.add(audit)

    await db.commit()
    await db.refresh(negotiation)

    # Emit to portal and dashboard rooms
    payload = {
        "id": negotiation.id,
        "quotationId": negotiation.quotation_id,
        "message": negotiation.message,
        "counterDiscount": negotiation.counter_discount,
        "requestedBy": negotiation.requested_by,
        "status": negotiation.status,
        "createdAt": negotiation.created_at.isoformat()
    }
    try:
        await sio.emit("negotiation-message", payload, room=f"portal-{quotation.portal_token}")
        await sio.emit("negotiation-message", payload, room="dashboard")
        await sio.emit("quotation-updated", {"id": target_qid, "status": "UNDER_NEGOTIATION"}, room="dashboard")
    except Exception as e:
        print(f"[Socket Error] negotiation-message: {e}")

    return negotiation


@router.put("/{id}/decision")
@router.put("/{id}/respond")
async def decide_negotiation(
    id: str,
    body: NegotiationDecision,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Sales rep or manager accepts or rejects negotiation."""
    stmt = select(Negotiation).where(Negotiation.id == id)
    res = await db.execute(stmt)
    neg = res.scalar_one_or_none()
    if not neg:
        raise HTTPException(status_code=404, detail="Negotiation not found")

    neg.status = body.status.upper()
    await db.commit()
    await db.refresh(neg)
    return neg


@router.post("/{quotation_id}/confirm-portal")
async def confirm_quotation_portal(
    quotation_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Customer confirms quotation via portal."""
    q_res = await db.execute(select(Quotation).where(Quotation.id == quotation_id))
    quotation = q_res.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    quotation.status = QuotationStatus.CONFIRMED

    # Log in audit trail
    audit = AuditLog(
        quotation_id=quotation.id,
        user_id=quotation.customer_id or quotation.rep_id,
        action=AuditAction.CONFIRMED,
        details="Quotation confirmed by customer via portal",
        metadata_json={"portalToken": quotation.portal_token}
    )
    db.add(audit)

    await db.commit()
    await db.refresh(quotation)

    # Emit socket updates
    try:
        await sio.emit(
            "quotation-confirmed",
            {"id": quotation.id, "quotationNumber": quotation.quotation_number},
            room="dashboard"
        )
        await sio.emit(
            "quotation-updated",
            {"id": quotation.id, "status": "CONFIRMED"},
            room=f"portal-{quotation.portal_token}"
        )
        await sio.emit(
            "quotation-updated",
            {"id": quotation.id, "status": "CONFIRMED"},
            room="dashboard"
        )
    except Exception as e:
        print(f"[Socket Error] confirm-portal: {e}")

    return {
        "message": "🎉 Order Confirmed! Your rep will be in touch.",
        "status": "CONFIRMED",
        "needsReapproval": false,
        "quotation": quotation
    }
