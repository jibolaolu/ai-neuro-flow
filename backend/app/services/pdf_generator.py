"""
Generate a clinical assessment report PDF using reportlab.
Produces a professional, locked PDF matching NHS clinical report style.
"""

from __future__ import annotations

import io
import textwrap
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ── Brand colours ──────────────────────────────────────────────────────────────
BRAND_PURPLE = colors.HexColor("#7c5cfc")
BRAND_BLUE = colors.HexColor("#1d4ed8")
INK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#64748b")
LIGHT_GREY = colors.HexColor("#f1f5f9")
DIVIDER = colors.HexColor("#e2e8f0")


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ReportTitle",
            parent=base["Normal"],
            fontSize=20,
            fontName="Helvetica-Bold",
            textColor=INK,
            spaceAfter=4,
            leading=24,
        ),
        "subtitle": ParagraphStyle(
            "ReportSubtitle",
            parent=base["Normal"],
            fontSize=11,
            fontName="Helvetica",
            textColor=MUTED,
            spaceAfter=12,
            leading=15,
        ),
        "section_heading": ParagraphStyle(
            "SectionHeading",
            parent=base["Normal"],
            fontSize=12,
            fontName="Helvetica-Bold",
            textColor=BRAND_PURPLE,
            spaceBefore=14,
            spaceAfter=4,
            leading=16,
        ),
        "subsection_heading": ParagraphStyle(
            "SubsectionHeading",
            parent=base["Normal"],
            fontSize=10,
            fontName="Helvetica-Bold",
            textColor=INK,
            spaceBefore=8,
            spaceAfter=3,
            leading=14,
        ),
        "body": ParagraphStyle(
            "ReportBody",
            parent=base["Normal"],
            fontSize=10,
            fontName="Helvetica",
            textColor=INK,
            spaceAfter=6,
            leading=15,
        ),
        "label": ParagraphStyle(
            "FieldLabel",
            parent=base["Normal"],
            fontSize=8,
            fontName="Helvetica-Bold",
            textColor=MUTED,
            spaceAfter=2,
            leading=11,
            letterSpacing=0.5,
        ),
        "value": ParagraphStyle(
            "FieldValue",
            parent=base["Normal"],
            fontSize=10,
            fontName="Helvetica",
            textColor=INK,
            spaceAfter=8,
            leading=14,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["Normal"],
            fontSize=8,
            fontName="Helvetica",
            textColor=MUTED,
            alignment=TA_CENTER,
            leading=11,
        ),
        "confidential": ParagraphStyle(
            "Confidential",
            parent=base["Normal"],
            fontSize=9,
            fontName="Helvetica-Bold",
            textColor=colors.red,
            alignment=TA_RIGHT,
            leading=12,
        ),
    }


def _header_footer(canvas: Any, doc: Any, report_title: str, client_name: str, ref_no: str) -> None:
    """Draw page header and footer on every page."""
    canvas.saveState()
    w, h = A4
    margin = 20 * mm

    # ── Header bar ──────────────────────────────────────────────────────────
    canvas.setFillColor(INK)
    canvas.rect(margin, h - 25 * mm, w - 2 * margin, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(margin + 4 * mm, h - 20 * mm, "Neuro Flow Clinical Platform")
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(w - margin - 4 * mm, h - 20 * mm, "STRICTLY CONFIDENTIAL")

    # Purple accent line under header
    canvas.setFillColor(BRAND_PURPLE)
    canvas.rect(margin, h - 26 * mm, w - 2 * margin, 1.2 * mm, fill=1, stroke=0)

    # ── Footer ──────────────────────────────────────────────────────────────
    canvas.setFillColor(DIVIDER)
    canvas.rect(margin, 12 * mm, w - 2 * margin, 0.5 * mm, fill=1, stroke=0)

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(margin, 8 * mm, f"{report_title}  ·  {client_name}  ·  Ref: {ref_no}")
    canvas.drawRightString(w - margin, 8 * mm, f"Page {canvas.getPageNumber()}")

    canvas.restoreState()


def _meta_table(rows: list[tuple[str, str]], styles_map: dict) -> Table:
    """Render a two-column key/value info table."""
    data = []
    for label, value in rows:
        data.append([
            Paragraph(label.upper(), styles_map["label"]),
            Paragraph(value or "—", styles_map["value"]),
        ])
    t = Table(data, colWidths=[45 * mm, None])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return t


def generate_report_pdf(
    *,
    report_type: str,
    client_name: str,
    client_dob: str | None,
    client_nhs_ref: str | None,
    client_address: str | None,
    client_icb: str | None,
    gp_name: str | None,
    gp_address: str | None,
    date_of_assessment: str | None,
    place_of_assessment: str | None,
    assessed_by: str | None,
    sections: dict[str, str],
    clinician_name: str,
    clinician_credentials: str | None = None,
    report_id: str = "",
) -> bytes:
    """
    Generate a locked clinical report PDF.
    Returns raw bytes of the PDF.
    """
    buffer = io.BytesIO()
    st = _styles()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=32 * mm,
        bottomMargin=22 * mm,
        title=f"{report_type} — {client_name}",
        author="Neuro Flow Clinical Platform",
        subject=report_type,
        creator="Neuro Flow",
        encrypt=None,
    )

    ref_no = report_id or "—"
    issued_date = datetime.utcnow().strftime("%d %B %Y")

    story = []

    # ── Cover block ──────────────────────────────────────────────────────────
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(report_type, st["title"]))
    story.append(Paragraph(f"Assessment Report  ·  Issued {issued_date}", st["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=BRAND_PURPLE, spaceAfter=10))

    # ── Patient Information ───────────────────────────────────────────────────
    story.append(Paragraph("1. Patient Information", st["section_heading"]))
    patient_rows = [
        ("Patient Name", client_name),
        ("Date of Birth", client_dob or "—"),
        ("NHS Reference No.", client_nhs_ref or "—"),
        ("ICB / Pathway", client_icb or "—"),
        ("Address", client_address or "—"),
    ]
    story.append(_meta_table(patient_rows, st))
    story.append(Spacer(1, 3 * mm))

    # ── GP Information ────────────────────────────────────────────────────────
    story.append(Paragraph("GP Information", st["subsection_heading"]))
    gp_rows = [
        ("GP Name", gp_name or "—"),
        ("GP Address", gp_address or "—"),
    ]
    story.append(_meta_table(gp_rows, st))
    story.append(Spacer(1, 3 * mm))

    # ── Assessment Details ────────────────────────────────────────────────────
    story.append(Paragraph("Assessment Details", st["subsection_heading"]))
    assessment_rows = [
        ("Date of Assessment", date_of_assessment or "—"),
        ("Place of Assessment", place_of_assessment or "—"),
        ("Assessed By", assessed_by or clinician_name),
    ]
    story.append(_meta_table(assessment_rows, st))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceAfter=8))

    # ── Report sections ───────────────────────────────────────────────────────
    SECTION_LABELS = {
        "reason_for_referral": "2. Reason for Referral",
        "developmental_history": "3. Developmental and Background History",
        "childhood_behaviours": "3.1 Childhood Behaviours and Early Development",
        "family_history": "3.2 Family History",
        "educational_history": "4. Educational History",
        "occupational_history": "5. Occupational / Vocational History",
        "medical_history": "6. Medical History",
        "current_medications": "6.1 Current Medications",
        "psychiatric_history": "7. Psychiatric and Psychological History",
        "substance_use": "7.1 Substance Use History",
        "social_history": "8. Social History",
        "assessment_tools": "9. Assessment Tools and Results",
        "self_report_scores": "9.1 Standardised Assessment Scores",
        "mse": "10. Mental State Examination",
        "clinical_observations": "11. Clinical Observations",
        "formulation": "12. Formulation",
        "diagnosis": "13. Diagnosis",
        "differential_diagnosis": "13.1 Differential Diagnoses Considered",
        "recommendations": "14. Recommendations",
        "medication_recommendations": "14.1 Medication",
        "psychological_support": "14.2 Psychological and Behavioural Support",
        "practical_adjustments": "14.3 Workplace / Educational Adjustments",
        "further_assessment": "14.4 Further Assessment",
        "onward_referrals": "14.5 Onward Referrals",
        "summary": "15. Summary",
        "clinician_declaration": "16. Clinician Declaration",
    }

    for key, label in SECTION_LABELS.items():
        content = (sections.get(key) or "").strip()
        if not content:
            continue

        # Section heading style depends on depth (contains ".")
        parts = label.split(".")
        if len(parts) >= 3 or (len(parts) == 2 and parts[1] and not parts[1].strip().isdigit()):
            story.append(Paragraph(label, st["subsection_heading"]))
        else:
            story.append(Paragraph(label, st["section_heading"]))

        # Wrap long content into paragraphs
        for para_text in content.split("\n"):
            para_text = para_text.strip()
            if para_text:
                story.append(Paragraph(para_text, st["body"]))

    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND_PURPLE, spaceBefore=4, spaceAfter=8))

    # ── Signature block ───────────────────────────────────────────────────────
    story.append(Paragraph("Clinician Signature", st["subsection_heading"]))
    sig_rows = [
        ("Name", clinician_name),
        ("Credentials", clinician_credentials or "—"),
        ("Date Issued", issued_date),
        ("Report Reference", ref_no),
    ]
    story.append(_meta_table(sig_rows, st))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        "________________________________",
        ParagraphStyle("sig_line", parent=st["body"], textColor=MUTED, spaceBefore=2)
    ))
    story.append(Paragraph("Authorised signature", st["label"]))

    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(
        "This report is confidential and intended solely for the use of the named patient and their authorised healthcare providers. "
        "Unauthorised disclosure is prohibited. Generated by Neuro Flow Clinical Platform.",
        ParagraphStyle(
            "disclaimer",
            parent=st["body"],
            fontSize=8,
            textColor=MUTED,
            leading=12,
        ),
    ))

    # Build with header/footer callback
    doc.build(
        story,
        onFirstPage=lambda c, d: _header_footer(c, d, report_type, client_name, ref_no),
        onLaterPages=lambda c, d: _header_footer(c, d, report_type, client_name, ref_no),
    )

    return buffer.getvalue()
