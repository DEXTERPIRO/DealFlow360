"""app/routers/invoices.py — Invoices, payments, and ReportLab PDF streaming."""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload, aliased
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


import uuid

class PaymentBody(BaseModel):
    paymentRef: Optional[str] = None
    paymentMethod: Optional[str] = "MANUAL"
    paymentDate: Optional[str] = None
    gatewayDetails: Optional[dict] = None


@router.get("")
@router.get("/")
async def get_invoices(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    CustomerUser = aliased(User)
    stmt = (
        select(Invoice)
        .outerjoin(Quotation, Invoice.quotation_id == Quotation.id)
        .outerjoin(CustomerUser, Quotation.customer_id == CustomerUser.id)
        .options(
            selectinload(Invoice.quotation).selectinload(Quotation.customer),
            selectinload(Invoice.quotation).selectinload(Quotation.rep)
        )
        .order_by(Invoice.created_at.desc())
    )

    if status and status != "ALL":
        try:
            status_enum = InvoiceStatus(status.upper().strip())
            stmt = stmt.where(Invoice.status == status_enum)
        except ValueError:
            pass

    if search and search.strip():
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Invoice.invoice_number.ilike(search_pattern),
                Quotation.quotation_number.ilike(search_pattern),
                CustomerUser.name.ilike(search_pattern),
                CustomerUser.company_name.ilike(search_pattern),
                CustomerUser.email.ilike(search_pattern)
            )
        )

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

    count_res = await db.execute(select(func.count(Invoice.id)))
    count = count_res.scalar() or 0
    current_year = datetime.utcnow().year
    invoice_number = f"INV-{current_year}-{(count + 1):03d}"

    due_dt = datetime.utcnow() + timedelta(days=30)
    if body.dueDate:
        try:
            due_dt = datetime.fromisoformat(body.dueDate.replace("Z", "")).replace(tzinfo=None)
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


@router.post("/{id}/razorpay-order")
async def create_razorpay_order(
    id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Create a real official Razorpay Order for this invoice using configured keys."""
    import os
    import httpx
    from app.config import settings

    stmt = (
        select(Invoice)
        .where(Invoice.id == id)
        .options(selectinload(Invoice.quotation).selectinload(Quotation.customer))
    )
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    key_id = settings.RAZORPAY_KEY_ID or os.getenv("RAZORPAY_KEY_ID", "rzp_test_TYSSO3qiz67Ke3")
    key_secret = settings.RAZORPAY_KEY_SECRET or os.getenv("RAZORPAY_KEY_SECRET", "INNXF2aC11Nh7v8CQoinc4bD")
    amount_in_paise = int(round(float(invoice.amount) * 100))
    customer_name = invoice.quotation.customer.name if invoice.quotation and invoice.quotation.customer else "Acme Corporation"
    customer_email = invoice.quotation.customer.email if invoice.quotation and invoice.quotation.customer else "billing@acme.com"

    real_order_id = None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.razorpay.com/v1/orders",
                auth=(key_id, key_secret),
                json={
                    "amount": amount_in_paise,
                    "currency": "INR",
                    "receipt": f"inv_{invoice.invoice_number.replace('-', '_')}",
                    "notes": {
                        "invoice_id": invoice.id,
                        "invoice_number": invoice.invoice_number
                    }
                },
                timeout=10.0
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                real_order_id = data.get("id")
            else:
                print(f"[Razorpay API Error] {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[Razorpay Order Exception] {e}")

    return {
        "order_id": real_order_id,
        "key_id": key_id,
        "amount": amount_in_paise,
        "currency": "INR",
        "name": "DealFlow360 Technologies",
        "description": f"Payment for Invoice {invoice.invoice_number}",
        "invoice_number": invoice.invoice_number,
        "prefill": {
            "name": customer_name,
            "email": customer_email,
            "contact": "+919876543210"
        },
        "theme": {
            "color": "#0c2340"
        }
    }


@router.post("/{id}/payu-order")
async def create_payu_order(
    id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Create or simulate a PayU transaction payload for this invoice."""
    stmt = (
        select(Invoice)
        .where(Invoice.id == id)
        .options(selectinload(Invoice.quotation).selectinload(Quotation.customer))
    )
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    txn_id = f"payu_txn_{uuid.uuid4().hex[:14]}"
    customer_name = invoice.quotation.customer.name if invoice.quotation and invoice.quotation.customer else "Enterprise Customer"
    customer_email = invoice.quotation.customer.email if invoice.quotation and invoice.quotation.customer else "billing@dealflow.com"

    return {
        "txn_id": txn_id,
        "merchant_key": "PAYU_BIZ_DEMO_KEY",
        "amount": float(invoice.amount),
        "product_info": f"Invoice {invoice.invoice_number}",
        "invoice_number": invoice.invoice_number,
        "firstname": customer_name,
        "email": customer_email,
        "phone": "9876543210",
        "surl": "http://localhost:5173/invoices?status=success",
        "furl": "http://localhost:5173/invoices?status=failure"
    }


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
    invoice.paid_at = datetime.utcnow()
    if body and body.paymentRef:
        invoice.payment_ref = body.paymentRef

    method = body.paymentMethod if body and body.paymentMethod else "MANUAL"
    audit = AuditLog(
        quotation_id=invoice.quotation_id,
        user_id=user["id"],
        action=AuditAction.PAID,
        details=f"Invoice {invoice.invoice_number} marked as PAID via {method}. Ref: {invoice.payment_ref or 'N/A'}",
        metadata_json={
            "invoiceNumber": invoice.invoice_number,
            "paymentRef": invoice.payment_ref,
            "paymentMethod": method,
            "gatewayDetails": body.gatewayDetails if body and body.gatewayDetails else {}
        }
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
                "paymentMethod": method,
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


@router.put("/{id}/send")
async def send_invoice(
    id: str,
    user: dict = Depends(require_roles("FINANCE", "ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    """Mark an invoice as SENT."""
    stmt = select(Invoice).where(Invoice.id == id)
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = InvoiceStatus.SENT
    await db.commit()
    await db.refresh(invoice)
    return {"message": f"Invoice {invoice.invoice_number} marked as SENT", "invoice": invoice}


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

