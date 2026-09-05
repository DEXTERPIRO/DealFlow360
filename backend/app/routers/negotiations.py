"""app/routers/negotiations.py — Quotation customer discount negotiations."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token
from app.models.models import Negotiation, Quotation, AuditLog, AuditAction
from app.sockets.server import sio

router = APIRouter(prefix="/api/negotiations", tags=["negotiations"])


class NegotiationCreate(BaseModel):
    quotationId: str
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
async def create_negotiation(
    body: NegotiationCreate,
    db: AsyncSession = Depends(get_db)
):
    """Customer submits negotiation counter-offer or message."""
    q_res = await db.execute(select(Quotation).where(Quotation.id == body.quotationId))
    quotation = q_res.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    negotiation = Negotiation(
        quotation_id=body.quotationId,
        requested_by=body.requestedBy or "CUSTOMER",
        message=body.message,
        counter_discount=body.counterDiscount,
        line_id=body.lineId,
        status="PENDING"
    )
    db.add(negotiation)
    await db.commit()
    await db.refresh(negotiation)

    # Emit to portal and dashboard rooms
    try:
        await sio.emit(
            "negotiation-message",
            {
                "id": negotiation.id,
                "quotationId": negotiation.quotation_id,
                "message": negotiation.message,
                "counterDiscount": negotiation.counter_discount,
                "requestedBy": negotiation.requested_by,
                "status": negotiation.status,
                "createdAt": negotiation.created_at.isoformat()
            },
            room=f"portal-{quotation.portal_token}"
        )
        await sio.emit(
            "negotiation-message",
            {
                "id": negotiation.id,
                "quotationId": negotiation.quotation_id,
                "message": negotiation.message,
                "counterDiscount": negotiation.counter_discount,
                "requestedBy": negotiation.requested_by,
                "status": negotiation.status,
                "createdAt": negotiation.created_at.isoformat()
            },
            room="dashboard"
        )
    except Exception as e:
        print(f"[Socket Error] negotiation-message: {e}")

    return negotiation


@router.put("/{id}/decision")
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
