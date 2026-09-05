"""app/routers/subscriptions.py — Subscription plans and recurring customer subscriptions."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from dateutil.relativedelta import relativedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token, require_roles
from app.models.models import (
    Subscription, SubscriptionPlan, Quotation, QuotationLine,
    BillingCycle, LineType
)

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class PlanCreate(BaseModel):
    name: str
    billingCycle: BillingCycle
    prorateOnChange: Optional[bool] = True
    cancelPolicy: Optional[str] = None
    partialRefund: Optional[bool] = False


class SubscriptionCreate(BaseModel):
    planId: str
    productId: str
    quantity: Optional[int] = 1
    unitPrice: float
    startDate: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/plans")
async def get_plans(
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """List all subscription plans."""
    stmt = select(SubscriptionPlan).order_by(SubscriptionPlan.created_at.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/plans", status_code=status.HTTP_201_CREATED)
async def create_plan(
    body: PlanCreate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    """Create a subscription plan (restricted to ADMIN or SALES_MANAGER)."""
    plan = SubscriptionPlan(
        name=body.name,
        billing_cycle=body.billingCycle,
        prorate_on_change=body.prorateOnChange if body.prorateOnChange is not None else True,
        cancel_policy=body.cancelPolicy,
        partial_refund=body.partialRefund or False
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.get("")
@router.get("/")
async def get_subscriptions(
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """List all subscriptions ordered by next_billing_date."""
    stmt = (
        select(Subscription)
        .options(
            selectinload(Subscription.plan),
            selectinload(Subscription.quotation)
        )
        .order_by(Subscription.next_billing_date.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{quotation_id}", status_code=status.HTTP_201_CREATED)
async def create_subscription(
    quotation_id: str,
    body: SubscriptionCreate,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Create subscription linked to quotation with billing cycle calculation."""
    # Verify quotation exists
    q_res = await db.execute(select(Quotation).where(Quotation.id == quotation_id))
    quotation = q_res.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    # Fetch plan
    p_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == body.planId))
    plan = p_res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")

    start = datetime.now(timezone.utc)
    if body.startDate:
        try:
            start = datetime.fromisoformat(body.startDate.replace("Z", "+00:00"))
        except Exception:
            start = datetime.now(timezone.utc)

    # Compute next billing date using dateutil relativedelta
    if plan.billing_cycle == BillingCycle.MONTHLY:
        next_billing = start + relativedelta(months=1)
    elif plan.billing_cycle == BillingCycle.QUARTERLY:
        next_billing = start + relativedelta(months=3)
    else:  # YEARLY
        next_billing = start + relativedelta(years=1)

    sub = Subscription(
        quotation_id=quotation_id,
        plan_id=body.planId,
        product_id=body.productId,
        quantity=body.quantity or 1,
        unit_price=Decimal(str(body.unitPrice)),
        start_date=start,
        next_billing_date=next_billing,
        status="ACTIVE"
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.put("/{id}/cancel")
async def cancel_subscription(
    id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Cancel subscription."""
    stmt = select(Subscription).where(Subscription.id == id)
    res = await db.execute(stmt)
    sub = res.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    sub.status = "CANCELLED"
    sub.cancelled_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sub)
    return {"message": "Subscription cancelled successfully", "subscription": sub}
