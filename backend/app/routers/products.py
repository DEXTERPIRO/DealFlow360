"""app/routers/products.py — Products, categories, variants, pricelists (FastAPI)."""
import os
import uuid as _uuid
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token, require_roles
from app.models.models import (
    Product, ProductCategory, ProductVariant,
    PriceList, PriceListItem, UpsellRule,
)

router = APIRouter(prefix="/api/products", tags=["products"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../uploads/products")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Helper: process and save uploaded image ───────────────────────────────────

async def _save_image(file: UploadFile) -> str | None:
    if not file:
        return None
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG and WebP images allowed")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    img = Image.open(BytesIO(contents))
    img.thumbnail((800, 600), Image.LANCZOS)

    filename = f"{_uuid.uuid4()}.webp"
    filepath = os.path.join(UPLOAD_DIR, filename)
    img.save(filepath, "WEBP", quality=85)
    return f"/uploads/products/{filename}"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/categories/all")
async def get_categories(user=Depends(verify_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProductCategory).order_by(ProductCategory.name))
    cats = result.scalars().all()
    return [{"id": str(c.id), "name": c.name, "description": c.description,
             "maxDiscount": float(c.max_discount)} for c in cats]


@router.post("/categories", status_code=201)
async def create_category(
    name: str = Form(...), max_discount: float = Form(15), description: str = Form(None),
    user=Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db),
):
    cat = ProductCategory(name=name, max_discount=max_discount, description=description)
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return {"id": str(cat.id), "name": cat.name}


@router.get("/pricelists/all")
async def get_pricelists(user=Depends(verify_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PriceList).options(
            selectinload(PriceList.items).selectinload(PriceListItem.product)
        )
    )
    lists = result.scalars().all()
    return lists


@router.post("/pricelists", status_code=201)
async def create_pricelist(
    name: str = Form(...), tier: str = Form(None), currency: str = Form("INR"),
    user=Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db),
):
    pl = PriceList(name=name, tier=tier, currency=currency)
    db.add(pl)
    await db.flush()
    await db.refresh(pl)
    return {"id": str(pl.id), "name": pl.name, "tier": pl.tier}


@router.post("/upsell-suggestions")
async def upsell_suggestions(
    body: dict, user=Depends(verify_token), db: AsyncSession = Depends(get_db)
):
    product_ids = body.get("productIds", [])
    if not product_ids:
        return []

    result = await db.execute(
        select(UpsellRule)
        .where(
            UpsellRule.source_product_id.in_(product_ids),
            UpsellRule.target_product_id.notin_(product_ids),
        )
        .options(
            selectinload(UpsellRule.target_product).selectinload(Product.category)
        )
        .order_by(UpsellRule.is_promoted.desc(), UpsellRule.score.desc())
        .limit(5)
    )
    rules = result.scalars().all()

    suggestions = []
    for r in rules:
        p = r.target_product
        base = float(p.base_price)
        cost = float(p.cost_price)
        margin = round((base - cost) / base * 100, 1) if base > 0 else 0
        suggestions.append({
            "id": str(p.id), "name": p.name, "sku": p.sku,
            "basePrice": base, "score": r.score,
            "isPromoted": r.is_promoted, "marginDelta": margin,
            "category": {"name": p.category.name} if p.category else None,
        })
    return suggestions


@router.get("/")
async def get_products(
    category: str = Query(None),
    search: str = Query(None),
    is_subscription: bool = Query(None),
    user=Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.variants),
            selectinload(Product.warehouse_stocks),
        )
        .where(Product.is_active == True)
        .order_by(Product.name)
    )
    if category:
        stmt = stmt.where(Product.category_id == category)
    if is_subscription is not None:
        stmt = stmt.where(Product.is_subscription == is_subscription)
    if search:
        stmt = stmt.where(Product.name.ilike(f"%{search}%"))

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{product_id}")
async def get_product(product_id: str, user=Depends(verify_token), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.variants),
            selectinload(Product.warehouse_stocks),
            selectinload(Product.upsell_rules).selectinload(UpsellRule.target_product).selectinload(Product.category),
        )
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", status_code=201)
async def create_product(
    name: str = Form(...), sku: str = Form(...),
    category_id: str = Form(...), base_price: float = Form(...),
    cost_price: float = Form(0), tax: float = Form(18),
    unit: str = Form("piece"), description: str = Form(None),
    is_subscription: bool = Form(False), billing_cycle: str = Form(None),
    image: UploadFile = File(None),
    user=Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Product).where(Product.sku == sku))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="SKU already exists")

    image_url = await _save_image(image) if image and image.filename else None

    product = Product(
        name=name, sku=sku, category_id=category_id,
        base_price=base_price, cost_price=cost_price,
        tax=tax, unit=unit, description=description,
        image_url=image_url, is_subscription=is_subscription,
        billing_cycle=billing_cycle if is_subscription else None,
    )
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return product


@router.put("/{product_id}")
async def update_product(
    product_id: str,
    name: str = Form(None), description: str = Form(None),
    base_price: float = Form(None), cost_price: float = Form(None),
    tax: float = Form(None), unit: str = Form(None),
    is_subscription: bool = Form(None),
    image: UploadFile = File(None),
    user=Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if name is not None: product.name = name
    if description is not None: product.description = description
    if base_price is not None: product.base_price = base_price
    if cost_price is not None: product.cost_price = cost_price
    if tax is not None: product.tax = tax
    if unit is not None: product.unit = unit
    if is_subscription is not None: product.is_subscription = is_subscription
    if image and image.filename:
        product.image_url = await _save_image(image)

    await db.flush()
    await db.refresh(product)
    return product


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    user=Depends(require_roles("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    return {"message": "Product deactivated"}


@router.post("/{product_id}/variants", status_code=201)
async def add_variant(
    product_id: str,
    name: str = Form(...), attribute: str = Form(...),
    value: str = Form(...), extra_price: float = Form(0),
    user=Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db),
):
    variant = ProductVariant(
        product_id=product_id, name=name,
        attribute=attribute, value=value, extra_price=extra_price,
    )
    db.add(variant)
    await db.flush()
    await db.refresh(variant)
    return variant
