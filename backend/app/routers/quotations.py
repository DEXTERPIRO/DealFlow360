from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload, aliased
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.middleware.auth import verify_token, require_roles
from app.models.models import (
    Quotation, QuotationLine, Approval, Negotiation, QuotationStatus,
    Product, AuditLog, AuditAction, User, CustomerTier, LineType
)
from app.utils.blended_risk_engine import compute_blended_risk_score, compute_order_totals
from app.sockets.server import sio

router = APIRouter(prefix="/api/quotations", tags=["quotations"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class LineItemIn(BaseModel):
    productId: Optional[str] = None
    product_id: Optional[str] = None
    variantId: Optional[str] = None
    variant_id: Optional[str] = None
    lineType: Optional[str] = "ONE_TIME"
    line_type: Optional[str] = None
    quantity: int
    unitPrice: Optional[float] = None
    unit_price: Optional[float] = None
    costPrice: Optional[float] = None
    cost_price: Optional[float] = None
    discount: Optional[float] = 0.0
    tax: Optional[float] = 18.0
    notes: Optional[str] = None

    def get_product_id(self) -> str:
        pid = self.productId or self.product_id
        if not pid:
            raise ValueError("productId is required")
        return pid

    def get_variant_id(self) -> Optional[str]:
        return self.variantId or self.variant_id

    def get_line_type(self) -> str:
        return self.line_type or self.lineType or "ONE_TIME"

    def get_unit_price(self) -> float:
        val = self.unitPrice if self.unitPrice is not None else self.unit_price
        return float(val or 0.0)

    def get_cost_price(self) -> float:
        val = self.costPrice if self.costPrice is not None else self.cost_price
        return float(val or 0.0)

    def to_dict(self) -> dict:
        return {
            "productId": self.get_product_id(),
            "variantId": self.get_variant_id(),
            "lineType": self.get_line_type(),
            "quantity": self.quantity,
            "unitPrice": self.get_unit_price(),
            "costPrice": self.get_cost_price(),
            "discount": self.discount or 0.0,
            "tax": self.tax if self.tax is not None else 18.0,
            "notes": self.notes
        }


class QuotationCreate(BaseModel):
    customerId: Optional[str] = None
    customerTier: Optional[str] = "BRONZE"
    lines: List[LineItemIn]
    repNotes: Optional[str] = None
    expiryDate: Optional[str] = None


class QuotationUpdate(BaseModel):
    customerId: Optional[str] = None
    customerTier: Optional[str] = None
    lines: List[LineItemIn]
    repNotes: Optional[str] = None
    expiryDate: Optional[str] = None


class DecisionBody(BaseModel):
    action: str  # APPROVED, REJECTED, RETURNED
    reason: Optional[str] = None


class ComputeRiskBody(BaseModel):
    lines: List[LineItemIn]
    customerTier: Optional[str] = "BRONZE"


# ---------------------------------------------------------------------------
# Helper: Format Quotation to Dict for Socket.IO
# ---------------------------------------------------------------------------

def quotation_to_dict(q: Quotation) -> dict:
    return {
        "id": q.id,
        "quotationNumber": q.quotation_number,
        "repId": q.rep_id,
        "customerId": q.customer_id,
        "customerTier": q.customer_tier.value if hasattr(q.customer_tier, "value") else q.customer_tier,
        "status": q.status.value if hasattr(q.status, "value") else q.status,
        "blendedRiskScore": q.blended_risk_score,
        "subtotal": float(q.subtotal),
        "taxAmount": float(q.tax_amount),
        "discountAmount": float(q.discount_amount),
        "total": float(q.total),
        "margin": q.margin,
        "portalToken": q.portal_token,
        "repNotes": q.rep_notes,
        "customerNotes": q.customer_notes,
        "expiryDate": q.expiry_date.isoformat() if q.expiry_date else None,
        "createdAt": q.created_at.isoformat() if q.created_at else None,
        "updatedAt": q.updated_at.isoformat() if q.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
@router.get("/")
async def get_quotations(
    status: Optional[str] = Query(None),
    repId: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    dateRange: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    CustomerUser = aliased(User, name="cust_user")
    RepUser = aliased(User, name="rep_user")

    stmt = (
        select(Quotation)
        .outerjoin(CustomerUser, Quotation.customer_id == CustomerUser.id)
        .outerjoin(RepUser, Quotation.rep_id == RepUser.id)
        .options(
            selectinload(Quotation.rep),
            selectinload(Quotation.customer),
            selectinload(Quotation.lines).selectinload(QuotationLine.product).selectinload(Product.category),
            selectinload(Quotation.approvals).selectinload(Approval.approver)
        )
        .order_by(Quotation.updated_at.desc())
    )

    # Sales reps only see their own quotations
    if user.get("role") == "SALES_REP":
        stmt = stmt.where(Quotation.rep_id == user["id"])
    elif repId and repId != "ALL":
        stmt = stmt.where(Quotation.rep_id == repId)

    # Status / Stage database filter
    target_status = status or stage
    if target_status and target_status != "ALL":
        s_upper = target_status.upper().strip()
        if s_upper == "PENDING":
            stmt = stmt.where(Quotation.status.in_([QuotationStatus.PENDING_MANAGER, QuotationStatus.PENDING_FINANCE]))
        elif s_upper in ("SENT", "SENT_TO_CUSTOMER"):
            stmt = stmt.where(Quotation.status == QuotationStatus.SENT_TO_CUSTOMER)
        elif s_upper in ("NEGOTIATING", "UNDER_NEGOTIATION"):
            stmt = stmt.where(Quotation.status == QuotationStatus.UNDER_NEGOTIATION)
        elif s_upper in ("CANCELLED", "REJECTED"):
            stmt = stmt.where(Quotation.status.in_([QuotationStatus.CANCELLED, QuotationStatus.REJECTED]))
        else:
            try:
                status_enum = QuotationStatus(s_upper)
                stmt = stmt.where(Quotation.status == status_enum)
            except ValueError:
                pass

    # Search filter in database: QT number, customer name, company, email, or rep name
    if search and search.strip():
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Quotation.quotation_number.ilike(search_pattern),
                CustomerUser.name.ilike(search_pattern),
                CustomerUser.company_name.ilike(search_pattern),
                CustomerUser.email.ilike(search_pattern),
                RepUser.name.ilike(search_pattern),
                RepUser.email.ilike(search_pattern)
            )
        )

    # Date range database filter: 7D, 30D
    if dateRange and dateRange != "ALL":
        d_upper = dateRange.upper().strip()
        now = datetime.utcnow()
        if d_upper == "7D":
            cutoff = now - timedelta(days=7)
            stmt = stmt.where(Quotation.created_at >= cutoff)
        elif d_upper == "30D":
            cutoff = now - timedelta(days=30)
            stmt = stmt.where(Quotation.created_at >= cutoff)

    # Customer tier database filter
    if tier and tier != "ALL":
        try:
            tier_enum = CustomerTier(tier.upper().strip())
            stmt = stmt.where(Quotation.customer_tier == tier_enum)
        except ValueError:
            pass

    result = await db.execute(stmt)
    quotations = result.scalars().all()
    return quotations


@router.post("/compute-risk")
async def compute_risk(
    body: ComputeRiskBody,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    if not body.lines:
        return {
            "blendedScore": 0.0,
            "approvalRequired": "NONE",
            "requiresManager": False,
            "requiresFinance": False,
            "lineDetails": [],
            "totals": {
                "subtotal": 0.0,
                "discountAmount": 0.0,
                "taxAmount": 0.0,
                "total": 0.0,
                "margin": 0.0,
            }
        }

    raw_lines = [line.to_dict() for line in body.lines]

    # Enrich lines with cost and tax from product if not provided
    for line in raw_lines:
        prod_res = await db.execute(select(Product).where(Product.id == line["productId"]))
        prod = prod_res.scalar_one_or_none()
        if prod:
            if not line["costPrice"]:
                line["costPrice"] = float(prod.cost_price or 0.0)
            if not line["tax"]:
                line["tax"] = float(prod.tax or 18.0)

    totals = compute_order_totals(raw_lines)
    risk = await compute_blended_risk_score(db, raw_lines, body.customerTier or "BRONZE")
    return {**risk, "totals": totals}


@router.get("/portal/{token}")
async def get_portal_quotation(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Quotation)
        .where(Quotation.portal_token == token)
        .options(
            selectinload(Quotation.rep),
            selectinload(Quotation.customer),
            selectinload(Quotation.lines).selectinload(QuotationLine.product).selectinload(Product.category),
            selectinload(Quotation.negotiations),
            selectinload(Quotation.audit_logs).selectinload(AuditLog.user)
        )
    )
    result = await db.execute(stmt)
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return quotation


@router.get("/{id}")
async def get_quotation(
    id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Quotation)
        .where(Quotation.id == id)
        .options(
            selectinload(Quotation.rep),
            selectinload(Quotation.customer),
            selectinload(Quotation.lines).selectinload(QuotationLine.product).selectinload(Product.category),
            selectinload(Quotation.lines).selectinload(QuotationLine.product).selectinload(Product.variants),
            selectinload(Quotation.approvals).selectinload(Approval.approver),
            selectinload(Quotation.fulfillments),
            selectinload(Quotation.subscriptions),
            selectinload(Quotation.invoices),
            selectinload(Quotation.audit_logs).selectinload(AuditLog.user),
            selectinload(Quotation.negotiations)
        )
    )
    result = await db.execute(stmt)
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return quotation


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_quotation(
    body: QuotationCreate,
    user: dict = Depends(require_roles("SALES_REP", "SALES_MANAGER", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    if not body.lines:
        raise HTTPException(status_code=400, detail="At least one product line required")

    raw_lines = [line.to_dict() for line in body.lines]

    # Enrich product costs & taxes
    for line in raw_lines:
        prod_res = await db.execute(select(Product).where(Product.id == line["productId"]))
        prod = prod_res.scalar_one_or_none()
        if prod:
            if not line["costPrice"]:
                line["costPrice"] = float(prod.cost_price or 0.0)
            if not line["tax"]:
                line["tax"] = float(prod.tax or 18.0)

    totals = compute_order_totals(raw_lines)
    tier_str = body.customerTier or "BRONZE"
    risk_result = await compute_blended_risk_score(db, raw_lines, tier_str)

    # Generate sequential quotation number
    count_res = await db.execute(select(func.count(Quotation.id)))
    count = count_res.scalar() or 0
    current_year = datetime.now(timezone.utc).year
    quotation_number = f"QT-{current_year}-{(count + 1):03d}"
    portal_token = str(uuid.uuid4())

    parsed_expiry = None
    if body.expiryDate:
        try:
            parsed_expiry = datetime.fromisoformat(body.expiryDate.replace("Z", "+00:00"))
        except Exception:
            parsed_expiry = None

    try:
        tier_enum = CustomerTier(tier_str)
    except ValueError:
        tier_enum = CustomerTier.BRONZE

    quotation = Quotation(
        quotation_number=quotation_number,
        rep_id=user["id"],
        customer_id=body.customerId,
        customer_tier=tier_enum,
        status=QuotationStatus.DRAFT,
        blended_risk_score=risk_result["blendedScore"],
        subtotal=Decimal(str(totals["subtotal"])),
        tax_amount=Decimal(str(totals["taxAmount"])),
        discount_amount=Decimal(str(totals["discountAmount"])),
        total=Decimal(str(totals["total"])),
        margin=totals["margin"],
        portal_token=portal_token,
        rep_notes=body.repNotes,
        expiry_date=parsed_expiry
    )
    db.add(quotation)
    await db.flush()

    # Create lines
    for l in raw_lines:
        try:
            lt_enum = LineType(l["lineType"])
        except ValueError:
            lt_enum = LineType.ONE_TIME

        q_line = QuotationLine(
            quotation_id=quotation.id,
            product_id=l["productId"],
            variant_id=l["variantId"],
            line_type=lt_enum,
            quantity=int(l["quantity"]),
            unit_price=Decimal(str(l["unitPrice"])),
            cost_price=Decimal(str(l["costPrice"])),
            discount=float(l["discount"]),
            tax=Decimal(str(l["tax"])),
            line_total=Decimal(str(l["lineTotal"])),
            margin=float(l["margin"]),
            notes=l["notes"]
        )
        db.add(q_line)

    # Write AuditLog
    audit = AuditLog(
        quotation_id=quotation.id,
        user_id=user["id"],
        action=AuditAction.CREATED,
        details=f"Quotation {quotation_number} created",
        metadata_json={"riskScore": risk_result["blendedScore"]}
    )
    db.add(audit)

    await db.commit()

    # Eager reload for response and socket emission
    stmt = (
        select(Quotation)
        .where(Quotation.id == quotation.id)
        .options(
            selectinload(Quotation.lines).selectinload(QuotationLine.product),
            selectinload(Quotation.rep),
            selectinload(Quotation.customer)
        )
    )
    res = await db.execute(stmt)
    full_quotation = res.scalar_one()

    # Emit Socket.IO event to "dashboard" room
    try:
        await sio.emit("quotation-created", quotation_to_dict(full_quotation), room="dashboard")
    except Exception as e:
        print(f"[Socket Error] quotation-created: {e}")

    return {
        "quotation": full_quotation,
        "riskAnalysis": risk_result
    }


@router.put("/{id}")
async def update_quotation(
    id: str,
    body: QuotationUpdate,
    user: dict = Depends(require_roles("SALES_REP", "SALES_MANAGER", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Quotation).where(Quotation.id == id).options(selectinload(Quotation.lines))
    result = await db.execute(stmt)
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    if quotation.status not in (QuotationStatus.DRAFT, QuotationStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Only DRAFT or RETURNED quotations can be edited")

    raw_lines = [line.to_dict() for line in body.lines]

    # Enrich product costs & taxes
    for line in raw_lines:
        prod_res = await db.execute(select(Product).where(Product.id == line["productId"]))
        prod = prod_res.scalar_one_or_none()
        if prod:
            if not line["costPrice"]:
                line["costPrice"] = float(prod.cost_price or 0.0)
            if not line["tax"]:
                line["tax"] = float(prod.tax or 18.0)

    tier_str = body.customerTier or (quotation.customer_tier.value if hasattr(quotation.customer_tier, "value") else str(quotation.customer_tier))
    totals = compute_order_totals(raw_lines)
    risk_result = await compute_blended_risk_score(db, raw_lines, tier_str)

    try:
        tier_enum = CustomerTier(tier_str)
    except ValueError:
        tier_enum = quotation.customer_tier

    # Delete existing lines
    for old_line in quotation.lines:
        await db.delete(old_line)
    await db.flush()

    # Recreate lines
    for l in raw_lines:
        try:
            lt_enum = LineType(l["lineType"])
        except ValueError:
            lt_enum = LineType.ONE_TIME

        q_line = QuotationLine(
            quotation_id=quotation.id,
            product_id=l["productId"],
            variant_id=l["variantId"],
            line_type=lt_enum,
            quantity=int(l["quantity"]),
            unit_price=Decimal(str(l["unitPrice"])),
            cost_price=Decimal(str(l["costPrice"])),
            discount=float(l["discount"]),
            tax=Decimal(str(l["tax"])),
            line_total=Decimal(str(l["lineTotal"])),
            margin=float(l["margin"]),
            notes=l["notes"]
        )
        db.add(q_line)

    # Update quotation header
    if body.customerId is not None:
        quotation.customer_id = body.customerId
    quotation.customer_tier = tier_enum
    quotation.blended_risk_score = risk_result["blendedScore"]
    quotation.subtotal = Decimal(str(totals["subtotal"]))
    quotation.tax_amount = Decimal(str(totals["taxAmount"]))
    quotation.discount_amount = Decimal(str(totals["discountAmount"]))
    quotation.total = Decimal(str(totals["total"]))
    quotation.margin = totals["margin"]
    if body.repNotes is not None:
        quotation.rep_notes = body.repNotes
    quotation.status = QuotationStatus.DRAFT
    quotation.last_activity_at = datetime.now(timezone.utc)

    if body.expiryDate:
        try:
            quotation.expiry_date = datetime.fromisoformat(body.expiryDate.replace("Z", "+00:00"))
        except Exception:
            pass

    # Audit log
    audit = AuditLog(
        quotation_id=quotation.id,
        user_id=user["id"],
        action=AuditAction.UPDATED,
        details="Quotation lines updated",
        metadata_json={"riskScore": risk_result["blendedScore"]}
    )
    db.add(audit)

    await db.commit()

    # Reload full quotation
    reload_stmt = (
        select(Quotation)
        .where(Quotation.id == id)
        .options(
            selectinload(Quotation.lines).selectinload(QuotationLine.product),
            selectinload(Quotation.rep),
            selectinload(Quotation.customer)
        )
    )
    res = await db.execute(reload_stmt)
    updated_quotation = res.scalar_one()

    return {
        "quotation": updated_quotation,
        "riskAnalysis": risk_result
    }


@router.put("/{id}/submit")
async def submit_quotation(
    id: str,
    user: dict = Depends(require_roles("SALES_REP", "SALES_MANAGER", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Quotation)
        .where(Quotation.id == id)
        .options(
            selectinload(Quotation.lines).selectinload(QuotationLine.product).selectinload(Product.category)
        )
    )
    result = await db.execute(stmt)
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    lines_dict = [
        {
            "productId": line.product_id,
            "quantity": line.quantity,
            "unitPrice": float(line.unit_price),
            "discount": line.discount,
            "costPrice": float(line.cost_price),
            "tax": float(line.tax)
        }
        for line in quotation.lines
    ]

    tier_str = quotation.customer_tier.value if hasattr(quotation.customer_tier, "value") else str(quotation.customer_tier)
    risk_result = await compute_blended_risk_score(db, lines_dict, tier_str)

    if risk_result["requiresFinance"]:
        new_status = QuotationStatus.PENDING_FINANCE
    elif risk_result["requiresManager"]:
        new_status = QuotationStatus.PENDING_MANAGER
    else:
        new_status = QuotationStatus.APPROVED

    quotation.status = new_status
    quotation.blended_risk_score = risk_result["blendedScore"]
    quotation.last_activity_at = datetime.now(timezone.utc)

    audit = AuditLog(
        quotation_id=quotation.id,
        user_id=user["id"],
        action=AuditAction.SUBMITTED,
        details=f"Submitted. Risk score: {risk_result['blendedScore']}. Routed to: {new_status.value}",
        metadata_json={"riskScore": risk_result["blendedScore"], "status": new_status.value}
    )
    db.add(audit)
    await db.commit()

    # Emit "approval-needed" to "approvers" room
    try:
        await sio.emit(
            "approval-needed",
            {
                "quotationId": quotation.id,
                "quotationNumber": quotation.quotation_number,
                "status": new_status.value,
                "riskScore": risk_result["blendedScore"]
            },
            room="approvers"
        )
    except Exception as e:
        print(f"[Socket Error] approval-needed: {e}")

    return {
        "quotation": quotation,
        "riskAnalysis": risk_result
    }


@router.put("/{id}/decision")
async def decide_quotation(
    id: str,
    body: DecisionBody,
    user: dict = Depends(require_roles("SALES_MANAGER", "FINANCE", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    action = body.action.upper()
    if action not in ("APPROVED", "REJECTED", "RETURNED"):
        raise HTTPException(status_code=400, detail="Invalid action. Must be APPROVED, REJECTED, or RETURNED")

    stmt = select(Quotation).where(Quotation.id == id)
    result = await db.execute(stmt)
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    if action == "APPROVED":
        new_status = QuotationStatus.APPROVED
        audit_action = AuditAction.APPROVED
    elif action == "REJECTED":
        new_status = QuotationStatus.REJECTED
        audit_action = AuditAction.REJECTED
    else:  # RETURNED
        new_status = QuotationStatus.DRAFT
        audit_action = AuditAction.RETURNED

    approval_level = 2 if user.get("role") == "FINANCE" else 1

    approval = Approval(
        quotation_id=quotation.id,
        approver_id=user["id"],
        level=approval_level,
        action=action,
        reason=body.reason,
        decided_at=datetime.now(timezone.utc)
    )
    db.add(approval)

    quotation.status = new_status
    quotation.last_activity_at = datetime.now(timezone.utc)

    audit = AuditLog(
        quotation_id=quotation.id,
        user_id=user["id"],
        action=audit_action,
        details=body.reason or f"{action} by {user.get('role')}",
        metadata_json={"action": action, "role": user.get("role")}
    )
    db.add(audit)

    await db.commit()

    # Emit "approval-decision" to "dashboard" room
    try:
        await sio.emit(
            "approval-decision",
            {
                "quotationId": quotation.id,
                "action": action,
                "newStatus": new_status.value
            },
            room="dashboard"
        )
    except Exception as e:
        print(f"[Socket Error] approval-decision: {e}")

    return {"message": f"Quotation {action.lower()} successfully", "status": new_status.value}


@router.put("/{id}/send")
async def send_quotation(
    id: str,
    user: dict = Depends(require_roles("SALES_REP", "SALES_MANAGER", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Quotation).where(Quotation.id == id).options(
        selectinload(Quotation.customer),
        selectinload(Quotation.rep)
    )
    result = await db.execute(stmt)
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    if quotation.status != QuotationStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved quotations can be sent")

    if not quotation.portal_token:
        quotation.portal_token = f"portal-token-{secrets.token_hex(6)}"

    quotation.status = QuotationStatus.SENT_TO_CUSTOMER
    quotation.last_activity_at = datetime.now(timezone.utc)

    audit = AuditLog(
        quotation_id=quotation.id,
        user_id=user["id"],
        action=AuditAction.SENT,
        details="Sent to customer portal"
    )
    db.add(audit)
    await db.commit()

    portal_url = f"{settings.FRONTEND_URL}/portal/{quotation.portal_token}"

    # Dispatch real email via Gmail SMTP
    if quotation.customer and quotation.customer.email:
        try:
            from app.utils.mailer import send_quotation_email
            rep_name = quotation.rep.name if quotation.rep else "Sales Operations"
            cust_name = quotation.customer.name or quotation.customer.company_name or "Valued Client"
            send_quotation_email(
                to_email=quotation.customer.email,
                customer_name=cust_name,
                quotation_number=quotation.quotation_number,
                total_amount=float(quotation.total),
                portal_token=quotation.portal_token,
                rep_name=rep_name
            )
        except Exception as mail_err:
            print(f"[Mailer Error] {mail_err}")

    return {
        "message": "Sent to customer with email notification",
        "portalUrl": portal_url,
        "portalToken": quotation.portal_token
    }


class StatusUpdateBody(BaseModel):
    status: str
    reason: Optional[str] = None


@router.put("/{id}/status")
async def update_quotation_status(
    id: str,
    body: StatusUpdateBody,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Quotation).where(Quotation.id == id)
    res = await db.execute(stmt)
    quotation = res.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    target_status = body.status.upper()
    try:
        new_status_enum = QuotationStatus(target_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")

    # Validation guards
    if quotation.status == QuotationStatus.REJECTED and new_status_enum == QuotationStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Cannot transition directly from REJECTED to CONFIRMED")

    quotation.status = new_status_enum
    quotation.last_activity_at = datetime.now(timezone.utc)

    audit = AuditLog(
        quotation_id=quotation.id,
        user_id=user["id"],
        action=AuditAction.UPDATED,
        details=f"Status changed to {target_status}. {body.reason or ''}"
    )
    db.add(audit)
    await db.commit()

    try:
        await sio.emit("quotation-updated", {"id": quotation.id, "status": target_status}, room="dashboard")
    except Exception:
        pass

    return {"message": "Status updated", "status": target_status}


class BatchDecisionBody(BaseModel):
    quotationIds: List[str]
    action: str  # APPROVED, REJECTED
    reason: Optional[str] = None


@router.post("/batch-decision")
async def batch_decision(
    body: BatchDecisionBody,
    user: dict = Depends(require_roles("SALES_MANAGER", "FINANCE", "ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    action = body.action.upper()
    if action not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Action must be APPROVED or REJECTED")

    new_status = QuotationStatus.APPROVED if action == "APPROVED" else QuotationStatus.REJECTED
    audit_action = AuditAction.APPROVED if action == "APPROVED" else AuditAction.REJECTED
    approval_level = 2 if user.get("role") == "FINANCE" else 1

    updated_count = 0
    for q_id in body.quotationIds:
        stmt = select(Quotation).where(Quotation.id == q_id)
        res = await db.execute(stmt)
        q = res.scalar_one_or_none()
        if q:
            q.status = new_status
            q.last_activity_at = datetime.now(timezone.utc)

            approval = Approval(
                quotation_id=q.id,
                approver_id=user["id"],
                level=approval_level,
                action=action,
                reason=body.reason or f"Bulk {action}",
                decided_at=datetime.now(timezone.utc)
            )
            db.add(approval)

            audit = AuditLog(
                quotation_id=q.id,
                user_id=user["id"],
                action=audit_action,
                details=f"Bulk {action} by {user.get('role')}"
            )
            db.add(audit)
            updated_count += 1

    await db.commit()

    try:
        await sio.emit("approval-decision", {"batch": True, "action": action}, room="dashboard")
    except Exception:
        pass

    return {"message": f"Successfully processed {updated_count} quotations", "count": updated_count}


# ---------------------------------------------------------------------------
# PDF Generation  —  GET /api/quotations/{id}/pdf
# ---------------------------------------------------------------------------

@router.get("/{id}/pdf")
async def download_quotation_pdf(
    id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Generates a branded A4 PDF quotation document using ReportLab.
    Streams the PDF directly to the browser as a download.
    """
    import io
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm, cm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph,
        Spacer, HRFlowable, KeepTogether
    )
    from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

    # ── Fetch quotation ────────────────────────────────────────────────────────
    stmt = (
        select(Quotation)
        .options(
            selectinload(Quotation.rep),
            selectinload(Quotation.customer),
            selectinload(Quotation.lines)
                .selectinload(QuotationLine.product)
                    .selectinload(Product.category),
            selectinload(Quotation.approvals).selectinload(Approval.approver),
            selectinload(Quotation.audit_logs),
        )
        .where(Quotation.id == id)
    )
    result = await db.execute(stmt)
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Quotation not found")

    # ── Build PDF in memory ────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    # Colour palette
    C_BRAND     = colors.HexColor("#2563eb")
    C_BRAND_DRK = colors.HexColor("#1d4ed8")
    C_DARK      = colors.HexColor("#0f172a")
    C_MID       = colors.HexColor("#334155")
    C_LITE      = colors.HexColor("#e2e8f0")
    C_MUTED     = colors.HexColor("#64748b")
    C_GREEN     = colors.HexColor("#10b981")
    C_AMBER     = colors.HexColor("#f59e0b")
    C_RED       = colors.HexColor("#ef4444")
    C_WHITE     = colors.white
    C_ROW_ALT   = colors.HexColor("#f8fafc")

    styles = getSampleStyleSheet()

    def P(text, font="Helvetica", size=9, color=C_DARK, align=TA_LEFT, bold=False):
        return Paragraph(
            str(text) if text is not None else "—",
            ParagraphStyle(
                "tmp",
                fontName=f"Helvetica-Bold" if bold else "Helvetica",
                fontSize=size,
                textColor=color,
                alignment=align,
                leading=size * 1.3,
                spaceAfter=0,
            ),
        )

    def fmt_inr(n):
        try:
            val = int(float(n))
            s = f"{val:,}"
            # Indian grouping
            parts = s.split(",")
            if len(parts) > 2:
                last = parts[-1]
                rest = ",".join(parts[:-1])
                s = rest + "," + last
            return f"₹{s}"
        except Exception:
            return f"₹{n}"

    def fmt_date(d):
        if not d:
            return "—"
        try:
            if isinstance(d, str):
                d = datetime.fromisoformat(d)
            return d.strftime("%d %b %Y")
        except Exception:
            return str(d)

    # Status colour
    STATUS_COLORS = {
        "DRAFT": C_MUTED,
        "APPROVED": C_GREEN,
        "CONFIRMED": C_BRAND,
        "REJECTED": C_RED,
        "PENDING_MANAGER": C_AMBER,
        "PENDING_FINANCE": C_AMBER,
        "SENT_TO_CUSTOMER": C_BRAND,
        "UNDER_NEGOTIATION": C_AMBER,
        "CANCELLED": C_RED,
    }
    q_status = q.status.value if hasattr(q.status, "value") else str(q.status)
    status_color = STATUS_COLORS.get(q_status, C_MUTED)
    customer_tier = q.customer_tier.value if hasattr(q.customer_tier, "value") else str(q.customer_tier or "BRONZE")

    story = []

    # ── HEADER ─────────────────────────────────────────────────────────────────
    header_data = [
        [
            P("DealFlow360", size=26, color=C_BRAND, bold=True),
            P("QUOTATION", size=22, color=C_DARK, align=TA_RIGHT, bold=True),
        ],
        [
            P("Intelligent Sales Platform", size=9, color=C_MUTED),
            P(q.quotation_number or f"QT-{q.id[:8].upper()}", size=13, color=C_BRAND, align=TA_RIGHT, bold=True),
        ],
        [
            Spacer(0, 2),
            P(f"● {q_status.replace('_', ' ')}", size=9, color=status_color, align=TA_RIGHT, bold=True),
        ],
    ]
    header_table = Table(header_data, colWidths=["50%", "50%"])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1, color=C_LITE, spaceAfter=8, spaceBefore=8))

    # ── FROM / TO / DATES ──────────────────────────────────────────────────────
    rep = q.rep
    customer = q.customer

    from_lines = [
        P("From:", size=8, color=C_MUTED),
        P(rep.name if rep else "Sales Representative", size=10, bold=True),
        P(rep.email if rep else "", size=8, color=C_MUTED),
        P((rep.role.value if hasattr(rep.role, "value") else str(rep.role)) if rep else "", size=8, color=C_BRAND),
    ]

    to_lines = [
        P("To:", size=8, color=C_MUTED),
        P(customer.company_name or customer.name if customer else "Direct Client", size=10, bold=True),
        P(customer.email if customer else "", size=8, color=C_MUTED),
        P(f"Tier: {customer_tier}", size=8, color=C_BRAND),
    ]

    date_lines = [
        P("Dates:", size=8, color=C_MUTED),
        P(f"Created: {fmt_date(q.created_at)}", size=8),
        P(f"Expiry:  {fmt_date(q.expiry_date)}", size=8),
        P(f"Status:  {q_status.replace('_', ' ')}", size=8, color=status_color, bold=True),
    ]

    addr_table = Table(
        [[from_lines, to_lines, date_lines]],
        colWidths=["34%", "34%", "32%"],
    )
    addr_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(addr_table)
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LITE, spaceAfter=10, spaceBefore=10))

    # ── LINE ITEMS TABLE ───────────────────────────────────────────────────────
    story.append(P("Order Lines", size=11, bold=True, color=C_DARK))
    story.append(Spacer(0, 4))

    line_header = [
        P("Product", size=8, color=C_WHITE, bold=True),
        P("Category", size=8, color=C_WHITE, bold=True, align=TA_CENTER),
        P("Type", size=8, color=C_WHITE, bold=True, align=TA_CENTER),
        P("Qty", size=8, color=C_WHITE, bold=True, align=TA_CENTER),
        P("Unit Price", size=8, color=C_WHITE, bold=True, align=TA_RIGHT),
        P("Disc%", size=8, color=C_WHITE, bold=True, align=TA_CENTER),
        P("Tax%", size=8, color=C_WHITE, bold=True, align=TA_CENTER),
        P("Line Total", size=8, color=C_WHITE, bold=True, align=TA_RIGHT),
        P("Margin", size=8, color=C_WHITE, bold=True, align=TA_CENTER),
    ]

    line_rows = [line_header]
    for i, line in enumerate(q.lines or []):
        prod = line.product
        cat = prod.category if prod else None
        line_type = (line.line_type.value if hasattr(line.line_type, "value") else str(line.line_type or "ONE_TIME"))
        row_bg = C_ROW_ALT if i % 2 == 0 else C_WHITE
        margin_val = float(line.margin or 0)
        margin_color = C_GREEN if margin_val >= 25 else C_AMBER if margin_val >= 15 else C_RED

        line_rows.append([
            P(prod.name if prod else "Product", size=8),
            P(cat.name if cat else "—", size=8, align=TA_CENTER, color=C_MUTED),
            P("Monthly" if "SUBSCRIPTION" in line_type else "One-Time", size=7, align=TA_CENTER, color=C_BRAND),
            P(str(line.quantity), size=8, align=TA_CENTER),
            P(fmt_inr(line.unit_price), size=8, align=TA_RIGHT),
            P(f"{float(line.discount):.1f}%", size=8, align=TA_CENTER,
              color=C_AMBER if float(line.discount or 0) > 15 else C_DARK),
            P(f"{float(line.tax):.0f}%", size=8, align=TA_CENTER, color=C_MUTED),
            P(fmt_inr(line.line_total), size=8, align=TA_RIGHT, bold=True),
            P(f"{margin_val:.1f}%", size=8, align=TA_CENTER, color=margin_color, bold=True),
        ])

    col_widths = ["22%", "12%", "9%", "7%", "12%", "7%", "7%", "13%", "10%"]
    # Convert percentages to points for A4 (usable ~170mm = 481pt)
    page_w = A4[0] - 40 * mm
    col_w_pts = [page_w * float(w.rstrip("%")) / 100 for w in col_widths]

    lt = Table(line_rows, colWidths=col_w_pts, repeatRows=1)
    lt_style = [
        ("BACKGROUND", (0, 0), (-1, 0), C_BRAND),
        ("GRID", (0, 0), (-1, -1), 0.3, C_LITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_ROW_ALT, C_WHITE]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    lt.setStyle(TableStyle(lt_style))
    story.append(lt)
    story.append(Spacer(0, 10))

    # ── TOTALS ─────────────────────────────────────────────────────────────────
    subtotal = float(q.subtotal or 0)
    discount_amt = float(q.discount_amount or 0)
    tax_amt = float(q.tax_amount or 0)
    total = float(q.total or 0)
    margin_pct = float(q.margin or 0)

    totals_data = [
        [P("Subtotal:", size=9, align=TA_RIGHT, color=C_MUTED), P(fmt_inr(subtotal), size=9, align=TA_RIGHT)],
        [P("Total Discount:", size=9, align=TA_RIGHT, color=C_AMBER), P(f"−{fmt_inr(discount_amt)}", size=9, align=TA_RIGHT, color=C_AMBER)],
        [P("Tax (18%):", size=9, align=TA_RIGHT, color=C_MUTED), P(fmt_inr(tax_amt), size=9, align=TA_RIGHT)],
        [P("TOTAL:", size=12, align=TA_RIGHT, bold=True, color=C_WHITE), P(fmt_inr(total), size=12, align=TA_RIGHT, bold=True, color=C_WHITE)],
        [P("Gross Margin:", size=8, align=TA_RIGHT, color=C_MUTED), P(f"{margin_pct:.1f}%", size=9, align=TA_RIGHT, color=C_GREEN if margin_pct >= 25 else C_AMBER if margin_pct >= 15 else C_RED, bold=True)],
    ]
    totals_table = Table(totals_data, colWidths=["60%", "40%"])
    totals_table.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("BACKGROUND", (0, 3), (-1, 3), C_BRAND),
        ("LINEABOVE", (0, 3), (-1, 3), 1, C_BRAND_DRK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    # Right-align totals block
    outer = Table([[Spacer(0, 0), totals_table]], colWidths=["50%", "50%"])
    story.append(outer)
    story.append(Spacer(0, 12))

    # ── REP NOTES ──────────────────────────────────────────────────────────────
    if q.rep_notes:
        story.append(HRFlowable(width="100%", thickness=0.5, color=C_LITE, spaceBefore=4, spaceAfter=6))
        story.append(P("Representative Notes", size=9, bold=True, color=C_DARK))
        story.append(Spacer(0, 3))
        story.append(P(q.rep_notes, size=8, color=C_MUTED))
        story.append(Spacer(0, 8))

    # ── APPROVAL HISTORY ───────────────────────────────────────────────────────
    if q.approvals:
        story.append(HRFlowable(width="100%", thickness=0.5, color=C_LITE, spaceBefore=4, spaceAfter=6))
        story.append(P("Approval Trail", size=10, bold=True, color=C_DARK))
        story.append(Spacer(0, 4))

        ah_header = [
            P("Action", size=8, color=C_WHITE, bold=True),
            P("Approver", size=8, color=C_WHITE, bold=True),
            P("Date", size=8, color=C_WHITE, bold=True),
            P("Notes", size=8, color=C_WHITE, bold=True),
        ]
        ah_rows = [ah_header]
        for a in q.approvals:
            ah_rows.append([
                P(a.action or "PENDING", size=8,
                  color=C_GREEN if a.action == "APPROVED" else C_RED if a.action == "REJECTED" else C_AMBER),
                P(a.approver.name if a.approver else "—", size=8),
                P(fmt_date(a.decided_at) if a.decided_at else "Pending", size=8, color=C_MUTED),
                P(a.reason or "—", size=8, color=C_MUTED),
            ])
        ah_table = Table(ah_rows, colWidths=["18%", "22%", "20%", "40%"])
        ah_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), C_MID),
            ("GRID", (0, 0), (-1, -1), 0.3, C_LITE),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_ROW_ALT, C_WHITE]),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(ah_table)
        story.append(Spacer(0, 10))

    # ── PORTAL LINK ────────────────────────────────────────────────────────────
    if q.portal_token:
        story.append(HRFlowable(width="100%", thickness=0.5, color=C_LITE, spaceBefore=2, spaceAfter=6))
        portal_url = f"http://localhost:3000/portal/{q.portal_token}"
        story.append(P(
            f'Customer Portal: <link href="{portal_url}">{portal_url}</link>',
            size=8, color=C_BRAND
        ))
        story.append(Spacer(0, 4))

    # ── FOOTER ─────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_LITE, spaceBefore=8, spaceAfter=4))
    story.append(P(
        "Generated by DealFlow360 — Intelligent, Self-Governing Sales Operations Platform",
        size=7, color=C_MUTED, align=TA_CENTER
    ))
    story.append(P(
        f"Confidential — {fmt_date(datetime.utcnow())}",
        size=7, color=C_LITE, align=TA_CENTER
    ))

    # ── Build ──────────────────────────────────────────────────────────────────
    doc.build(story)
    buf.seek(0)

    qt_num = (q.quotation_number or f"QT-{q.id[:8]}").replace("/", "-")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="dealflow360-{qt_num}.pdf"',
            "Access-Control-Allow-Origin": "*",
        },
    )


