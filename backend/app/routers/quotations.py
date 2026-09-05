"""app/routers/quotations.py — Full CPQ lifecycle (FastAPI)."""
import uuid as _uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token, require_roles
from app.models.models import (
    Quotation, QuotationLine, Approval, Negotiation, QuotationStatus,
    Product, AuditLog, AuditAction
)
from app.utils.blended_risk_engine import compute_blended_risk_score, compute_order_totals

router = APIRouter(prefix="/api/quotations", tags=["quotations"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class LineIn(BaseModel):
    product_id: str
    variant_id: str | None = None
    line_type: str = "ONE_TIME"
    quantity: int
    unit_price: float
    discount: float = 0
    notes: str | None = None


class CreateQuotationRequest(BaseModel):
    customer_id: str | None = None
    customer_tier: str = "BRONZE"
    lines: list[LineIn]
    rep_notes: str | None = None
    expiry_date: str | None = None


class DecisionRequest(BaseModel):
    action: str  # APPROVED | REJECTED | RETURNED
    reason: str | None = None


class RiskComputeRequest(BaseModel):
    lines: list[LineIn]
    customer_tier: str = "BRONZE"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
async def get_quotations(
    status: str = None, rep_id: str = None, search: str = None,
    user=Depends(verify_token), db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Quotation)
        .options(
            selectinload(Quotation.rep),
            selectinload(Quotation.customer),
            selectinload(Quotation.lines).selectinload(QuotationLine.product).selectinload(Product.category),
            selectinload(Quotation.approvals),
        )
        .order_by(Quotation.updated_at.desc())
    )
    if user["role"] == "SALES_REP":
        stmt = stmt.where(Quotation.rep_id == user["id"])
    if status:
        stmt = stmt.where(Quotation.status == status)
    if rep_id and user["role"] != "SALES_REP":
        stmt = stmt.where(Quotation.rep_id == rep_id)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/portal/{token}")
async def portal_view(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Quotation)
        .options(
            selectinload(Quotation.rep),
            selectinload(Quotation.lines).selectinload(QuotationLine.product).selectinload(Product.category),
            selectinload(Quotation.negotiations),
        )
        .where(Quotation.portal_token == token)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return q


@router.post("/compute-risk")
async def compute_risk(body: RiskComputeRequest, user=Depends(verify_token), db: AsyncSession = Depends(get_db)):
    lines = [l.model_dump() for l in body.lines]
    totals = compute_order_totals(lines)
    risk = await compute_blended_risk_score(lines, body.customer_tier, db)
    return {**risk, "totals": totals}


@router.get("/{quotation_id}")
async def get_quotation(quotation_id: str, user=Depends(verify_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Quotation)
        .options(
            selectinload(Quotation.rep),
            selectinload(Quotation.customer),
            selectinload(Quotation.lines).selectinload(QuotationLine.product).selectinload(Product.category),
            selectinload(Quotation.approvals),
            selectinload(Quotation.negotiations),
            selectinload(Quotation.invoices),
            selectinload(Quotation.audit_logs),
        )
        .where(Quotation.id == quotation_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return q


@router.post("/", status_code=201)
async def create_quotation(
    body: CreateQuotationRequest,
    user=Depends(require_roles("SALES_REP", "SALES_MANAGER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    if not body.lines:
        raise HTTPException(status_code=400, detail="At least one product line required")

    lines = []
    for l in body.lines:
        product_result = await db.execute(select(Product).where(Product.id == l.product_id))
        product = product_result.scalar_one_or_none()
        ld = l.model_dump()
        ld["cost_price"] = float(product.cost_price) if product else 0
        ld["tax"] = float(product.tax) if product else 18
        lines.append(ld)

    totals = compute_order_totals(lines)
    risk = await compute_blended_risk_score(lines, body.customer_tier, db)

    count_result = await db.execute(select(func.count(Quotation.id)))
    count = count_result.scalar_one()
    q_number = f"QT-{datetime.now().year}-{str(count + 1).zfill(3)}"
    portal_token = str(_uuid.uuid4())

    q = Quotation(
        quotation_number=q_number,
        rep_id=user["id"],
        customer_id=body.customer_id,
        customer_tier=body.customer_tier,
        status=QuotationStatus.DRAFT,
        blended_risk_score=risk["blended_score"],
        subtotal=totals["subtotal"],
        tax_amount=totals["tax_amount"],
        discount_amount=totals["discount_amount"],
        total=totals["total"],
        margin=totals["margin"],
        portal_token=portal_token,
        rep_notes=body.rep_notes,
        expiry_date=datetime.fromisoformat(body.expiry_date) if body.expiry_date else None,
    )
    db.add(q)
    await db.flush()

    for l in lines:
        db.add(QuotationLine(
            quotation_id=q.id,
            product_id=l["product_id"],
            variant_id=l.get("variant_id"),
            line_type=l.get("line_type", "ONE_TIME"),
            quantity=int(l["quantity"]),
            unit_price=float(l["unit_price"]),
            cost_price=float(l["cost_price"]),
            discount=float(l.get("discount", 0)),
            tax=float(l["tax"]),
            line_total=float(l.get("line_total", 0)),
            margin=float(l.get("margin", 0)),
            notes=l.get("notes"),
        ))

    db.add(AuditLog(
        quotation_id=q.id, user_id=user["id"],
        action=AuditAction.CREATED,
        details=f"Quotation {q_number} created",
        metadata={"riskScore": risk["blended_score"]},
    ))
    await db.flush()
    await db.refresh(q)
    return {"quotation": q, "riskAnalysis": risk}


@router.put("/{quotation_id}/submit")
async def submit_quotation(
    quotation_id: str,
    user=Depends(require_roles("SALES_REP", "SALES_MANAGER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Quotation)
        .options(selectinload(Quotation.lines).selectinload(QuotationLine.product).selectinload(Product.category))
        .where(Quotation.id == quotation_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Not found")

    lines = [
        {"product_id": str(l.product_id), "quantity": l.quantity,
         "unit_price": float(l.unit_price), "discount": float(l.discount),
         "cost_price": float(l.cost_price), "tax": float(l.tax)}
        for l in q.lines
    ]
    risk = await compute_blended_risk_score(lines, q.customer_tier, db)

    if risk["requires_finance"]:
        new_status = QuotationStatus.PENDING_FINANCE
    elif risk["requires_manager"]:
        new_status = QuotationStatus.PENDING_MANAGER
    else:
        new_status = QuotationStatus.APPROVED

    q.status = new_status
    q.last_activity_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        quotation_id=q.id, user_id=user["id"], action=AuditAction.SUBMITTED,
        details=f"Submitted. Risk: {risk['blended_score']}. Routed to: {new_status.value}",
    ))
    await db.flush()
    return {"quotation": q, "riskAnalysis": risk}


@router.put("/{quotation_id}/decision")
async def decision(
    quotation_id: str, body: DecisionRequest,
    user=Depends(require_roles("SALES_MANAGER", "FINANCE", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    if body.action not in ("APPROVED", "REJECTED", "RETURNED"):
        raise HTTPException(status_code=400, detail="Invalid action")

    result = await db.execute(select(Quotation).where(Quotation.id == quotation_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Not found")

    status_map = {"APPROVED": QuotationStatus.APPROVED,
                  "REJECTED": QuotationStatus.REJECTED,
                  "RETURNED": QuotationStatus.DRAFT}
    q.status = status_map[body.action]
    q.last_activity_at = datetime.now(timezone.utc)

    db.add(Approval(
        quotation_id=q.id, approver_id=user["id"],
        level=2 if user["role"] == "FINANCE" else 1,
        action=body.action, reason=body.reason, decided_at=datetime.now(timezone.utc),
    ))

    action_map = {"APPROVED": AuditAction.APPROVED, "REJECTED": AuditAction.REJECTED,
                  "RETURNED": AuditAction.RETURNED}
    db.add(AuditLog(
        quotation_id=q.id, user_id=user["id"], action=action_map[body.action],
        details=body.reason or f"{body.action} by {user['role']}",
        metadata={"action": body.action, "role": user["role"]},
    ))
    await db.flush()
    return {"message": f"Quotation {body.action.lower()} successfully"}


@router.put("/{quotation_id}/send")
async def send_to_customer(
    quotation_id: str,
    user=Depends(require_roles("SALES_REP", "SALES_MANAGER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Quotation).where(Quotation.id == quotation_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    if q.status != QuotationStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved quotations can be sent")

    q.status = QuotationStatus.SENT_TO_CUSTOMER
    q.last_activity_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        quotation_id=q.id, user_id=user["id"],
        action=AuditAction.SENT, details="Sent to customer portal",
    ))
    await db.flush()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    portal_url = f"{frontend_url}/portal/{q.portal_token}"
    return {"message": "Sent to customer", "portalUrl": portal_url, "portalToken": q.portal_token}


import os  # noqa: E402 (needed for env var at bottom)
