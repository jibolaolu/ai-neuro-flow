"""PDF export for contractor invoice requests (ReportLab)."""

from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.clinician_finance import InvoiceRequestRecord, TimesheetLineRecord


def build_invoice_request_pdf(
    inv: InvoiceRequestRecord,
    clinician_name: str,
    lines: list[TimesheetLineRecord],
    *,
    watermark: str | None,
) -> bytes:
    """Returns PDF bytes. `watermark` is shown when not approved (e.g. draft / pending)."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="Title",
        parent=styles["Heading1"],
        fontSize=16,
        spaceAfter=12,
        textColor=colors.HexColor("#1e3a5f"),
    )
    story: list = []

    if watermark:
        story.append(
            Paragraph(
                f"<b>{watermark}</b>",
                ParagraphStyle(name="W", parent=styles["Normal"], textColor=colors.HexColor("#b45309"), fontSize=11),
            )
        )
        story.append(Spacer(1, 8))

    story.append(Paragraph("Neuro Flow - Contractor invoice summary", title_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"<b>Invoice reference:</b> {inv.id}", styles["Normal"]))
    story.append(Paragraph(f"<b>Clinician:</b> {clinician_name}", styles["Normal"]))
    story.append(
        Paragraph(
            f"<b>Period:</b> {inv.period_from.isoformat()} to {inv.period_to.isoformat()}",
            styles["Normal"],
        )
    )
    story.append(
        Paragraph(
            f"<b>Totals:</b> {inv.line_count or 0} line(s), {(inv.total_hours or 0):.2f} hours",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 12))

    data = [["Date", "Hours", "Description", "Ref"]]
    for ln in sorted(lines, key=lambda x: (x.activity_date, x.id)):
        data.append(
            [
                ln.activity_date.isoformat(),
                f"{ln.hours:.2f}",
                ln.description[:120],
                (ln.client_ref or "-")[:40],
            ]
        )

    t = Table(data, colWidths=[2.6 * cm, 2 * cm, 9 * cm, 3 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#334155")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 14))

    if inv.notes:
        story.append(Paragraph("<b>Your notes</b>", styles["Normal"]))
        story.append(Paragraph(escape(inv.notes).replace("\n", "<br/>"), styles["Normal"]))
        story.append(Spacer(1, 8))

    story.append(
        Paragraph(
            "<i>This document is generated from Neuro Flow. Approval status reflects Clinical Admin review.</i>",
            styles["Normal"],
        )
    )

    doc.build(story)
    out = buf.getvalue()
    buf.close()
    return out
