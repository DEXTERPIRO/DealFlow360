"""app/utils/pdf_generator.py — ReportLab PDF generator for DealFlow360 invoices."""
import io
from decimal import Decimal
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_invoice_pdf(invoice, quotation) -> io.BytesIO:
    """
    Generates a professional PDF invoice using ReportLab:
    - Colors: Brand blue #2563eb, dark text #1e293b, slate text #374151 / #64748b, light rows #f8fafc
    - Clean header, Bill-To block, alternating row line items, totals summary, and footer.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    story = []
    styles = getSampleStyleSheet()

    # Brand colors
    brand_blue = colors.HexColor("#2563eb")
    dark_slate = colors.HexColor("#0f172a")
    text_muted = colors.HexColor("#64748b")
    border_color = colors.HexColor("#e2e8f0")
    light_row = colors.HexColor("#f8fafc")

    title_style = ParagraphStyle(
        "BrandTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=brand_blue
    )

    subtitle_style = ParagraphStyle(
        "BrandSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=text_muted
    )

    header_right_style = ParagraphStyle(
        "HeaderRight",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        alignment=2,  # Right align
        textColor=dark_slate
    )

    header_meta_style = ParagraphStyle(
        "HeaderMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        alignment=2,
        textColor=text_muted
    )

    label_style = ParagraphStyle(
        "LabelStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=brand_blue
    )

    text_style = ParagraphStyle(
        "TextStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155")
    )

    # 1. Top Header (Brand Left | Invoice Meta Right)
    due_date_str = invoice.due_date.strftime("%d %b %Y") if invoice.due_date else "Upon Receipt"
    paid_date_str = invoice.paid_at.strftime("%d %b %Y") if invoice.paid_at else "Unpaid"

    left_header = [
        Paragraph("DEALFLOW360", title_style),
        Paragraph("Configure · Price · Quote Cloud Platform", subtitle_style),
    ]

    right_header = [
        Paragraph(f"INVOICE", header_right_style),
        Paragraph(f"<b>Invoice #:</b> {invoice.invoice_number}", header_meta_style),
        Paragraph(f"<b>Quotation #:</b> {quotation.quotation_number}", header_meta_style),
        Paragraph(f"<b>Due Date:</b> {due_date_str}", header_meta_style),
        Paragraph(f"<b>Status:</b> {invoice.status.value if hasattr(invoice.status, 'value') else invoice.status}", header_meta_style),
    ]

    header_table = Table(
        [[left_header, right_header]],
        colWidths=[280, 235]
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 15))

    # 2. Bill To & Sales Rep Details
    cust = quotation.customer
    rep = quotation.rep
    cust_name = cust.name if cust else "Valued Customer"
    cust_company = cust.company_name if cust and cust.company_name else "Enterprise Partner"
    cust_email = cust.email if cust else "billing@customer.com"
    rep_name = rep.name if rep else "Sales Team"

    bill_to_content = [
        Paragraph("BILLED TO:", label_style),
        Paragraph(f"<b>{cust_name}</b>", text_style),
        Paragraph(cust_company, text_style),
        Paragraph(cust_email, text_style),
    ]

    rep_content = [
        Paragraph("ACCOUNT EXECUTIVE:", label_style),
        Paragraph(f"<b>{rep_name}</b>", text_style),
        Paragraph("DealFlow360 Enterprise Sales", text_style),
        Paragraph(f"Tier: {quotation.customer_tier.value if hasattr(quotation.customer_tier, 'value') else quotation.customer_tier}", text_style),
    ]

    info_table = Table(
        [[bill_to_content, rep_content]],
        colWidths=[280, 235]
    )
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 1, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 20))

    # 3. Line Items Table
    table_data = [
        [
            Paragraph("<b>#</b>", text_style),
            Paragraph("<b>Item & Description</b>", text_style),
            Paragraph("<b>Type</b>", text_style),
            Paragraph("<b>Qty</b>", text_style),
            Paragraph("<b>Unit Price</b>", text_style),
            Paragraph("<b>Disc.</b>", text_style),
            Paragraph("<b>Tax</b>", text_style),
            Paragraph("<b>Line Total</b>", text_style),
        ]
    ]

    for idx, line in enumerate(quotation.lines, start=1):
        prod_name = line.product.name if line.product else "Product Item"
        l_type = line.line_type.value if hasattr(line.line_type, "value") else str(line.line_type)
        table_data.append([
            Paragraph(str(idx), text_style),
            Paragraph(prod_name, text_style),
            Paragraph(l_type, text_style),
            Paragraph(str(line.quantity), text_style),
            Paragraph(f"INR {float(line.unit_price):,.2f}", text_style),
            Paragraph(f"{line.discount}%", text_style),
            Paragraph(f"{float(line.tax)}%", text_style),
            Paragraph(f"INR {float(line.line_total):,.2f}", text_style),
        ])

    items_table = Table(
        table_data,
        colWidths=[25, 175, 55, 30, 75, 40, 35, 80]
    )

    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("TEXTCOLOR", (0, 0), (-1, 0), dark_slate),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
    ]

    # Alternating row colors
    for row_idx in range(1, len(table_data)):
        if row_idx % 2 == 0:
            t_style.append(("BACKGROUND", (0, row_idx), (-1, row_idx), light_row))

    items_table.setStyle(TableStyle(t_style))
    story.append(items_table)
    story.append(Spacer(1, 15))

    # 4. Totals Summary Box (Right Aligned)
    totals_data = [
        [Paragraph("Subtotal:", text_style), Paragraph(f"INR {float(quotation.subtotal):,.2f}", text_style)],
        [Paragraph("Discount Amount:", text_style), Paragraph(f"- INR {float(quotation.discount_amount):,.2f}", text_style)],
        [Paragraph("Tax (GST/VAT):", text_style), Paragraph(f"INR {float(quotation.tax_amount):,.2f}", text_style)],
        [
            Paragraph("<b>Total Amount:</b>", label_style),
            Paragraph(f"<b>INR {float(invoice.amount):,.2f}</b>", label_style)
        ]
    ]

    totals_table = Table(totals_data, colWidths=[120, 100])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 2), (-1, 2), 1, brand_blue),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    summary_container = Table(
        [["", totals_table]],
        colWidths=[295, 220]
    )
    summary_container.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(summary_container)
    story.append(Spacer(1, 30))

    # 5. Footer Note
    footer_text = Paragraph(
        "Thank you for your business! For billing inquiries, contact finance@dealflow360.com.<br/>"
        "DealFlow360 Enterprise Pipeline Engine · Computer Generated Tax Invoice · Confidential",
        ParagraphStyle(
            "Footer",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            alignment=1,  # Center
            textColor=text_muted
        )
    )
    story.append(footer_text)

    # Build document
    doc.build(story)
    buffer.seek(0)
    return buffer
