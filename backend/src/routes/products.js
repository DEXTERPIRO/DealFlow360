const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { upload, processImage } = require('../middleware/upload');
const path = require('path');
const prisma = new PrismaClient();

// GET all products with category and stock
router.get('/', verifyToken, async (req, res) => {
  try {
    const { category, search, isSubscription } = req.query;
    const where = { isActive: true };
    if (category) where.categoryId = category;
    if (isSubscription !== undefined) where.isSubscription = isSubscription === 'true';
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: true,
        warehouseStocks: { include: { warehouse: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(products);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// GET upsell suggestions for given product IDs
router.post('/upsell-suggestions', verifyToken, async (req, res) => {
  try {
    const { productIds, customerTier } = req.body;
    if (!productIds?.length) return res.json([]);

    const rules = await prisma.upsellRule.findMany({
      where: {
        sourceProductId: { in: productIds },
        targetProductId: { notIn: productIds },
        targetProduct: { isActive: true }
      },
      include: {
        targetProduct: { include: { category: true } }
      },
      orderBy: [{ isPromoted: 'desc' }, { score: 'desc' }],
      take: 5
    });

    const suggestions = rules.map(r => ({
      ...r.targetProduct,
      score: r.score,
      isPromoted: r.isPromoted,
      marginDelta: Number(r.targetProduct.basePrice) > 0
        ? ((Number(r.targetProduct.basePrice) - Number(r.targetProduct.costPrice))
           / Number(r.targetProduct.basePrice) * 100).toFixed(1)
        : 0
    }));

    res.json(suggestions);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// POST create product with image
router.post('/', verifyToken,
  requireRoles('ADMIN', 'SALES_MANAGER'),
  upload.single('image'),
  processImage,
  async (req, res) => {
  try {
    const {
      name, sku, description, categoryId, basePrice,
      costPrice, tax, unit, isSubscription, billingCycle
    } = req.body;

    if (!name || !sku || !categoryId || !basePrice)
      return res.status(400).json({ error: 'Name, SKU, category and price required' });

    const existingSku = await prisma.product.findUnique({ where: { sku } });
    if (existingSku) return res.status(409).json({ error: 'SKU already exists' });

    const product = await prisma.product.create({
      data: {
        name, sku, description, categoryId,
        basePrice: parseFloat(basePrice),
        costPrice: parseFloat(costPrice) || 0,
        tax: parseFloat(tax) || 18,
        unit: unit || 'piece',
        imageUrl: req.file?.savedPath || null,
        isSubscription: isSubscription === 'true',
        billingCycle: isSubscription === 'true' ? billingCycle : null,
      },
      include: { category: true }
    });
    res.status(201).json(product);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Product categories CRUD
router.get('/categories/all', verifyToken, async (req, res) => {
  try {
    const cats = await prisma.productCategory.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(cats);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

router.post('/categories', verifyToken,
  requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { name, maxDiscount, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const cat = await prisma.productCategory.create({
      data: { name, maxDiscount: parseFloat(maxDiscount) || 15, description }
    });
    res.status(201).json(cat);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

router.put('/categories/:id', verifyToken,
  requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { name, maxDiscount, description } = req.body;
    const cat = await prisma.productCategory.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name : undefined,
        maxDiscount: maxDiscount !== undefined ? parseFloat(maxDiscount) : undefined,
        description: description !== undefined ? description : undefined
      }
    });
    res.json(cat);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// Price list management
router.get('/pricelists/all', verifyToken, async (req, res) => {
  try {
    const lists = await prisma.priceList.findMany({
      include: { items: { include: { product: true } } }
    });
    res.json(lists);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// Discount Tiers (productsAPI.getDiscountTiers / updateDiscountTier)
router.get('/discount-tiers', verifyToken, async (req, res) => {
  try {
    const tiers = await prisma.discountTier.findMany({ orderBy: { maxDiscount: 'asc' } });
    const categories = await prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
    res.json({ tiers, categories });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch discount tiers' }); }
});

router.put('/discount-tiers/:tier', verifyToken,
  requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { maxDiscount, requiresManager, requiresFinance } = req.body;
    const tierName = req.params.tier.toUpperCase();
    const updated = await prisma.discountTier.upsert({
      where: { tier: tierName },
      update: {
        maxDiscount: maxDiscount !== undefined ? parseFloat(maxDiscount) : undefined,
        requiresManager: requiresManager !== undefined ? Boolean(requiresManager) : undefined,
        requiresFinance: requiresFinance !== undefined ? Boolean(requiresFinance) : undefined
      },
      create: {
        tier: tierName,
        maxDiscount: parseFloat(maxDiscount) || 10,
        requiresManager: Boolean(requiresManager),
        requiresFinance: Boolean(requiresFinance)
      }
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: 'Failed to update discount tier' }); }
});

// Upsell Rules (productsAPI.getUpsellRules / create / update / delete)
router.get('/upsell-rules', verifyToken, async (req, res) => {
  try {
    const rules = await prisma.upsellRule.findMany({
      include: {
        sourceProduct: { include: { category: true } },
        targetProduct: { include: { category: true } }
      },
      orderBy: { score: 'desc' }
    });
    res.json(rules);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch upsell rules' }); }
});

router.post('/upsell-rules', verifyToken,
  requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { sourceProductId, targetProductId, score, isPromoted, minMargin } = req.body;
    if (!sourceProductId || !targetProductId) {
      return res.status(400).json({ error: 'Source and Target products required' });
    }
    const rule = await prisma.upsellRule.create({
      data: {
        sourceProductId,
        targetProductId,
        score: parseInt(score) || 50,
        isPromoted: Boolean(isPromoted),
        minMargin: parseFloat(minMargin) || 0
      },
      include: { sourceProduct: true, targetProduct: true }
    });
    res.status(201).json(rule);
  } catch (e) { res.status(500).json({ error: 'Failed to create upsell rule' }); }
});

router.put('/upsell-rules/:id', verifyToken,
  requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { score, isPromoted, minMargin } = req.body;
    const rule = await prisma.upsellRule.update({
      where: { id: req.params.id },
      data: {
        score: score !== undefined ? parseInt(score) : undefined,
        isPromoted: isPromoted !== undefined ? Boolean(isPromoted) : undefined,
        minMargin: minMargin !== undefined ? parseFloat(minMargin) : undefined
      },
      include: { sourceProduct: true, targetProduct: true }
    });
    res.json(rule);
  } catch (e) { res.status(500).json({ error: 'Failed to update upsell rule' }); }
});

router.delete('/upsell-rules/:id', verifyToken,
  requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    await prisma.upsellRule.delete({ where: { id: req.params.id } });
    res.json({ message: 'Upsell rule deleted successfully' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete upsell rule' }); }
});

// ── PARAMETRIC PRODUCT ROUTES (Must be placed AFTER all static/sub-resource routes) ──

// Variant management
router.post('/:id/variants', verifyToken,
  requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { name, attribute, value, extraPrice } = req.body;
    const variant = await prisma.productVariant.create({
      data: {
        productId: req.params.id, name, attribute,
        value, extraPrice: parseFloat(extraPrice) || 0
      }
    });
    res.status(201).json(variant);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// GET single product
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        variants: true,
        warehouseStocks: { include: { warehouse: true } },
        upsellRules: { include: { targetProduct: { include: { category: true } } } }
      }
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// PUT update product with optional image
router.put('/:id', verifyToken,
  requireRoles('ADMIN', 'SALES_MANAGER'),
  upload.single('image'),
  processImage,
  async (req, res) => {
  try {
    const { name, description, basePrice, costPrice,
            tax, unit, isSubscription, billingCycle } = req.body;
    const data = {
      name, description,
      basePrice: basePrice ? parseFloat(basePrice) : undefined,
      costPrice: costPrice ? parseFloat(costPrice) : undefined,
      tax: tax ? parseFloat(tax) : undefined,
      unit, isSubscription: isSubscription !== undefined
        ? isSubscription === 'true' : undefined,
    };
    if (req.file?.savedPath) data.imageUrl = req.file.savedPath;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: { category: true }
    });
    res.json(product);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// DELETE product (soft)
router.delete('/:id', verifyToken,
  requireRoles('ADMIN'), async (req, res) => {
  try {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });
    res.json({ message: 'Product deactivated' });
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

module.exports = router;
