from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func, or_, cast, String
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token, require_roles
from app.middleware.upload import process_image
from app.models.models import (
    Product, ProductCategory, ProductVariant,
    PriceList, PriceListItem, WarehouseStock,
    UpsellRule, CustomerTier, BillingCycle, DiscountTier
)

router = APIRouter(prefix="/api/products", tags=["products"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class UpsellRequest(BaseModel):
    productIds: List[str]
    customerTier: Optional[str] = "BRONZE"

class CategoryCreate(BaseModel):
    name: str
    maxDiscount: Optional[float] = 15.0
    description: Optional[str] = None

class VariantCreate(BaseModel):
    name: str
    attribute: str
    value: str
    extraPrice: Optional[float] = 0.0

class PriceListCreate(BaseModel):
    name: str
    tier: CustomerTier
    currency: Optional[str] = "INR"


# ---------------------------------------------------------------------------
# Product Categories Endpoints
# ---------------------------------------------------------------------------

@router.get("/categories/all")
async def get_all_categories(
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(ProductCategory, func.count(Product.id).label("product_count"))
        .outerjoin(Product, (Product.category_id == ProductCategory.id) & (Product.is_active == True))
        .group_by(ProductCategory.id)
        .order_by(ProductCategory.name.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    
    categories = []
    for cat, count in rows:
        cat_dict = {
            "id": cat.id,
            "name": cat.name,
            "maxDiscount": cat.max_discount,
            "description": cat.description,
            "createdAt": cat.created_at.isoformat() if cat.created_at else None,
            "_count": {"products": count}
        }
        categories.append(cat_dict)
    return categories


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    if not body.name:
        raise HTTPException(status_code=400, detail="Name required")
    
    existing = await db.execute(select(ProductCategory).where(ProductCategory.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Category name already exists")

    cat = ProductCategory(
        name=body.name,
        max_discount=body.maxDiscount if body.maxDiscount is not None else 15.0,
        description=body.description
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    maxDiscount: Optional[float] = None
    description: Optional[str] = None


@router.put("/categories/{id}")
async def update_category(
    id: str,
    body: CategoryUpdate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ProductCategory).where(ProductCategory.id == id)
    res = await db.execute(stmt)
    cat = res.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if body.name is not None:
        cat.name = body.name
    if body.maxDiscount is not None:
        cat.max_discount = body.maxDiscount
    if body.description is not None:
        cat.description = body.description

    await db.commit()
    await db.refresh(cat)
    return cat


# ---------------------------------------------------------------------------
# Discount Tiers Endpoints
# ---------------------------------------------------------------------------

class DiscountTierUpdate(BaseModel):
    maxDiscount: float
    requiresManager: Optional[bool] = None
    requiresFinance: Optional[bool] = None


@router.get("/discount-tiers")
async def get_discount_tiers(
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DiscountTier).order_by(DiscountTier.tier.asc())
    res = await db.execute(stmt)
    tiers = res.scalars().all()
    
    # If not seeded in DB, return defaults
    if not tiers:
        defaults = [
            {"tier": "BRONZE", "max_discount": 5.0, "requires_manager": False, "requires_finance": False},
            {"tier": "SILVER", "max_discount": 10.0, "requires_manager": True, "requires_finance": False},
            {"tier": "GOLD", "max_discount": 15.0, "requires_manager": True, "requires_finance": True},
        ]
        return defaults
    return tiers


@router.put("/discount-tiers/{tier}")
async def update_discount_tier(
    tier: str,
    body: DiscountTierUpdate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    try:
        tier_enum = CustomerTier(tier.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid customer tier")

    stmt = select(DiscountTier).where(DiscountTier.tier == tier_enum)
    res = await db.execute(stmt)
    dt = res.scalar_one_or_none()
    if not dt:
        dt = DiscountTier(
            tier=tier_enum,
            max_discount=body.maxDiscount,
            requires_manager=body.requiresManager or False,
            requires_finance=body.requiresFinance or False
        )
        db.add(dt)
    else:
        dt.max_discount = body.maxDiscount
        if body.requiresManager is not None:
            dt.requires_manager = body.requiresManager
        if body.requiresFinance is not None:
            dt.requires_finance = body.requiresFinance

    await db.commit()
    await db.refresh(dt)
    return dt


# ---------------------------------------------------------------------------
# Price Lists Endpoints
# ---------------------------------------------------------------------------

@router.get("/pricelists/all")
async def get_all_pricelists(
    search: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(PriceList)
        .options(
            selectinload(PriceList.items).selectinload(PriceListItem.product)
        )
        .order_by(PriceList.created_at.desc())
    )
    if tier and tier.upper() != "ALL":
        try:
            tier_enum = CustomerTier(tier.upper())
            stmt = stmt.where(PriceList.tier == tier_enum)
        except ValueError:
            pass

    if search:
        search_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                PriceList.name.ilike(search_term),
                cast(PriceList.tier, String).ilike(search_term)
            )
        )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/pricelists", status_code=status.HTTP_201_CREATED)
async def create_pricelist(
    body: PriceListCreate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    plist = PriceList(
        name=body.name,
        tier=body.tier,
        currency=body.currency or "INR"
    )
    db.add(plist)
    await db.commit()
    await db.refresh(plist)
    return plist


# ---------------------------------------------------------------------------
# Upsell Rules Management & Suggestions
# ---------------------------------------------------------------------------

class UpsellRuleCreate(BaseModel):
    sourceProductId: str
    targetProductId: str
    score: Optional[int] = 50
    isPromoted: Optional[bool] = False
    minMargin: Optional[float] = 0.0


@router.get("/upsell-rules")
async def get_upsell_rules(
    search: Optional[str] = Query(None),
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(UpsellRule)
        .options(
            selectinload(UpsellRule.source_product).selectinload(Product.category),
            selectinload(UpsellRule.target_product).selectinload(Product.category)
        )
        .order_by(UpsellRule.created_at.desc())
    )
    if search:
        search_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                UpsellRule.source_product.has(
                    or_(Product.name.ilike(search_term), Product.sku.ilike(search_term))
                ),
                UpsellRule.target_product.has(
                    or_(Product.name.ilike(search_term), Product.sku.ilike(search_term))
                )
            )
        )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/upsell-rules", status_code=status.HTTP_201_CREATED)
async def create_upsell_rule(
    body: UpsellRuleCreate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    if body.sourceProductId == body.targetProductId:
        raise HTTPException(status_code=400, detail="Source and Target product cannot be the same")

    stmt = select(UpsellRule).where(
        UpsellRule.source_product_id == body.sourceProductId,
        UpsellRule.target_product_id == body.targetProductId
    )
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Upsell rule between these products already exists")

    rule = UpsellRule(
        source_product_id=body.sourceProductId,
        target_product_id=body.targetProductId,
        score=body.score or 50,
        is_promoted=body.isPromoted or False,
        min_margin=body.minMargin or 0.0
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.put("/upsell-rules/{id}")
async def update_upsell_rule(
    id: str,
    body: UpsellRuleCreate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UpsellRule).where(UpsellRule.id == id)
    res = await db.execute(stmt)
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Upsell rule not found")

    if body.sourceProductId:
        rule.source_product_id = body.sourceProductId
    if body.targetProductId:
        rule.target_product_id = body.targetProductId
    if body.score is not None:
        rule.score = body.score
    if body.isPromoted is not None:
        rule.is_promoted = body.isPromoted
    if body.minMargin is not None:
        rule.min_margin = body.minMargin

    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/upsell-rules/{id}")
async def delete_upsell_rule(
    id: str,
    user: dict = Depends(require_roles("ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UpsellRule).where(UpsellRule.id == id)
    res = await db.execute(stmt)
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Upsell rule not found")

    await db.delete(rule)
    await db.commit()
    return {"message": "Upsell rule deleted"}

@router.post("/upsell-suggestions")
async def get_upsell_suggestions(
    body: UpsellRequest,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    if not body.productIds:
        return []

    stmt = (
        select(UpsellRule)
        .where(
            UpsellRule.source_product_id.in_(body.productIds),
            UpsellRule.target_product_id.not_in(body.productIds)
        )
        .options(
            selectinload(UpsellRule.target_product).selectinload(Product.category)
        )
        .order_by(UpsellRule.is_promoted.desc(), UpsellRule.score.desc())
        .limit(5)
    )
    result = await db.execute(stmt)
    rules = result.scalars().all()

    suggestions = []
    seen_target_ids = set()

    for r in rules:
        target = r.target_product
        if not target or not target.is_active or target.id in seen_target_ids:
            continue
        seen_target_ids.add(target.id)

        base_p = float(target.base_price) if target.base_price else 0.0
        cost_p = float(target.cost_price) if target.cost_price else 0.0
        margin_delta = round(((base_p - cost_p) / base_p * 100), 1) if base_p > 0 else 0.0

        suggestions.append({
            "id": target.id,
            "name": target.name,
            "sku": target.sku,
            "description": target.description,
            "categoryId": target.category_id,
            "category": target.category,
            "basePrice": target.base_price,
            "costPrice": target.cost_price,
            "tax": target.tax,
            "unit": target.unit,
            "imageUrl": target.image_url,
            "isActive": target.is_active,
            "isSubscription": target.is_subscription,
            "billingCycle": target.billing_cycle,
            "score": r.score,
            "isPromoted": r.is_promoted,
            "marginDelta": margin_delta
        })

    return suggestions


# ---------------------------------------------------------------------------
# Product CRUD Endpoints
# ---------------------------------------------------------------------------

@router.get("")
@router.get("/")
async def get_products(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    isSubscription: Optional[str] = Query(None),
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Product)
        .where(Product.is_active == True)
        .options(
            selectinload(Product.category),
            selectinload(Product.variants),
            selectinload(Product.warehouse_stocks).selectinload(WarehouseStock.warehouse)
        )
        .order_by(Product.name.asc())
    )

    if category and category != "ALL":
        stmt = stmt.where(Product.category_id == category)
    if isSubscription is not None and isSubscription != "ALL":
        stmt = stmt.where(Product.is_subscription == (isSubscription.lower() == "true"))
    if search and search.strip():
        pat = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(pat),
                Product.sku.ilike(pat),
                Product.description.ilike(pat)
            )
        )

    result = await db.execute(stmt)
    products = result.scalars().all()
    return products


@router.get("/{id}")
async def get_product(
    id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Product)
        .where(Product.id == id)
        .options(
            selectinload(Product.category),
            selectinload(Product.variants),
            selectinload(Product.warehouse_stocks).selectinload(WarehouseStock.warehouse),
            selectinload(Product.upsell_rules).selectinload(UpsellRule.target_product).selectinload(Product.category)
        )
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_product(
    name: str = Form(...),
    sku: str = Form(...),
    categoryId: str = Form(...),
    basePrice: str = Form(...),
    description: Optional[str] = Form(None),
    costPrice: Optional[str] = Form("0"),
    tax: Optional[str] = Form("18"),
    unit: Optional[str] = Form("piece"),
    isSubscription: Optional[str] = Form("false"),
    billingCycle: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    if not name or not sku or not categoryId or not basePrice:
        raise HTTPException(status_code=400, detail="Name, SKU, category and price required")

    existing_sku = await db.execute(select(Product).where(Product.sku == sku))
    if existing_sku.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="SKU already exists")

    image_url = await process_image(image) if image else None

    is_sub = str(isSubscription).lower() == "true"
    parsed_billing_cycle = None
    if is_sub and billingCycle:
        try:
            parsed_billing_cycle = BillingCycle(billingCycle)
        except ValueError:
            parsed_billing_cycle = None

    product = Product(
        name=name,
        sku=sku,
        description=description,
        category_id=categoryId,
        base_price=Decimal(basePrice),
        cost_price=Decimal(costPrice or "0"),
        tax=Decimal(tax or "18"),
        unit=unit or "piece",
        image_url=image_url,
        is_subscription=is_sub,
        billing_cycle=parsed_billing_cycle
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)

    # Reload with category eager loaded
    stmt = select(Product).where(Product.id == product.id).options(selectinload(Product.category))
    res = await db.execute(stmt)
    return res.scalar_one()


@router.put("/{id}")
async def update_product(
    id: str,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    basePrice: Optional[str] = Form(None),
    costPrice: Optional[str] = Form(None),
    tax: Optional[str] = Form(None),
    unit: Optional[str] = Form(None),
    isSubscription: Optional[str] = Form(None),
    billingCycle: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Product).where(Product.id == id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if name is not None:
        product.name = name
    if description is not None:
        product.description = description
    if basePrice is not None:
        product.base_price = Decimal(basePrice)
    if costPrice is not None:
        product.cost_price = Decimal(costPrice)
    if tax is not None:
        product.tax = Decimal(tax)
    if unit is not None:
        product.unit = unit
    if isSubscription is not None:
        product.is_subscription = str(isSubscription).lower() == "true"
    if billingCycle is not None:
        try:
            product.billing_cycle = BillingCycle(billingCycle)
        except ValueError:
            product.billing_cycle = None

    if image:
        new_image_url = await process_image(image)
        if new_image_url:
            product.image_url = new_image_url

    await db.commit()
    await db.refresh(product)

    stmt_reload = select(Product).where(Product.id == id).options(selectinload(Product.category))
    res = await db.execute(stmt_reload)
    return res.scalar_one()


@router.delete("/{id}")
async def delete_product(
    id: str,
    user: dict = Depends(require_roles("ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Product).where(Product.id == id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_active = False
    await db.commit()
    return {"message": "Product deactivated"}


# ---------------------------------------------------------------------------
# Product Variants Endpoint
# ---------------------------------------------------------------------------

@router.post("/{id}/variants", status_code=status.HTTP_201_CREATED)
async def create_variant(
    id: str,
    body: VariantCreate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Product).where(Product.id == id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    variant = ProductVariant(
        product_id=id,
        name=body.name,
        attribute=body.attribute,
        value=body.value,
        extra_price=Decimal(str(body.extraPrice or 0.0))
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return variant
