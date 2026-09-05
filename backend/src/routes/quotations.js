const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { computeBlendedRiskScore, computeOrderTotals } = require('../utils/blendedRiskEngine');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
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

// GET /api/quotations/discount-tiers (STEP 3)
router.get('/discount-tiers', verifyToken, async (req, res) => {
  try {
    const tiers = await prisma.discountTier.findMany({ orderBy: { maxDiscount: 'asc' } });
    const categories = await prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
    res.json({ tiers, categories });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch discount tiers' });
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

// PUT /:id/status — Quick status update
router.put('/:id/status', verifyToken, requireRoles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'), async (req, res) => {
  try {
    const { status } = req.body;
    const quotation = await prisma.quotation.update({
      where: { id: req.params.id },
      data: { status, lastActivityAt: new Date() }
    });
    res.json(quotation);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update quotation status' });
  }
});

// POST /batch-decision — Bulk approve / reject quotations
router.post('/batch-decision', verifyToken, requireRoles('SALES_MANAGER', 'FINANCE', 'ADMIN'), async (req, res) => {
  try {
    const { quotationIds, action, reason } = req.body;
    if (!quotationIds?.length || !['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({ error: 'Invalid batch action parameters' });
    }

    const updated = [];
    for (const qId of quotationIds) {
      await prisma.$transaction([
        prisma.approval.create({
          data: {
            quotationId: qId,
            approverId: req.user.id,
            level: req.user.role === 'FINANCE' ? 2 : 1,
            action,
            reason: reason || `Bulk ${action} by ${req.user.name}`,
            decidedAt: new Date()
          }
        }),
        prisma.quotation.update({
          where: { id: qId },
          data: { status: action === 'APPROVED' ? 'APPROVED' : 'REJECTED', lastActivityAt: new Date() }
        }),
        prisma.auditLog.create({
          data: {
            quotationId: qId,
            userId: req.user.id,
            action: action === 'APPROVED' ? 'APPROVED' : 'REJECTED',
            details: `Bulk ${action.toLowerCase()} from approval queue`
          }
        })
      ]);
      updated.push(qId);
    }

    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('approval-decision', { quotationIds: updated, action });
    }

    res.json({ message: `Successfully ${action.toLowerCase()} ${updated.length} quotations`, updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to perform batch action' });
  }
});

// GET /:id/pdf — Branded Quotation PDF export
router.get('/:id/pdf', async (req, res) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        rep: true,
        lines: { include: { product: true } },
        approvals: { include: { approver: true } }
      }
    });

    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quotation.quotationNumber}.pdf"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    // Header banner
    doc.rect(0, 0, doc.page.width, 80).fill('#0f172a');
    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold').text('DealFlow360', 40, 22);
    doc.fontSize(10).fillColor('#94a3b8').font('Helvetica').text('Intelligent Sales Quotation & Pricing Summary', 40, 50);

    doc.fontSize(16).fillColor('#ffffff').font('Helvetica-Bold').text(quotation.quotationNumber, doc.page.width - 200, 22, { align: 'right' });
    doc.fontSize(10).fillColor('#10b981').font('Helvetica').text(`STATUS: ${quotation.status}`, doc.page.width - 200, 50, { align: 'right' });

    doc.moveDown(3);

    // Meta columns
    const customer = quotation.customer;
    const rep = quotation.rep;

    const leftColX = 40;
    const rightColX = 320;
    const startY = doc.y;

    doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('Prepared For:', leftColX, startY);
    doc.fontSize(10).fillColor('#334155').font('Helvetica')
      .text(customer?.companyName || customer?.name || 'Customer Organization', leftColX)
      .text(`Contact: ${customer?.name || 'N/A'}`, leftColX)
      .text(`Email: ${customer?.email || 'N/A'}`, leftColX)
      .text(`Tier: ${quotation.customerTier || 'BRONZE'}`, leftColX);

    doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('Prepared By:', rightColX, startY);
    doc.fontSize(10).fillColor('#334155').font('Helvetica')
      .text(rep?.name || 'Sales Representative', rightColX)
      .text(rep?.email || '', rightColX)
      .text(`Date: ${new Date(quotation.createdAt).toLocaleDateString()}`, rightColX)
      .text(`Valid Until: ${quotation.expiryDate ? new Date(quotation.expiryDate).toLocaleDateString() : '30 Days'}`, rightColX);

    doc.moveDown(2);
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.5);

    // Table Header
    const tableTop = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('Item / Product', 40, tableTop);
    doc.text('Type', 250, tableTop);
    doc.text('Qty', 310, tableTop);
    doc.text('Unit Price', 360, tableTop);
    doc.text('Disc %', 430, tableTop);
    doc.text('Total', 480, tableTop, { align: 'right' });

    doc.moveDown(0.5);
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.5);

    for (const line of quotation.lines) {
      const y = doc.y;
      doc.fontSize(9).font('Helvetica').fillColor('#334155');
      doc.text(line.product?.name || 'Product', 40, y, { width: 200 });
      doc.text(line.lineType === 'SUBSCRIPTION' ? 'Subscription' : 'One-Time', 250, y);
      doc.text(String(line.quantity), 310, y);
      doc.text(`₹${Number(line.unitPrice).toLocaleString()}`, 360, y);
      doc.text(`${line.discount || 0}%`, 430, y);
      doc.text(`₹${Number(line.lineTotal).toLocaleString()}`, 480, y, { align: 'right' });
      doc.moveDown(0.8);
    }

    doc.moveDown();
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.5);

    // Totals Box
    const totalsX = 350;
    doc.fontSize(9).font('Helvetica').fillColor('#475569');
    doc.text(`Subtotal: ₹${Number(quotation.subtotal).toLocaleString()}`, totalsX, doc.y, { align: 'right' });
    doc.moveDown(0.3);
    doc.text(`Discount: -₹${Number(quotation.discountAmount).toLocaleString()}`, totalsX, doc.y, { align: 'right' });
    doc.moveDown(0.3);
    doc.text(`Tax (GST): ₹${Number(quotation.taxAmount).toLocaleString()}`, totalsX, doc.y, { align: 'right' });
    doc.moveDown(0.5);

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`Total: ₹${Number(quotation.total).toLocaleString()}`, totalsX, doc.y, { align: 'right' });

    // Portal link & QR note
    doc.moveDown(2);
    if (quotation.portalToken) {
      doc.fontSize(9).font('Helvetica').fillColor('#3b82f6')
        .text(`View & Negotiate Online: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/portal/${quotation.portalToken}`, 40, doc.y);
    }

    doc.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to generate quotation PDF' });
  }
});

module.exports = router;

