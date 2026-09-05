from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
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
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Quotation)
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
    elif repId:
        stmt = stmt.where(Quotation.rep_id == repId)

    if status:
        try:
            status_enum = QuotationStatus(status)
            stmt = stmt.where(Quotation.status == status_enum)
        except ValueError:
            pass

    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.outerjoin(Quotation.customer).where(
            or_(
                Quotation.quotation_number.ilike(search_pattern),
                User.name.ilike(search_pattern),
                User.company_name.ilike(search_pattern)
            )
        )

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
            selectinload(Quotation.negotiations)
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
    stmt = select(Quotation).where(Quotation.id == id)
    result = await db.execute(stmt)
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    if quotation.status != QuotationStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved quotations can be sent")

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
    return {
        "message": "Sent to customer",
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

