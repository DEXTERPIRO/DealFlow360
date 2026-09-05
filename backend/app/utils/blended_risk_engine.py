"""app/utils/blended_risk_engine.py — Port of blendedRiskEngine.js."""
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Product, ProductCategory

TIER_MAX_DISCOUNT = {
    "BRONZE": 5,
    "SILVER": 10,
    "GOLD": 15,
}

APPROVAL_THRESHOLDS = {
    "NO_APPROVAL": 0,
    "MANAGER_ONLY": 5,
    "MANAGER_AND_FINANCE": 10,
}


async def compute_blended_risk_score(lines: list[dict], customer_tier: str, db: AsyncSession) -> dict:
    """
    Weighted-average discount overage across all quotation lines.
    Returns blended score, approval routing, and per-line details.
    """
    tier_max = TIER_MAX_DISCOUNT.get(customer_tier, 5)
    total_weighted_overage = 0.0
    total_weight = 0.0
    line_details = []

    for line in lines:
        product_id = line.get("product_id") or line.get("productId")
        result = await db.execute(
            select(Product).where(Product.id == product_id)
        )
        product = result.scalar_one_or_none()
        category_max = float(product.category.max_discount) if product and product.category else tier_max

        effective_max = min(tier_max, category_max)
        discount = float(line.get("discount", 0))
        overage = max(0.0, discount - effective_max)
        weight = int(line.get("quantity", 1)) * float(line.get("unit_price") or line.get("unitPrice", 0))

        total_weighted_overage += overage * weight
        total_weight += weight

        line_details.append({
            "product_id": str(product_id),
            "product_name": product.name if product else "Unknown",
            "discount": discount,
            "max_allowed": effective_max,
            "overage": overage,
            "is_flagged": overage > 0,
        })

    blended_score = (total_weighted_overage / total_weight) if total_weight > 0 else 0.0

    requires_manager = False
    requires_finance = False

    if blended_score > APPROVAL_THRESHOLDS["MANAGER_AND_FINANCE"]:
        requires_manager = True
        requires_finance = True
        approval_required = "MANAGER_AND_FINANCE"
    elif blended_score > APPROVAL_THRESHOLDS["MANAGER_ONLY"]:
        requires_manager = True
        approval_required = "MANAGER_ONLY"
    else:
        approval_required = "NONE"

    # Also check individual lines
    for detail in line_details:
        if detail["overage"] > 0:
            requires_manager = True
            if detail["overage"] > 5:
                requires_finance = True

    return {
        "blended_score": round(blended_score, 2),
        "approval_required": approval_required,
        "requires_manager": requires_manager,
        "requires_finance": requires_finance,
        "line_details": line_details,
    }


def compute_order_totals(lines: list[dict]) -> dict:
    """
    Compute subtotal, discount, tax, total, and margin for a list of quotation lines.
    Mutates each line dict to add line_total and margin.
    """
    subtotal = 0.0
    tax_amount = 0.0
    discount_amount = 0.0
    total_cost = 0.0

    for line in lines:
        qty = int(line.get("quantity", 1))
        unit_price = float(line.get("unit_price") or line.get("unitPrice", 0))
        discount = float(line.get("discount", 0))
        tax = float(line.get("tax", 18))
        cost_price = float(line.get("cost_price") or line.get("costPrice", 0))

        base_line_total = qty * unit_price
        discount_value = base_line_total * (discount / 100)
        after_discount = base_line_total - discount_value
        tax_value = after_discount * (tax / 100)

        subtotal += base_line_total
        discount_amount += discount_value
        tax_amount += tax_value
        total_cost += qty * cost_price

        line["line_total"] = round(after_discount + tax_value, 2)
        line["margin"] = round(
            (after_discount - qty * cost_price) / after_discount * 100, 2
        ) if after_discount > 0 else 0.0

    total = subtotal - discount_amount + tax_amount
    overall_margin = round(
        (subtotal - discount_amount - total_cost) / (subtotal - discount_amount) * 100, 2
    ) if (subtotal - discount_amount) > 0 else 0.0

    return {
        "subtotal": round(subtotal, 2),
        "discount_amount": round(discount_amount, 2),
        "tax_amount": round(tax_amount, 2),
        "total": round(total, 2),
        "margin": overall_margin,
    }
