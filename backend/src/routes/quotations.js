const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { computeBlendedRiskScore, computeOrderTotals } = require('../utils/blendedRiskEngine');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

// GET all quotations
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, repId, search, stage } = req.query;
    const where = {};

    // Reps see only their own, managers see all
    if (req.user.role === 'SALES_REP') where.repId = req.user.id;
    if (status) where.status = status;
    if (repId && req.user.role !== 'SALES_REP') where.repId = repId;
    if (search) where.OR = [
      { quotationNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } }
    ];

    const quotations = await prisma.quotation.findMany({
      where,
      include: {
        rep: { select: { name: true, email: true } },
        customer: { select: { name: true, email: true, companyName: true } },
        lines: { include: { product: { include: { category: true } } } },
        approvals: { include: { approver: { select: { name: true } } } },
        _count: { select: { lines: true, approvals: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(quotations);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET single quotation
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        rep: { select: { id: true, name: true, email: true } },
        customer: true,
        lines: {
          include: {
            product: { include: { category: true, variants: true } }
          }
        },
        approvals: {
          include: { approver: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        },
        fulfillments: {
          include: { warehouse: true }
        },
        subscriptions: { include: { plan: true } },
        invoices: true,
        auditLogs: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        },
        negotiations: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    res.json(quotation);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// POST create quotation
router.post('/', verifyToken,
  requireRoles('SALES_REP', 'SALES_MANAGER', 'ADMIN'), async (req, res) => {
  try {
    const { customerId, customerTier, lines, repNotes, expiryDate } = req.body;

    if (!lines?.length)
      return res.status(400).json({ error: 'At least one product line required' });

    // Fetch product costs for margin calculation
    const enrichedLines = await Promise.all(lines.map(async (line) => {
      const product = await prisma.product.findUnique({ where: { id: line.productId } });
      return {
        ...line,
        costPrice: product?.costPrice || 0,
        tax: product?.tax || 18
      };
    }));

    const totals = computeOrderTotals(enrichedLines);
    const riskResult = await computeBlendedRiskScore(
      enrichedLines, customerTier || 'BRONZE'
    );

    const count = await prisma.quotation.count();
    const quotationNumber = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    const portalToken = uuidv4();

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        repId: req.user.id,
        customerId: customerId || null,
        customerTier: customerTier || 'BRONZE',
        status: 'DRAFT',
        blendedRiskScore: riskResult.blendedScore,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        total: totals.total,
        margin: totals.margin,
        portalToken,
        repNotes,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        lines: {
          create: enrichedLines.map(l => ({
            productId: l.productId,
            variantId: l.variantId || null,
            lineType: l.lineType || 'ONE_TIME',
            quantity: parseInt(l.quantity),
            unitPrice: parseFloat(l.unitPrice),
            costPrice: parseFloat(l.costPrice),
            discount: parseFloat(l.discount) || 0,
            tax: parseFloat(l.tax),
            lineTotal: parseFloat(l.lineTotal || 0),
            margin: parseFloat(l.margin || 0),
            notes: l.notes || null
          }))
        }
      },
      include: {
        lines: { include: { product: true } },
        rep: { select: { name: true } }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        quotationId: quotation.id,
        userId: req.user.id,
        action: 'CREATED',
        details: `Quotation ${quotationNumber} created`,
        metadata: { riskScore: riskResult.blendedScore }
      }
    });

    // Emit real-time
    const io = req.app.get('io');
    io.to('dashboard').emit('quotation-created', quotation);

    res.status(201).json({
      quotation,
      riskAnalysis: riskResult
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// PUT update quotation lines (recalculate everything)
router.put('/:id', verifyToken,
  requireRoles('SALES_REP', 'SALES_MANAGER', 'ADMIN'), async (req, res) => {
  try {
    const { lines, customerTier, repNotes, expiryDate, customerId } = req.body;
    const existing = await prisma.quotation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Quotation not found' });

    if (!['DRAFT', 'RETURNED'].includes(existing.status))
      return res.status(400).json({ error: 'Only DRAFT or RETURNED quotations can be edited' });

    const enrichedLines = await Promise.all(lines.map(async (line) => {
      const product = await prisma.product.findUnique({ where: { id: line.productId } });
      return { ...line, costPrice: product?.costPrice || 0, tax: product?.tax || 18 };
    }));

    const totals = computeOrderTotals(enrichedLines);
    const tier = customerTier || existing.customerTier;
    const riskResult = await computeBlendedRiskScore(enrichedLines, tier);

    // Delete old lines and recreate
    await prisma.quotationLine.deleteMany({ where: { quotationId: req.params.id } });

    const quotation = await prisma.quotation.update({
      where: { id: req.params.id },
      data: {
        customerId: customerId !== undefined ? customerId : existing.customerId,
        customerTier: tier,
        blendedRiskScore: riskResult.blendedScore,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        total: totals.total,
        margin: totals.margin,
        repNotes, status: 'DRAFT',
        expiryDate: expiryDate ? new Date(expiryDate) : existing.expiryDate,
        lastActivityAt: new Date(),
        lines: {
          create: enrichedLines.map(l => ({
            productId: l.productId,
            variantId: l.variantId || null,
            lineType: l.lineType || 'ONE_TIME',
            quantity: parseInt(l.quantity),
            unitPrice: parseFloat(l.unitPrice),
            costPrice: parseFloat(l.costPrice),
            discount: parseFloat(l.discount) || 0,
            tax: parseFloat(l.tax),
            lineTotal: parseFloat(l.lineTotal || 0),
            margin: parseFloat(l.margin || 0),
            notes: l.notes || null
          }))
        }
      },
      include: { lines: { include: { product: true } }, rep: true }
    });

    await prisma.auditLog.create({
      data: {
        quotationId: req.params.id, userId: req.user.id,
        action: 'UPDATED', details: 'Quotation lines updated',
        metadata: { riskScore: riskResult.blendedScore }
      }
    });

    res.json({ quotation, riskAnalysis: riskResult });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// SUBMIT for approval
router.put('/:id/submit', verifyToken,
  requireRoles('SALES_REP', 'SALES_MANAGER', 'ADMIN'), async (req, res) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: { lines: { include: { product: { include: { category: true } } } } }
    });
    if (!quotation) return res.status(404).json({ error: 'Not found' });

    const riskResult = await computeBlendedRiskScore(
      quotation.lines, quotation.customerTier
    );

    let newStatus = 'APPROVED';
    if (riskResult.requiresFinance) newStatus = 'PENDING_FINANCE';
    else if (riskResult.requiresManager) newStatus = 'PENDING_MANAGER';

    const updated = await prisma.quotation.update({
      where: { id: req.params.id },
      data: { status: newStatus, lastActivityAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        quotationId: req.params.id, userId: req.user.id,
        action: 'SUBMITTED',
        details: `Submitted. Risk score: ${riskResult.blendedScore}. Routed to: ${newStatus}`,
      }
    });

    // Notify approvers
    const io = req.app.get('io');
    io.to('approvers').emit('approval-needed', {
      quotationId: req.params.id,
      quotationNumber: quotation.quotationNumber,
      status: newStatus, riskScore: riskResult.blendedScore
    });

    res.json({ quotation: updated, riskAnalysis: riskResult });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// APPROVE / REJECT / RETURN quotation
router.put('/:id/decision', verifyToken,
  requireRoles('SALES_MANAGER', 'FINANCE', 'ADMIN'), async (req, res) => {
  try {
    const { action, reason } = req.body;
    if (!['APPROVED','REJECTED','RETURNED'].includes(action))
      return res.status(400).json({ error: 'Invalid action' });

    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id }
    });
    if (!quotation) return res.status(404).json({ error: 'Not found' });

    let newStatus;
    if (action === 'APPROVED') {
      if (quotation.status === 'PENDING_MANAGER') newStatus = 'APPROVED';
      else if (quotation.status === 'PENDING_FINANCE') newStatus = 'APPROVED';
      else newStatus = 'APPROVED';
    } else if (action === 'REJECTED') newStatus = 'REJECTED';
    else if (action === 'RETURNED') newStatus = 'DRAFT';

    await prisma.$transaction([
      prisma.approval.create({
        data: {
          quotationId: req.params.id,
          approverId: req.user.id,
          level: req.user.role === 'FINANCE' ? 2 : 1,
          action, reason, decidedAt: new Date()
        }
      }),
      prisma.quotation.update({
        where: { id: req.params.id },
        data: { status: newStatus, lastActivityAt: new Date() }
      }),
      prisma.auditLog.create({
        data: {
          quotationId: req.params.id, userId: req.user.id,
          action: action === 'APPROVED' ? 'APPROVED'
                : action === 'REJECTED' ? 'REJECTED' : 'RETURNED',
          details: reason || `${action} by ${req.user.role}`,
          metadata: { action, role: req.user.role }
        }
      })
    ]);

    const io = req.app.get('io');
    io.to('dashboard').emit('approval-decision', {
      quotationId: req.params.id,
      action, newStatus
    });

    res.json({ message: `Quotation ${action.toLowerCase()} successfully` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// LIVE RISK SCORE CHECK (no DB write, just compute)
router.post('/compute-risk', verifyToken, async (req, res) => {
  try {
    const { lines, customerTier } = req.body;
    if (!lines?.length) return res.json({ blendedScore: 0, requiresManager: false, requiresFinance: false });
    const enrichedLines = await Promise.all(lines.map(async (line) => {
      const product = await prisma.product.findUnique({ where: { id: line.productId } });
      return { ...line, costPrice: product?.costPrice || 0, tax: product?.tax || 18 };
    }));
    const totals = computeOrderTotals(enrichedLines);
    const risk = await computeBlendedRiskScore(enrichedLines, customerTier || 'BRONZE');
    res.json({ ...risk, totals });
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// GET portal view by token (public — no auth)
router.get('/portal/:token', async (req, res) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { portalToken: req.params.token },
      include: {
        rep: { select: { name: true, email: true } },
        lines: { include: { product: { include: { category: true } } } },
        negotiations: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    res.json(quotation);
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

// SEND to customer portal
router.put('/:id/send', verifyToken,
  requireRoles('SALES_REP', 'SALES_MANAGER', 'ADMIN'), async (req, res) => {
  try {
    const q = await prisma.quotation.findUnique({ where: { id: req.params.id } });
    if (q.status !== 'APPROVED')
      return res.status(400).json({ error: 'Only approved quotations can be sent' });

    const updated = await prisma.quotation.update({
      where: { id: req.params.id },
      data: { status: 'SENT_TO_CUSTOMER', lastActivityAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        quotationId: req.params.id, userId: req.user.id,
        action: 'SENT', details: 'Sent to customer portal'
      }
    });

    const portalUrl = `${process.env.FRONTEND_URL}/portal/${q.portalToken}`;
    res.json({ message: 'Sent to customer', portalUrl, portalToken: q.portalToken });
  } catch (e) { res.status(500).json({ error: 'Something went wrong' }); }
});

module.exports = router;
