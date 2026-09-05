"""
DealFlow360 - High Quality Markdown to PDF Generator
Generates clean, judge-ready PDF documentation for DealFlow360.
Uses ReportLab Platypus architecture with robust XML escaping, code splitting, and auto-wrapping.
"""

import os
import re
import html
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Preformatted, HRFlowable
)
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print total page count:
    'Page X of Y' on every page, along with professional running header and footer.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#475569"))

        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(36, 11 * inch - 26, "DEALFLOW360 — TECHNICAL ARCHITECTURE & SYSTEM DOCUMENTATION")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(36, 11 * inch - 30, 8.5 * inch - 36, 11 * inch - 30)

        # Footer (all pages)
        self.setFont("Helvetica", 8)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 34, 8.5 * inch - 36, 34)

        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 36, 22, page_str)
        self.drawString(36, 22, "CONFIDENTIAL & PROPRIETARY — DEALFLOW360 PLATFORM")
        self.restoreState()


def format_inline_markdown(text):
    """Safely format inline markdown (bold, italic, code, links) while XML-escaping."""
    # 1. Protect code spans
    code_spans = []
    def code_repl(m):
        code_spans.append(m.group(1))
        return f"___CODESPAN_{len(code_spans)-1}___"

    text = re.sub(r'`([^`]+)`', code_repl, text)

    # 2. Escape raw HTML characters
    text = html.escape(text)

    # 3. Markdown links: [title](url) -> <u><font color="#0284c7">title</font></u>
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'<u><font color="#0284c7">\1</font></u>', text)

    # 4. Bold: **bold** or __bold__
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'__([^_]+)__', r'<b>\1</b>', text)

    # 5. Italic: *italic* or _italic_
    text = re.sub(r'\*([^*]+)\*', r'<i>\1</i>', text)
    text = re.sub(r'(?<!\w)_([^_]+)_(?!\w)', r'<i>\1</i>', text)

    # 6. Restore code spans with styled courier
    for i, span in enumerate(code_spans):
        safe_span = html.escape(span)
        styled = f'<font name="Courier" size="8" color="#7c3aed"><b>{safe_span}</b></font>'
        text = text.replace(f"___CODESPAN_{i}___", styled)

    return text


def build_pdf_from_markdown(md_path, pdf_path, doc_title):
    """Parse markdown file and compile into a styled PDF document."""
    print(f"Generating: {pdf_path} from {md_path}...")

    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Document setup: Letter, 0.5in margins (36pt)
    margin = 36
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin + 8,
        bottomMargin=margin + 12
    )

    printable_width = 8.5 * inch - 2 * margin  # 540 pt

    # Styles
    styles = {
        'H1': ParagraphStyle(
            'H1_Custom',
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=colors.HexColor('#0f172a'),
            spaceBefore=12,
            spaceAfter=6,
            keepWithNext=True
        ),
        'H2': ParagraphStyle(
            'H2_Custom',
            fontName='Helvetica-Bold',
            fontSize=12.5,
            leading=16,
            textColor=colors.HexColor('#1e3a8a'),
            spaceBefore=10,
            spaceAfter=4,
            keepWithNext=True
        ),
        'H3': ParagraphStyle(
            'H3_Custom',
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=13,
            textColor=colors.HexColor('#0369a1'),
            spaceBefore=7,
            spaceAfter=3,
            keepWithNext=True
        ),
        'H4': ParagraphStyle(
            'H4_Custom',
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#334155'),
            spaceBefore=5,
            spaceAfter=2,
            keepWithNext=True
        ),
        'Body': ParagraphStyle(
            'Body_Custom',
            fontName='Helvetica',
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor('#334155'),
            spaceBefore=2,
            spaceAfter=3
        ),
        'Bullet': ParagraphStyle(
            'Bullet_Custom',
            fontName='Helvetica',
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#334155'),
            leftIndent=14,
            firstLineIndent=-10,
            spaceBefore=1,
            spaceAfter=1
        ),
        'Quote': ParagraphStyle(
            'Quote_Custom',
            fontName='Helvetica-Oblique',
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#475569'),
            leftIndent=12,
            rightIndent=12,
            spaceBefore=3,
            spaceAfter=3
        ),
        'Code': ParagraphStyle(
            'Code_Custom',
            fontName='Courier',
            fontSize=6.8,
            leading=8.6,
            textColor=colors.HexColor('#0f172a'),
            backColor=colors.HexColor('#f8fafc'),
            borderColor=colors.HexColor('#cbd5e1'),
            borderWidth=0.5,
            borderPadding=4,
            spaceBefore=3,
            spaceAfter=4
        ),
        'TableHeader': ParagraphStyle(
            'TH_Custom',
            fontName='Helvetica-Bold',
            fontSize=7,
            leading=9,
            textColor=colors.white,
            alignment=0
        ),
        'TableCell': ParagraphStyle(
            'TD_Custom',
            fontName='Helvetica',
            fontSize=7,
            leading=9,
            textColor=colors.HexColor('#1e293b')
        ),
    }

    story = []

    lines = content.split('\n')
    i = 0
    n = len(lines)

    in_code_block = False
    code_lines = []

    while i < n:
        raw_line = lines[i]
        line = raw_line.rstrip()

        # 1. Code Block Fence
        if line.startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_lines = []
            else:
                in_code_block = False
                raw_code = "\n".join(code_lines)
                escaped_code = html.escape(raw_code)
                # Use Preformatted directly with styled box - it handles page splits!
                pre = Preformatted(escaped_code, styles['Code'])
                story.append(pre)
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(raw_line)
            i += 1
            continue

        stripped = line.strip()
        if not stripped:
            i += 1
            continue

        # 2. Horizontal Rules
        if stripped in ('---', '***', '___'):
            story.append(Spacer(1, 3))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0'), spaceAfter=4, spaceBefore=3))
            i += 1
            continue

        # 3. Headings
        if stripped.startswith('# '):
            text = format_inline_markdown(stripped[2:].strip())
            story.append(Paragraph(text, styles['H1']))
            i += 1
            continue
        elif stripped.startswith('## '):
            text = format_inline_markdown(stripped[3:].strip())
            story.append(Paragraph(text, styles['H2']))
            i += 1
            continue
        elif stripped.startswith('### '):
            text = format_inline_markdown(stripped[4:].strip())
            story.append(Paragraph(text, styles['H3']))
            i += 1
            continue
        elif stripped.startswith('#### '):
            text = format_inline_markdown(stripped[5:].strip())
            story.append(Paragraph(text, styles['H4']))
            i += 1
            continue

        # 4. Blockquotes
        if stripped.startswith('>'):
            quote_text = stripped.lstrip('> ').strip()
            while i + 1 < n and lines[i + 1].strip().startswith('>'):
                i += 1
                quote_text += " " + lines[i].strip().lstrip('> ').strip()
            formatted_quote = format_inline_markdown(quote_text)
            p = Paragraph(formatted_quote, styles['Quote'])
            t = Table([[p]], colWidths=[printable_width])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
                ('LINELEFT', (0, 0), (0, -1), 2.5, colors.HexColor('#3b82f6')),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            story.append(Spacer(1, 2))
            story.append(t)
            story.append(Spacer(1, 2))
            i += 1
            continue

        # 5. Tables (| col1 | col2 |)
        if stripped.startswith('|') and stripped.endswith('|'):
            table_lines = []
            while i < n and lines[i].strip().startswith('|') and lines[i].strip().endswith('|'):
                table_lines.append(lines[i].strip())
                i += 1

            if len(table_lines) >= 2:
                raw_header = [c.strip() for c in table_lines[0][1:-1].split('|')]
                num_cols = len(raw_header)
                start_row = 2 if re.match(r'^\|?[\s\-:|]+\|?$', table_lines[1]) else 1

                col_w = printable_width / max(num_cols, 1)

                table_data = []
                header_row = [Paragraph(format_inline_markdown(h), styles['TableHeader']) for h in raw_header]
                table_data.append(header_row)

                for r_idx in range(start_row, len(table_lines)):
                    r_line = table_lines[r_idx]
                    raw_cells = [c.strip() for c in r_line[1:-1].split('|')]
                    while len(raw_cells) < num_cols:
                        raw_cells.append('')
                    raw_cells = raw_cells[:num_cols]
                    row_cells = [Paragraph(format_inline_markdown(c), styles['TableCell']) for c in raw_cells]
                    table_data.append(row_cells)

                t = Table(table_data, colWidths=[col_w] * num_cols, repeatRows=1)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                    ('TOPPADDING', (0, 0), (-1, -1), 2.5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
                    ('LEFTPADDING', (0, 0), (-1, -1), 3),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 3),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
                ]))
                story.append(Spacer(1, 2))
                story.append(t)
                story.append(Spacer(1, 3))
                continue

        # 6. Bullet Lists (- or * or +)
        list_match = re.match(r'^(\s*)[-*+]\s+(.*)$', line)
        if list_match:
            bullet_indent = len(list_match.group(1))
            bullet_body = list_match.group(2).strip()
            indent_pt = 14 + (bullet_indent // 2) * 8
            bullet_style = ParagraphStyle(
                f'B_{indent_pt}_{i}',
                parent=styles['Bullet'],
                leftIndent=indent_pt
            )
            formatted = "&bull; " + format_inline_markdown(bullet_body)
            story.append(Paragraph(formatted, bullet_style))
            i += 1
            continue

        # 7. Numbered Lists (1. )
        num_match = re.match(r'^(\s*)(\d+)\.\s+(.*)$', line)
        if num_match:
            num_indent = len(num_match.group(1))
            num_digit = num_match.group(2)
            num_body = num_match.group(3).strip()
            indent_pt = 14 + (num_indent // 2) * 8
            num_style = ParagraphStyle(
                f'N_{indent_pt}_{i}',
                parent=styles['Bullet'],
                leftIndent=indent_pt
            )
            formatted = f"<b>{num_digit}.</b> " + format_inline_markdown(num_body)
            story.append(Paragraph(formatted, num_style))
            i += 1
            continue

        # 8. Regular Body Paragraph
        para_text = stripped
        while i + 1 < n:
            next_line = lines[i + 1]
            next_stripped = next_line.strip()
            if (not next_stripped or
                next_stripped.startswith('#') or
                next_stripped.startswith('```') or
                next_stripped.startswith('|') or
                next_stripped.startswith('>') or
                re.match(r'^\s*[-*+]\s+', next_line) or
                re.match(r'^\s*\d+\.\s+', next_line) or
                next_stripped in ('---', '***', '___')):
                break
            para_text += " " + next_stripped
            i += 1

        formatted_para = format_inline_markdown(para_text)
        story.append(Paragraph(formatted_para, styles['Body']))
        i += 1

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {pdf_path}")


if __name__ == '__main__':
    base_dir = r"c:\Meet\xyz\oddo\DealFlow360"
    docs = [
        ("PROJECT_STATE.md", "PROJECT_STATE.pdf", "Project State Report"),
        ("APP_FLOW.md", "APP_FLOW.pdf", "Application Flow Architecture"),
        ("FRONTEND_EXPLAINED.md", "FRONTEND_EXPLAINED.pdf", "Frontend Architecture & Code Guide"),
        ("MATHEMATICS_AND_WORKFLOW_EXPLAINED.md", "MATHEMATICS_AND_WORKFLOW_EXPLAINED.pdf", "Mathematics & Workflow Engine")
    ]

    for md_name, pdf_name, title in docs:
        md_file = os.path.join(base_dir, md_name)
        pdf_file = os.path.join(base_dir, pdf_name)
        if os.path.exists(md_file):
            build_pdf_from_markdown(md_file, pdf_file, title)
        else:
            print(f"Skipping {md_name}: file not found.")
