const PDFDocument = require('pdfkit');

/**
 * Generate a PDF Summary for a Deal
 */
const generateDealPDF = (deal, res) => {
  const doc = new PDFDocument({ margin: 50 });

  // Stream directly to HTTP response
  doc.pipe(res);

  // Header Banner
  doc
    .rect(0, 0, doc.page.width, 80)
    .fill('#1d4ed8');

  doc
    .fontSize(24)
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .text('DEALFLOW360', 50, 25);

  doc
    .fontSize(11)
    .fillColor('#93c5fd')
    .font('Helvetica')
    .text('Executive Deal Memorandum & Summary', 50, 52);

  doc.moveDown(4);

  // Deal Overview Section
  doc
    .fontSize(20)
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .text(deal.title || 'Untitled Deal');

  doc.moveDown(0.5);

  doc
    .fontSize(12)
    .fillColor('#475569')
    .font('Helvetica')
    .text(`Target Company: ${deal.targetCompany || 'N/A'}`);

  doc.text(`Industry: ${deal.industry || 'General'}`);
  doc.text(`Estimated Value: $${(deal.dealValue || 0).toLocaleString()}`);
  doc.text(`Current Stage: ${deal.stage || 'LEAD'}`);
  doc.text(`Priority: ${deal.priority || 'MEDIUM'}`);
  doc.text(`Success Probability: ${deal.probability || 0}%`);

  doc.moveDown(1);
  doc
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .stroke();

  doc.moveDown(1);

  // Executive Description
  doc
    .fontSize(14)
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .text('Investment Thesis & Overview:');

  doc.moveDown(0.5);

  doc
    .fontSize(11)
    .fillColor('#334155')
    .font('Helvetica')
    .text(deal.description || 'No detailed description provided for this mandate.', {
      lineGap: 4,
    });

  doc.moveDown(1.5);

  // Workspace & Ownership
  if (deal.workspace) {
    doc.fontSize(11).fillColor('#64748b').text(`Workspace: ${deal.workspace.name}`);
  }
  if (deal.owner) {
    doc.fontSize(11).fillColor('#64748b').text(`Deal Lead: ${deal.owner.firstName} ${deal.owner.lastName} (${deal.owner.email})`);
  }

  // Footer Note
  doc.moveDown(2);
  doc
    .fontSize(9)
    .fillColor('#94a3b8')
    .text(`Generated on ${new Date().toUTCString()} via DealFlow360 Enterprise Pipeline Engine. Confidential.`, {
      align: 'center',
    });

  doc.end();
};

module.exports = {
  generateDealPDF,
};
