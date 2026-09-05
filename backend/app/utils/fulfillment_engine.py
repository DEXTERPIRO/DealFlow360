"""app/utils/fulfillment_engine.py — Warehouse stock allocation and reservation engine."""
from typing import List, Dict, Any
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Warehouse, WarehouseStock, FulfillmentLine, FulfillmentStatus,
    Quotation, LineType
)


async def compute_warehouse_split(db: AsyncSession, lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Computes warehouse stock split for one-time order lines.
    - Skips SUBSCRIPTION lines.
    - Queries WarehouseStock with available quantity > 0, ordered by warehouse shipping cost ascending.
    - Allocates greedily from cheapest-shipping warehouse first.
    - Any uncovered quantity becomes a BACKORDER entry with warehouse_id=None.
    """
    splits = []

    for line in lines:
        line_type = line.get("lineType") or line.get("line_type") or "ONE_TIME"
        if line_type == "SUBSCRIPTION" or line_type == LineType.SUBSCRIPTION:
            continue

        product_id = line.get("productId") or line.get("product_id")
        needed = int(line.get("quantity", 0) or 0)
        remaining = needed

        # Query warehouse stocks where available quantity (quantity - reserved) > 0
        stmt = (
            select(WarehouseStock)
            .join(Warehouse, WarehouseStock.warehouse_id == Warehouse.id)
            .where(
                WarehouseStock.product_id == product_id,
                Warehouse.is_active == True,
                WarehouseStock.quantity > WarehouseStock.reserved
            )
            .options(selectinload(WarehouseStock.warehouse))
            .order_by(Warehouse.shipping_cost.asc())
        )
        res = await db.execute(stmt)
        stocks = res.scalars().all()

        for stock in stocks:
            if remaining <= 0:
                break
            available = stock.quantity - stock.reserved
            if available <= 0:
                continue

            allocate_qty = min(remaining, available)
            splits.append({
                "productId": product_id,
                "warehouseId": stock.warehouse_id,
                "warehouseName": stock.warehouse.name if stock.warehouse else "Warehouse",
                "quantity": allocate_qty,
                "shippingCost": float(stock.warehouse.shipping_cost or 0.0) if stock.warehouse else 0.0,
                "isBackorder": False,
                "status": "PENDING"
            })
            remaining -= allocate_qty

        # Whatever cannot be fulfilled from warehouse stock becomes BACKORDER
        if remaining > 0:
            splits.append({
                "productId": product_id,
                "warehouseId": None,
                "warehouseName": "Backorder (No Stock Available)",
                "quantity": remaining,
                "shippingCost": 0.0,
                "isBackorder": True,
                "status": "BACKORDERED"
            })

    return splits


async def reserve_stock(db: AsyncSession, lines: List[Dict[str, Any]], quotation_id: str) -> List[Dict[str, Any]]:
    """
    Reserves stock for the accepted split:
    - Deletes any existing FulfillmentLine rows for this quotation.
    - Computes warehouse split.
    - Creates new FulfillmentLine rows.
    - Increments WarehouseStock.reserved for allocated non-backorder quantities.
    """
    # Delete existing fulfillment lines
    stmt_del = delete(FulfillmentLine).where(FulfillmentLine.quotation_id == quotation_id)
    await db.execute(stmt_del)
    await db.flush()

    splits = await compute_warehouse_split(db, lines)

    for item in splits:
        is_backorder = item.get("isBackorder", False)
        status_enum = FulfillmentStatus.BACKORDERED if is_backorder else FulfillmentStatus.PENDING

        f_line = FulfillmentLine(
            quotation_id=quotation_id,
            warehouse_id=item.get("warehouseId"),
            product_id=item["productId"],
            quantity_needed=item["quantity"],
            quantity_fulfilled=0,
            status=status_enum,
            is_backorder=is_backorder
        )
        db.add(f_line)

        # Increment reserved quantity on WarehouseStock if not backorder
        if not is_backorder and item.get("warehouseId"):
            stock_stmt = select(WarehouseStock).where(
                WarehouseStock.warehouse_id == item["warehouseId"],
                WarehouseStock.product_id == item["productId"]
            )
            stock_res = await db.execute(stock_stmt)
            stock_row = stock_res.scalar_one_or_none()
            if stock_row:
                stock_row.reserved = (stock_row.reserved or 0) + item["quantity"]

    await db.commit()
    return splits
