"""app/routers/fulfillment.py — Multi-warehouse inventory split and stock reservation."""
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token, require_roles
from app.models.models import (
    Warehouse, WarehouseStock, Quotation, QuotationLine, Product,
    AuditLog, AuditAction
)
from app.utils.fulfillment_engine import compute_warehouse_split, reserve_stock

router = APIRouter(prefix="/api/fulfillment", tags=["fulfillment"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class WarehouseCreate(BaseModel):
    name: str
    location: Optional[str] = None
    shippingCost: Optional[float] = 0.0


class StockUpdate(BaseModel):
    quantity: int
    reserved: Optional[int] = 0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/warehouses/stock")
async def get_warehouses_stock(
    search: Optional[str] = Query(None),
    warehouse_id: Optional[str] = Query(None),
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """List all active warehouses with nested stock, products, and categories."""
    stmt = (
        select(Warehouse)
        .where(Warehouse.is_active == True)
        .options(
            selectinload(Warehouse.stocks)
            .selectinload(WarehouseStock.product)
            .selectinload(Product.category)
        )
        .order_by(Warehouse.name.asc())
    )
    if warehouse_id and warehouse_id != "ALL":
        stmt = stmt.where(Warehouse.id == warehouse_id)
    if search:
        search_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Warehouse.name.ilike(search_term),
                Warehouse.location.ilike(search_term),
                Warehouse.stocks.any(
                    WarehouseStock.product.has(
                        or_(
                            Product.name.ilike(search_term),
                            Product.sku.ilike(search_term)
                        )
                    )
                )
            )
        )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/warehouses", status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    body: WarehouseCreate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new warehouse (restricted to ADMIN or SALES_MANAGER)."""
    wh = Warehouse(
        name=body.name,
        location=body.location,
        shipping_cost=Decimal(str(body.shippingCost or 0.0))
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return wh


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    shippingCost: Optional[float] = None
    isActive: Optional[bool] = None


@router.put("/warehouses/{id}")
async def update_warehouse(
    id: str,
    body: WarehouseUpdate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    """Update warehouse details or status."""
    stmt = select(Warehouse).where(Warehouse.id == id)
    res = await db.execute(stmt)
    wh = res.scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    if body.name is not None:
        wh.name = body.name
    if body.location is not None:
        wh.location = body.location
    if body.shippingCost is not None:
        wh.shipping_cost = Decimal(str(body.shippingCost))
    if body.isActive is not None:
        wh.is_active = body.isActive

    await db.commit()
    await db.refresh(wh)
    return wh


@router.put("/warehouses/{warehouse_id}/stock/{product_id}")
async def upsert_warehouse_stock(
    warehouse_id: str,
    product_id: str,
    body: StockUpdate,
    user: dict = Depends(require_roles("ADMIN", "SALES_MANAGER")),
    db: AsyncSession = Depends(get_db)
):
    """Upsert warehouse stock level for a product."""
    stmt = select(WarehouseStock).where(
        WarehouseStock.warehouse_id == warehouse_id,
        WarehouseStock.product_id == product_id
    )
    res = await db.execute(stmt)
    stock = res.scalar_one_or_none()

    if stock:
        stock.quantity = body.quantity
        if body.reserved is not None:
            stock.reserved = body.reserved
    else:
        stock = WarehouseStock(
            warehouse_id=warehouse_id,
            product_id=product_id,
            quantity=body.quantity,
            reserved=body.reserved or 0
        )
        db.add(stock)

    await db.commit()
    await db.refresh(stock)
    return stock


@router.get("/{quotation_id}/split")
async def get_quotation_split(
    quotation_id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Calculate warehouse stock split without DB writes."""
    stmt = select(Quotation).where(Quotation.id == quotation_id).options(selectinload(Quotation.lines))
    res = await db.execute(stmt)
    quotation = res.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    lines_dict = [
        {
            "productId": line.product_id,
            "quantity": line.quantity,
            "lineType": line.line_type.value if hasattr(line.line_type, "value") else str(line.line_type)
        }
        for line in quotation.lines
    ]

    splits = await compute_warehouse_split(db, lines_dict)
    return splits


@router.post("/{quotation_id}/accept-split")
async def accept_quotation_split(
    quotation_id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Reserve stock based on calculated split and write FULFILLED audit log."""
    stmt = select(Quotation).where(Quotation.id == quotation_id).options(selectinload(Quotation.lines))
    res = await db.execute(stmt)
    quotation = res.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    lines_dict = [
        {
            "productId": line.product_id,
            "quantity": line.quantity,
            "lineType": line.line_type.value if hasattr(line.line_type, "value") else str(line.line_type)
        }
        for line in quotation.lines
    ]

    reserved_splits = await reserve_stock(db, lines_dict, quotation_id)

    # Write AuditLog
    audit = AuditLog(
        quotation_id=quotation_id,
        user_id=user["id"],
        action=AuditAction.FULFILLED,
        details="Warehouse stock split accepted and inventory reserved",
        metadata_json={"splits": reserved_splits}
    )
    db.add(audit)
    await db.commit()

    return {
        "message": "Fulfillment split reserved successfully",
        "splits": reserved_splits
    }
