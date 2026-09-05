"""app/routers/invoices.py — Invoices, payments, and ReportLab PDF streaming."""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token, require_roles
from app.models.models import (
    Invoice, InvoiceStatus, Quotation, QuotationLine, Product,
    AuditLog, AuditAction, User
)
from app.utils.pdf_generator import generate_invoice_pdf
from app.sockets.server import sio

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class InvoiceCreate(BaseModel):
    quotationId: str
    dueDate: Optional[str] = None
    isRecurring: Optional[bool] = False


class PaymentBody(BaseModel):
    paymentRef: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
@router.get("/")
async def get_invoices(
    status: Optional[str] = Query(None),
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """List invoices, optionally filtered by status."""
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.quotation).selectinload(Quotation.customer),
            selectinload(Invoice.quotation).selectinload(Quotation.rep)
        )
        .order_by(Invoice.created_at.desc())
    )

    if status:
        try:
            status_enum = InvoiceStatus(status.upper())
            stmt = stmt.where(Invoice.status == status_enum)
        except ValueError:
            pass

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceCreate,
    user: dict = Depends(require_roles("FINANCE", "SALES_MANAGER", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Create invoice from quotation, generate invoice_number, and log INVOICED audit log."""
    q_res = await db.execute(
        select(Quotation)
        .where(Quotation.id == body.quotationId)
        .options(
            selectinload(Quotation.lines).selectinload(QuotationLine.product)
        )
    )
    quotation = q_res.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    # Generate sequential invoice number INV-YYYY-001
    count_res = await db.execute(select(func.count(Invoice.id)))
    count = count_res.scalar() or 0
    current_year = datetime.now(timezone.utc).year
    invoice_number = f"INV-{current_year}-{(count + 1):03d}"

    due_dt = datetime.now(timezone.utc) + timedelta(days=30)
    if body.dueDate:
        try:
            due_dt = datetime.fromisoformat(body.dueDate.replace("Z", "+00:00"))
        except Exception:
            pass

    invoice = Invoice(
        invoice_number=invoice_number,
        quotation_id=quotation.id,
        status=InvoiceStatus.SENT,
        amount=quotation.total,
        due_date=due_dt,
        is_recurring=body.isRecurring or False
    )
    db.add(invoice)

    # Write AuditLog
    audit = AuditLog(
        quotation_id=quotation.id,
        user_id=user["id"],
        action=AuditAction.INVOICED,
        details=f"Invoice {invoice_number} created for total INR {float(quotation.total):,.2f}",
        metadata_json={"invoiceNumber": invoice_number, "amount": float(quotation.total)}
    )
    db.add(audit)

    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.put("/{id}/pay")
async def pay_invoice(
    id: str,
    body: Optional[PaymentBody] = None,
    user: dict = Depends(require_roles("FINANCE", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Record payment for invoice, update status to PAID, and emit invoice-paid Socket.IO event."""
    stmt = (
        select(Invoice)
        .where(Invoice.id == id)
        .options(
            selectinload(Invoice.quotation).selectinload(Quotation.customer)
        )
    )
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = InvoiceStatus.PAID
    invoice.paid_at = datetime.now(timezone.utc)
    if body and body.paymentRef:
        invoice.payment_ref = body.paymentRef

    audit = AuditLog(
        quotation_id=invoice.quotation_id,
        user_id=user["id"],
        action=AuditAction.PAID,
        details=f"Invoice {invoice.invoice_number} marked as PAID. Ref: {invoice.payment_ref or 'N/A'}",
        metadata_json={"invoiceNumber": invoice.invoice_number, "paymentRef": invoice.payment_ref}
    )
    db.add(audit)
    await db.commit()
    await db.refresh(invoice)

    # Emit "invoice-paid" to "dashboard" room
    try:
        await sio.emit(
            "invoice-paid",
            {
                "invoiceId": invoice.id,
                "invoiceNumber": invoice.invoice_number,
                "quotationId": invoice.quotation_id,
                "amount": float(invoice.amount),
                "paidAt": invoice.paid_at.isoformat() if invoice.paid_at else None
            },
            room="dashboard"
        )
    except Exception as e:
        print(f"[Socket Error] invoice-paid: {e}")

    return {
        "message": f"Invoice {invoice.invoice_number} paid successfully",
        "invoice": invoice
    }


@router.get("/{id}/pdf")
async def get_invoice_pdf(
    id: str,
    db: AsyncSession = Depends(get_db)
):
    """Generate and stream ReportLab PDF invoice."""
    stmt = (
        select(Invoice)
        .where(Invoice.id == id)
        .options(
            selectinload(Invoice.quotation).selectinload(Quotation.customer),
            selectinload(Invoice.quotation).selectinload(Quotation.rep),
            selectinload(Invoice.quotation).selectinload(Quotation.lines).selectinload(QuotationLine.product)
        )
    )
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    quotation = invoice.quotation
    if not quotation:
        raise HTTPException(status_code=404, detail="Associated quotation not found")

    pdf_buffer = generate_invoice_pdf(invoice, quotation)

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=invoice-{invoice.invoice_number}.pdf"
        }
    )
