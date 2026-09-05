const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireRoles } = require('../middleware/auth');
const prisma = new PrismaClient();

// GET all warehouses with stocks
router.get('/warehouses/stock', verifyToken, async (req, res) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true },
      include: {
        stocks: {
          include: {
            product: {
              include: { category: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(warehouses);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch warehouse stocks' });
  }
});

// POST create warehouse
router.post('/warehouses', verifyToken, requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { name, location, shippingCost } = req.body;
    if (!name) return res.status(400).json({ error: 'Warehouse name is required' });

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        location: location || null,
        shippingCost: parseFloat(shippingCost) || 0,
        isActive: true
      }
    });
    res.status(201).json(warehouse);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
});

// PUT update warehouse
router.put('/warehouses/:id', verifyToken, requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { name, location, shippingCost, isActive } = req.body;
    const warehouse = await prisma.warehouse.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name : undefined,
        location: location !== undefined ? location : undefined,
        shippingCost: shippingCost !== undefined ? parseFloat(shippingCost) : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      }
    });
    res.json(warehouse);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
});

// PUT update stock for product in warehouse
router.put('/warehouses/:wId/stock/:pId', verifyToken, requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { quantity, reserved } = req.body;
    const stock = await prisma.warehouseStock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: req.params.wId,
          productId: req.params.pId
        }
      },
      update: {
        quantity: quantity !== undefined ? parseInt(quantity) : undefined,
        reserved: reserved !== undefined ? parseInt(reserved) : undefined
      },
      create: {
        warehouseId: req.params.wId,
        productId: req.params.pId,
        quantity: parseInt(quantity) || 0,
        reserved: parseInt(reserved) || 0
      }
    });
    res.json(stock);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// GET /api/fulfillment/:id/split — Smart Warehouse Split calculation
router.get('/:id/split', verifyToken, async (req, res) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        rep: { select: { id: true, name: true, email: true } },
        lines: {
          where: { lineType: 'ONE_TIME' },
          include: { product: true }
        }
      }
    });

    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    // Fetch active warehouses sorted by lowest shipping cost
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true },
      include: { stocks: true },
      orderBy: { shippingCost: 'asc' }
    });

    const split = [];
    const usedWarehouseIds = new Set();
    let hasBackorders = false;

    for (const line of quotation.lines) {
      let needed = line.quantity;

      for (const wh of warehouses) {
        if (needed <= 0) break;

        const stock = wh.stocks.find(s => s.productId === line.productId);
        const available = stock ? Math.max(0, stock.quantity - stock.reserved) : 0;

        if (available > 0) {
          const allocate = Math.min(needed, available);
          needed -= allocate;
          usedWarehouseIds.add(wh.id);

          split.push({
            warehouseId: wh.id,
            warehouseName: wh.name,
            productId: line.productId,
            productName: line.product.name,
            sku: line.product.sku,
            quantity: allocate,
            shippingCost: Number(wh.shippingCost),
            status: 'ALLOCATED',
            isMain: wh === warehouses[0]
          });
        }
      }

      // If still remaining, mark backorder
      if (needed > 0) {
        hasBackorders = true;
        split.push({
          warehouseId: null,
          warehouseName: 'Backorder',
          productId: line.productId,
          productName: line.product.name,
          sku: line.product.sku,
          quantity: needed,
          shippingCost: 0,
          status: 'BACKORDER',
          isMain: false
        });
      }
    }

    // Shipping cost calculation: sum of shipping costs for all unique shipping locations used
    let estimatedShippingCost = 0;
    for (const whId of usedWarehouseIds) {
      const wh = warehouses.find(w => w.id === whId);
      if (wh) estimatedShippingCost += Number(wh.shippingCost);
    }

    res.json({
      quotation: {
        id: quotation.id,
        quotationNumber: quotation.quotationNumber,
        customerName: quotation.customer?.name || quotation.customer?.companyName || 'Customer',
        repName: quotation.rep?.name || 'Sales Rep',
        total: Number(quotation.total)
      },
      lines: quotation.lines,
      split,
      totalShipments: usedWarehouseIds.size,
      estimatedShippingCost,
      hasBackorders
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to compute split' });
  }
});

// POST /api/fulfillment/:id/accept-split — Accept & record fulfillment lines
router.post('/:id/accept-split', verifyToken, requireRoles('SALES_MANAGER', 'ADMIN', 'FINANCE'), async (req, res) => {
  try {
    const { split } = req.body;
    const quotationId = req.params.id;

    // Delete any existing fulfillment lines for this quotation
    await prisma.fulfillmentLine.deleteMany({ where: { quotationId } });

    // If split provided in body, use it; otherwise compute it
    let itemsToFulfill = split;
    if (!itemsToFulfill || !itemsToFulfill.length) {
      const splitRes = await prisma.quotation.findUnique({
        where: { id: quotationId },
        include: {
          lines: { where: { lineType: 'ONE_TIME' } }
        }
      });
      const warehouses = await prisma.warehouse.findMany({
        where: { isActive: true },
        include: { stocks: true },
        orderBy: { shippingCost: 'asc' }
      });
      itemsToFulfill = [];
      for (const line of (splitRes?.lines || [])) {
        let rem = line.quantity;
        for (const wh of warehouses) {
          if (rem <= 0) break;
          const s = wh.stocks.find(st => st.productId === line.productId);
          const avail = s ? Math.max(0, s.quantity - s.reserved) : 0;
          if (avail > 0) {
            const take = Math.min(rem, avail);
            rem -= take;
            itemsToFulfill.push({
              warehouseId: wh.id,
              productId: line.productId,
              quantity: take,
              isBackorder: false
            });
          }
        }
        if (rem > 0 && warehouses[0]) {
          itemsToFulfill.push({
            warehouseId: warehouses[0].id,
            productId: line.productId,
            quantity: rem,
            isBackorder: true
          });
        }
      }
    }

    for (const item of itemsToFulfill) {
      if (item.warehouseId) {
        await prisma.fulfillmentLine.create({
          data: {
            quotationId,
            warehouseId: item.warehouseId,
            productId: item.productId,
            quantityNeeded: item.quantity,
            quantityFulfilled: item.isBackorder ? 0 : item.quantity,
            status: item.isBackorder ? 'BACKORDERED' : 'FULFILLED',
            isBackorder: Boolean(item.isBackorder)
          }
        });

        // Reserve or deduct stock if not backorder
        if (!item.isBackorder) {
          await prisma.warehouseStock.updateMany({
            where: { warehouseId: item.warehouseId, productId: item.productId },
            data: {
              quantity: { decrement: item.quantity }
            }
          });
        }
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        quotationId,
        userId: req.user.id,
        action: 'FULFILLED',
        details: `Warehouse fulfillment plan confirmed across ${itemsToFulfill.length} items`
      }
    });

    res.json({ success: true, message: 'Fulfillment order created successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to accept fulfillment split' });
  }
});

module.exports = router;
