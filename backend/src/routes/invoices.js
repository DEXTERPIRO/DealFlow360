const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { verifyToken, requireRoles } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const prisma = new PrismaClient();

// GET all invoices
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { quotation: { quotationNumber: { contains: search, mode: 'insensitive' } } },
        { quotation: { customer: { name: { contains: search, mode: 'insensitive' } } } }
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        quotation: {
          include: {
            customer: true,
            rep: { select: { id: true, name: true, email: true } },
            lines: { include: { product: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// POST create invoice for quotation
router.post('/', verifyToken, requireRoles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'), async (req, res) => {
  try {
    const { quotationId, amount, dueDate, isRecurring } = req.body;
    if (!quotationId) return res.status(400).json({ error: 'Quotation ID required' });

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId }
    });
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    const due = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        quotationId,
        amount: amount ? parseFloat(amount) : quotation.total,
        dueDate: due,
        status: 'SENT',
        isRecurring: Boolean(isRecurring)
      },
      include: {
        quotation: {
          include: { customer: true, rep: true, lines: { include: { product: true } } }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        quotationId,
        userId: req.user.id,
        action: 'INVOICED',
        details: `Invoice ${invoiceNumber} created for ₹${Number(invoice.amount).toLocaleString()}`
      }
    });

    res.status(201).json(invoice);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PUT record payment
router.put('/:id/pay', verifyToken, requireRoles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'), async (req, res) => {
  try {
    const { paymentRef, paidAt } = req.body;
    const existing = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { quotation: true }
    });
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        status: 'PAID',
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        paymentRef: paymentRef || `MANUAL-${Date.now()}`
      },
      include: {
        quotation: {
          include: { customer: true, rep: true }
        }
      }
    });

    // Update quotation status to CONFIRMED if not already
    if (existing.quotation && existing.quotation.status !== 'CONFIRMED') {
      await prisma.quotation.update({
        where: { id: existing.quotationId },
        data: { status: 'CONFIRMED', lastActivityAt: new Date() }
      });
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        quotationId: existing.quotationId,
        userId: req.user.id,
        action: 'PAID',
        details: `Invoice ${existing.invoiceNumber} marked PAID (${invoice.paymentRef})`
      }
    });

    // Real-time notification across dashboard
    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('invoice-paid', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        quotationId: invoice.quotationId
      });
    }

    res.json({ message: 'Payment recorded successfully', invoice });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// PUT mark invoice sent
router.put('/:id/send', verifyToken, async (req, res) => {
  try {
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: 'SENT' }
    });
    res.json(invoice);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to mark invoice sent' });
  }
});

// GET download branded PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        quotation: {
          include: {
            customer: true,
            rep: true,
            lines: { include: { product: true } }
          }
        }
      }
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    // Header banner
    doc.rect(0, 0, doc.page.width, 80).fill('#0f172a');
    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold').text('DealFlow360', 40, 22);
    doc.fontSize(10).fillColor('#94a3b8').font('Helvetica').text('Tax Invoice & Payment Receipt', 40, 50);

    doc.fontSize(16).fillColor('#ffffff').font('Helvetica-Bold').text(invoice.invoiceNumber, doc.page.width - 200, 22, { align: 'right' });
    doc.fontSize(10).fillColor('#38bdf8').font('Helvetica').text(`STATUS: ${invoice.status}`, doc.page.width - 200, 50, { align: 'right' });

    doc.moveDown(3);

    // Invoice info
    const customer = invoice.quotation?.customer;
    doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text('Billed To:');
    doc.fontSize(10).fillColor('#334155').font('Helvetica')
      .text(customer?.companyName || customer?.name || 'Customer')
      .text(customer?.email || '')
      .text(`Phone: ${customer?.phone || 'N/A'}`);

    doc.moveDown();
    doc.fontSize(10).fillColor('#64748b')
      .text(`Quotation: ${invoice.quotation?.quotationNumber || 'N/A'}`)
      .text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`)
      .text(`Issued Date: ${new Date(invoice.createdAt).toLocaleDateString()}`);

    if (invoice.paidAt) {
      doc.text(`Paid Date: ${new Date(invoice.paidAt).toLocaleDateString()}`);
      doc.text(`Reference: ${invoice.paymentRef || 'N/A'}`);
    }

    doc.moveDown();
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown();

    // Table Header
    const tableTop = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('Item / Description', 40, tableTop);
    doc.text('Qty', 300, tableTop);
    doc.text('Unit Price', 360, tableTop);
    doc.text('Total', 460, tableTop, { align: 'right' });

    doc.moveDown(0.5);
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.5);

    // Line items
    const lines = invoice.quotation?.lines || [];
    for (const l of lines) {
      const y = doc.y;
      doc.fontSize(9).font('Helvetica').fillColor('#334155');
      doc.text(l.product?.name || 'Product', 40, y, { width: 250 });
      doc.text(String(l.quantity), 300, y);
      doc.text(`₹${Number(l.unitPrice).toLocaleString()}`, 360, y);
      doc.text(`₹${Number(l.lineTotal).toLocaleString()}`, 460, y, { align: 'right' });
      doc.moveDown(0.8);
    }

    doc.moveDown();
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.5);

    // Totals
    const yTotal = doc.y;
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('Total Amount:', 300, yTotal);
    doc.text(`₹${Number(invoice.amount).toLocaleString()}`, 460, yTotal, { align: 'right' });

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#94a3b8').font('Helvetica').text('Thank you for your business. DealFlow360 Automated Billing.', 40, doc.page.height - 50, { align: 'center' });

    doc.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
