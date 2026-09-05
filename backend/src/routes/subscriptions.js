const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireRoles } = require('../middleware/auth');
const prisma = new PrismaClient();

// GET all subscriptions with quotation, customer, product & plan
router.get('/', verifyToken, async (req, res) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        plan: true,
        quotation: {
          include: {
            customer: true,
            rep: { select: { id: true, name: true, email: true } },
            lines: {
              where: { lineType: 'SUBSCRIPTION' },
              include: { product: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Also fetch product details for each subscription if needed
    const enriched = await Promise.all(subscriptions.map(async (sub) => {
      const product = await prisma.product.findUnique({
        where: { id: sub.productId }
      });
      return {
        ...sub,
        product: product || { name: 'Subscription Service', sku: 'SUB-GEN' }
      };
    }));

    res.json(enriched);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// GET all subscription plans
router.get('/plans', verifyToken, async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      include: {
        _count: { select: { subscriptions: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(plans);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

// POST create plan
router.post('/plans', verifyToken, requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { name, billingCycle, prorateOnChange, cancelPolicy, partialRefund } = req.body;
    if (!name || !billingCycle) {
      return res.status(400).json({ error: 'Name and billing cycle are required' });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        billingCycle,
        prorateOnChange: prorateOnChange !== undefined ? Boolean(prorateOnChange) : true,
        cancelPolicy: cancelPolicy || null,
        partialRefund: Boolean(partialRefund)
      }
    });
    res.status(201).json(plan);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create subscription plan' });
  }
});

// PUT update plan
router.put('/plans/:id', verifyToken, requireRoles('ADMIN', 'SALES_MANAGER'), async (req, res) => {
  try {
    const { name, billingCycle, prorateOnChange, cancelPolicy, partialRefund } = req.body;
    const plan = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name : undefined,
        billingCycle: billingCycle !== undefined ? billingCycle : undefined,
        prorateOnChange: prorateOnChange !== undefined ? Boolean(prorateOnChange) : undefined,
        cancelPolicy: cancelPolicy !== undefined ? cancelPolicy : undefined,
        partialRefund: partialRefund !== undefined ? Boolean(partialRefund) : undefined
      }
    });
    res.json(plan);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update subscription plan' });
  }
});

// POST create subscription from quotation
router.post('/:quotationId', verifyToken, async (req, res) => {
  try {
    const { planId, productId, quantity, unitPrice, startDate } = req.body;
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.quotationId }
    });
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const start = startDate ? new Date(startDate) : new Date();
    const nextBilling = new Date(start);
    if (plan.billingCycle === 'YEARLY') {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    } else if (plan.billingCycle === 'QUARTERLY') {
      nextBilling.setMonth(nextBilling.getMonth() + 3);
    } else {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    }

    const sub = await prisma.subscription.create({
      data: {
        quotationId: req.params.quotationId,
        planId,
        productId,
        quantity: parseInt(quantity) || 1,
        unitPrice: parseFloat(unitPrice) || 0,
        startDate: start,
        nextBillingDate: nextBilling,
        status: 'ACTIVE'
      },
      include: { plan: true }
    });

    res.status(201).json(sub);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// PUT cancel subscription
router.put('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const sub = await prisma.subscription.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date()
      },
      include: { plan: true }
    });
    res.json({ message: 'Subscription cancelled successfully', subscription: sub });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
