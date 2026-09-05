"""app/routers/dashboard.py — Executive KPIs, deal velocity, and pipeline metrics."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token
from app.models.models import Quotation, QuotationStatus, Invoice, InvoiceStatus, Product, User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/metrics")
async def get_dashboard_metrics(
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Aggregates CPQ pipeline KPIs: total pipeline, approved deals, revenue, risk distribution."""
    # Total Quotations
    q_count_res = await db.execute(select(func.count(Quotation.id)))
    total_quotations = q_count_res.scalar() or 0

    # Pipeline Value (sum of total)
    q_sum_res = await db.execute(select(func.sum(Quotation.total)))
    pipeline_value = float(q_sum_res.scalar() or 0.0)

    # Approved Deals Count & Value
    app_res = await db.execute(
        select(func.count(Quotation.id), func.sum(Quotation.total))
        .where(Quotation.status == QuotationStatus.APPROVED)
    )
    app_count, app_val = app_res.one()
    approved_deals_count = app_count or 0
    approved_deals_value = float(app_val or 0.0)

    # Invoices Revenue (PAID)
    paid_inv_res = await db.execute(
        select(func.sum(Invoice.amount))
        .where(Invoice.status == InvoiceStatus.PAID)
    )
    realized_revenue = float(paid_inv_res.scalar() or 0.0)

    # Pending Approvals
    pending_res = await db.execute(
        select(func.count(Quotation.id))
        .where(Quotation.status.in_([QuotationStatus.PENDING_MANAGER, QuotationStatus.PENDING_FINANCE]))
    )
    pending_approvals = pending_res.scalar() or 0

    # Average Margin
    avg_margin_res = await db.execute(select(func.avg(Quotation.margin)))
    average_margin = round(float(avg_margin_res.scalar() or 0.0), 1)

    # Average Blended Risk Score
    avg_risk_res = await db.execute(select(func.avg(Quotation.blended_risk_score)))
    average_risk = round(float(avg_risk_res.scalar() or 0.0), 2)

    return {
        "totalQuotations": total_quotations,
        "pipelineValue": pipeline_value,
        "approvedDealsCount": approved_deals_count,
        "approvedDealsValue": approved_deals_value,
        "realizedRevenue": realized_revenue,
        "pendingApprovals": pending_approvals,
        "averageMargin": average_margin,
        "averageRisk": average_risk
    }
