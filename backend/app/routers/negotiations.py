from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token
from app.models.models import (
    Negotiation, Quotation, QuotationStatus, QuotationLine, Product,
    Approval, AuditLog, AuditAction, User, UserRole
)
from app.utils.blended_risk_engine import compute_blended_risk_score, compute_order_totals
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

    q_res = await db.execute(
        select(Quotation)
        .options(
            selectinload(Quotation.customer),
            selectinload(Quotation.lines).selectinload(QuotationLine.product)
        )
        .where(Quotation.id == target_qid)
    )
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
    """
    Customer confirms quotation via portal.
    Section B8 & Quick Test Flow Step 7:
    If final terms (e.g. counter discount requested by customer) exceed approval thresholds,
    the quotation automatically re-enters the approval flow (PENDING_MANAGER or PENDING_FINANCE).
    Otherwise, moves directly to CONFIRMED.
    """
    q_res = await db.execute(
        select(Quotation)
        .options(
            selectinload(Quotation.customer),
            selectinload(Quotation.rep),
            selectinload(Quotation.lines).selectinload(QuotationLine.product).selectinload(Product.category),
            selectinload(Quotation.negotiations)
        )
        .where(Quotation.id == quotation_id)
    )
    quotation = q_res.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    # Check latest pending customer negotiation with counter discount
    pending_negs = [n for n in (quotation.negotiations or []) if n.status == "PENDING" and n.counter_discount is not None]
    counter_discount_val = pending_negs[0].counter_discount if pending_negs else None

    # Determine customer tier
    tier_str = "BRONZE"
    if quotation.customer and quotation.customer.customer_tier:
        tier_str = quotation.customer.customer_tier.value.upper()

    # Build raw lines for risk check
    raw_lines = []
    for l in quotation.lines:
        line_discount = float(counter_discount_val) if counter_discount_val is not None else float(l.discount or 0)
        raw_lines.append({
            "productId": l.product_id,
            "quantity": l.quantity,
            "unitPrice": float(l.unit_price),
            "discount": line_discount,
            "costPrice": float(l.cost_price or 0),
            "tax": float(l.tax or 18)
        })

    # Evaluate blended risk
    risk_result = await compute_blended_risk_score(db, raw_lines, tier_str)
    quotation.blended_risk_score = risk_result["blendedScore"]

    # If counter discount was applied, recalculate quotation totals
    if counter_discount_val is not None:
        for l in quotation.lines:
            l.discount = counter_discount_val
        totals = compute_order_totals(raw_lines)
        quotation.subtotal = totals.get("subtotal", 0.0)
        quotation.tax = totals.get("taxAmount") or totals.get("tax") or 0.0
        quotation.discount_amount = totals.get("discountAmount") or totals.get("discount_amount") or 0.0
        quotation.total = totals.get("total", 0.0)
        quotation.margin = totals.get("margin", 0.0)

        # Mark pending negotiations accepted
        for n in pending_negs:
            n.status = "ACCEPTED"

    # Evaluate approval requirement
    needs_reapproval = False
    new_status = QuotationStatus.CONFIRMED

    if risk_result.get("requiresFinance"):
        needs_reapproval = True
        new_status = QuotationStatus.PENDING_FINANCE
    elif risk_result.get("requiresManager"):
        needs_reapproval = True
        new_status = QuotationStatus.PENDING_MANAGER
    elif quotation.blended_risk_score > 0 and quotation.status in (QuotationStatus.UNDER_NEGOTIATION, QuotationStatus.DRAFT):
        needs_reapproval = True
        new_status = QuotationStatus.PENDING_MANAGER

    quotation.status = new_status

    if needs_reapproval:
        audit_msg = (
            f"Customer confirmed negotiation with {counter_discount_val if counter_discount_val is not None else 'revised'}% discount. "
            f"Terms exceed approval ceiling (Risk Score: {quotation.blended_risk_score}). "
            f"Automatically routed for {new_status.value} approval."
        )
        audit = AuditLog(
            quotation_id=quotation.id,
            user_id=quotation.customer_id or quotation.rep_id,
            action=AuditAction.SUBMITTED,
            details=audit_msg,
            metadata_json={"blendedRiskScore": quotation.blended_risk_score, "newStatus": new_status.value}
        )
        db.add(audit)

        # Create pending approval record if not exists
        appr_stmt = select(Approval).where(
            Approval.quotation_id == quotation.id,
            Approval.action.is_(None)
        )
        existing_appr = (await db.execute(appr_stmt)).scalar_one_or_none()
        if not existing_appr:
            # Assign manager
            mgr_res = await db.execute(select(User).where(User.role == UserRole.SALES_MANAGER).limit(1))
            mgr = mgr_res.scalar_one_or_none()
            approver_id = mgr.id if mgr else (quotation.rep_id or quotation.customer_id)
            approval = Approval(
                quotation_id=quotation.id,
                approver_id=approver_id,
                level=1 if new_status == QuotationStatus.PENDING_MANAGER else 2
            )
            db.add(approval)
    else:
        audit = AuditLog(
            quotation_id=quotation.id,
            user_id=quotation.customer_id or quotation.rep_id,
            action=AuditAction.CONFIRMED,
            details="Quotation confirmed by customer via portal without requiring managerial escalation",
            metadata_json={"portalToken": quotation.portal_token}
        )
        db.add(audit)

    await db.commit()
    await db.refresh(quotation)

    # Emit socket events
    try:
        status_val = quotation.status.value
        await sio.emit("quotation-updated", {"id": quotation.id, "status": status_val}, room="dashboard")
        await sio.emit("quotation-updated", {"id": quotation.id, "status": status_val}, room=f"portal-{quotation.portal_token}")

        if needs_reapproval:
            await sio.emit("approval-needed", {
                "quotationId": quotation.id,
                "quotationNumber": quotation.quotation_number,
                "status": status_val,
                "blendedRiskScore": quotation.blended_risk_score
            }, room="dashboard")
        else:
            await sio.emit("quotation-confirmed", {
                "id": quotation.id,
                "quotationNumber": quotation.quotation_number
            }, room="dashboard")
    except Exception as e:
        print(f"[Socket Error] confirm-portal: {e}")

    return {
        "message": (
            "Counter-discount terms exceed approved thresholds. Quotation has automatically re-entered the approval flow for managerial sign-off."
            if needs_reapproval else
            "Order Confirmed! Your representative will be in touch."
        ),
        "status": quotation.status.value,
        "needsReapproval": needs_reapproval,
        "quotation": quotation
    }

