const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { computeBlendedRiskScore, computeOrderTotals } = require('../utils/blendedRiskEngine');
const prisma = new PrismaClient();

// POST /api/negotiations/:quotationId/negotiate — Customer submits counter offer
router.post('/:quotationId/negotiate', async (req, res) => {
  try {
    const { message, counterDiscount, lineId, requestedBy } = req.body;
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.quotationId },
      include: {
        lines: { include: { product: true } },
        customer: true,
        rep: true
      }
    });

    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    // Check tier discount limit
    const tier = await prisma.discountTier.findUnique({
      where: { tier: quotation.customerTier }
    });
    const maxTierDiscount = tier?.maxDiscount ?? 10;
    const requestedDiscount = parseFloat(counterDiscount) || 0;
    const requiresReapproval = requestedDiscount > maxTierDiscount;

    const negotiation = await prisma.negotiation.create({
      data: {
        quotationId: req.params.quotationId,
        requestedBy: requestedBy || quotation.customer?.name || 'Customer',
        message: message || `Requested ${requestedDiscount}% discount`,
        counterDiscount: requestedDiscount,
        lineId: lineId || null,
        status: 'PENDING'
      }
    });

    // Update quotation status based on approval requirements
    const newStatus = requiresReapproval ? 'PENDING_MANAGER' : 'UNDER_NEGOTIATION';

    await prisma.quotation.update({
      where: { id: req.params.quotationId },
      data: {
        status: newStatus,
        lastActivityAt: new Date()
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        quotationId: req.params.quotationId,
        userId: quotation.repId,
        action: 'NEGOTIATED',
        details: `Customer negotiated: "${message || requestedDiscount + '%'}". Status: ${newStatus}`,
        metadata: { counterDiscount: requestedDiscount, requiresReapproval }
      }
    });

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('negotiation-received', {
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        counterDiscount: requestedDiscount,
        message,
        newStatus,
        requiresReapproval
      });

      if (requiresReapproval) {
        io.to('approvers').emit('approval-needed', {
          quotationId: quotation.id,
          quotationNumber: quotation.quotationNumber,
          status: newStatus,
          reason: `Counter discount (${requestedDiscount}%) exceeds tier limit (${maxTierDiscount}%)`
        });
      }
    }

    res.status(201).json({
      negotiation,
      requiresReapproval,
      newStatus,
      message: requiresReapproval
        ? 'Discount exceeds policy threshold and has been routed to Sales Manager for review.'
        : 'Counter proposal submitted to sales team.'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to submit counter offer' });
  }
});

// PUT /api/negotiations/:id/respond — Rep/Manager accepts or rejects counter
router.put('/:id/respond', async (req, res) => {
  try {
    const { action, responseMessage } = req.body;
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: req.params.id },
      include: { quotation: { include: { lines: true } } }
    });
    if (!negotiation) return res.status(404).json({ error: 'Negotiation not found' });

    const status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    const updated = await prisma.negotiation.update({
      where: { id: req.params.id },
      data: { status }
    });

    if (action === 'ACCEPT' && negotiation.counterDiscount) {
      // Apply discount to all lines or specified line
      const lines = negotiation.quotation.lines;
      for (const line of lines) {
        if (!negotiation.lineId || line.id === negotiation.lineId) {
          const unitP = Number(line.unitPrice);
          const disc = negotiation.counterDiscount;
          const discAmount = (unitP * disc) / 100;
          const net = unitP - discAmount;
          const lineTot = net * line.quantity;
          await prisma.quotationLine.update({
            where: { id: line.id },
            data: { discount: disc, lineTotal: lineTot }
          });
        }
      }

      await prisma.quotation.update({
        where: { id: negotiation.quotationId },
        data: { status: 'APPROVED', lastActivityAt: new Date() }
      });
    }

    res.json({ message: `Negotiation ${status.toLowerCase()}`, negotiation: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to respond to negotiation' });
  }
});

// POST /api/negotiations/:quotationId/confirm-portal — Customer confirms order
router.post('/:quotationId/confirm-portal', async (req, res) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.quotationId },
      include: { customer: true }
    });
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const updated = await prisma.quotation.update({
      where: { id: req.params.quotationId },
      data: {
        status: 'CONFIRMED',
        lastActivityAt: new Date()
      }
    });

    // Auto-create invoice if not yet exists
    const existingInv = await prisma.invoice.findFirst({
      where: { quotationId: quotation.id }
    });

    let invoice = existingInv;
    if (!existingInv) {
      const count = await prisma.invoice.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
      invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          quotationId: quotation.id,
          amount: quotation.total,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          status: 'SENT'
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        quotationId: quotation.id,
        userId: quotation.repId,
        action: 'CONFIRMED',
        details: `Quotation confirmed by customer in portal`
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('approval-decision', {
        quotationId: quotation.id,
        action: 'CONFIRMED',
        newStatus: 'CONFIRMED'
      });
    }

    res.json({
      message: 'Quotation confirmed successfully! Your order has been placed.',
      quotation: updated,
      invoice
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to confirm quotation' });
  }
});

module.exports = router;
