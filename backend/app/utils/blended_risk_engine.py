from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Product

TIER_MAX_DISCOUNT = {"BRONZE": 5, "SILVER": 10, "GOLD": 15}
APPROVAL_THRESHOLDS = {"NO_APPROVAL": 0, "MANAGER_ONLY": 5, "MANAGER_AND_FINANCE": 10}

async def compute_blended_risk_score(db: AsyncSession, lines: list[dict], customer_tier: str) -> dict:
    tier_max = TIER_MAX_DISCOUNT.get(customer_tier, 5)
    total_weighted_overage = 0.0
    total_weight = 0.0
    line_details = []

    for line in lines:
        prod_id = line.get("productId") or line.get("product_id")
        result = await db.execute(
            select(Product).options(selectinload(Product.category)).where(Product.id == prod_id)
        )
        product = result.scalar_one_or_none()
        category_max = product.category.max_discount if product and product.category else tier_max
        effective_max = min(tier_max, category_max)
        discount = float(line.get("discount", 0) or 0)
        overage = max(0.0, discount - effective_max)
        unit_price = float(line.get("unitPrice") or line.get("unit_price") or 0)
        quantity = int(line.get("quantity", 0) or 0)
        weight = quantity * unit_price

        total_weighted_overage += overage * weight
        total_weight += weight

        line_details.append({
            "productId": prod_id,
            "productName": product.name if product else None,
            "discount": discount,
            "maxAllowed": effective_max,
            "overage": overage,
            "isFlagged": overage > 0,
        })

    blended_score = (total_weighted_overage / total_weight) if total_weight > 0 else 0.0

    approval_required = "NONE"
    requires_manager = False
    requires_finance = False

    if blended_score > APPROVAL_THRESHOLDS["MANAGER_AND_FINANCE"]:
        approval_required = "MANAGER_AND_FINANCE"
        requires_manager = True
        requires_finance = True
    elif blended_score > APPROVAL_THRESHOLDS["MANAGER_ONLY"]:
        approval_required = "MANAGER_ONLY"
        requires_manager = True

    for detail in line_details:
        if detail["overage"] > 0:
            requires_manager = True
            if detail["overage"] > 5:
                requires_finance = True

    return {
        "blendedScore": round(blended_score, 2),
        "approvalRequired": approval_required,
        "requiresManager": requires_manager,
        "requiresFinance": requires_finance,
        "lineDetails": line_details,
    }


def compute_order_totals(lines: list[dict]) -> dict:
    subtotal = 0.0
    tax_amount = 0.0
    discount_amount = 0.0
    total_cost = 0.0

    for line in lines:
        unit_price = float(line.get("unitPrice") or line.get("unit_price") or 0)
        quantity = int(line.get("quantity", 0) or 0)
        discount_rate = float(line.get("discount", 0) or 0)
        tax_rate = float(line.get("tax", 18) or 18)
        cost_price = float(line.get("costPrice") or line.get("cost_price") or 0)

        base_line_total = quantity * unit_price
        discount_value = base_line_total * (discount_rate / 100)
        after_discount = base_line_total - discount_value
        tax_value = after_discount * (tax_rate / 100)

        subtotal += base_line_total
        discount_amount += discount_value
        tax_amount += tax_value
        total_cost += quantity * cost_price

        line_total = after_discount + tax_value
        line_margin = (
            ((after_discount - (quantity * cost_price)) / after_discount * 100)
            if after_discount > 0 else 0.0
        )

        line["lineTotal"] = round(line_total, 2)
        line["line_total"] = round(line_total, 2)
        line["margin"] = round(line_margin, 2)

    total = subtotal - discount_amount + tax_amount
    overall_margin = (
        ((subtotal - discount_amount - total_cost) / (subtotal - discount_amount) * 100)
        if (subtotal - discount_amount) > 0 else 0.0
    )

    return {
        "subtotal": round(subtotal, 2),
        "discountAmount": round(discount_amount, 2),
        "taxAmount": round(tax_amount, 2),
        "total": round(total, 2),
        "margin": round(overall_margin, 2),
    }
