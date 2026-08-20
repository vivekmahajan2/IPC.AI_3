"""PDF generation service using ReportLab for FIR documents."""

import io
from datetime import datetime
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib import colors


def generate_fir_pdf(
    fir_number: Optional[str],
    title: str,
    incident_details: dict,
    sections_applied: list[str],
    status: str,
    created_at: Optional[datetime] = None,
    officer_name: str = "",
    station: str = "",
) -> bytes:
    """
    Generate an Indian FIR-format PDF and return as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "FIRTitle",
        parent=styles["Title"],
        fontSize=16,
        spaceAfter=6 * mm,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#1A56DB"),
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=11,
        alignment=TA_CENTER,
        spaceAfter=4 * mm,
        textColor=colors.HexColor("#6B7280"),
    )
    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=12,
        spaceBefore=6 * mm,
        spaceAfter=3 * mm,
        textColor=colors.HexColor("#1F2937"),
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        alignment=TA_JUSTIFY,
    )
    label_style = ParagraphStyle(
        "Label",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#6B7280"),
    )

    elements = []

    # Header
    elements.append(Paragraph("FIRST INFORMATION REPORT", title_style))
    elements.append(Paragraph("(Under Section 154 Cr.P.C. / Section 173 BNSS)", subtitle_style))

    if fir_number:
        elements.append(Paragraph(f"FIR No: <b>{fir_number}</b>", body_style))
    elements.append(Paragraph(f"Date: {(created_at or datetime.now()).strftime('%d-%m-%Y %H:%M')}", body_style))
    if station:
        elements.append(Paragraph(f"Police Station: <b>{station}</b>", body_style))

    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E5E7EB")))
    elements.append(Spacer(1, 4 * mm))

    # Title
    elements.append(Paragraph(f"<b>Subject:</b> {title}", body_style))
    elements.append(Spacer(1, 2 * mm))

    # Complainant Details
    complainant_fields = [
        ("complainant_name", "Name of Complainant"),
        ("complainant_father_name", "Father's/Husband's Name"),
        ("complainant_address", "Address"),
        ("complainant_phone", "Phone"),
    ]
    has_complainant = any(incident_details.get(f) for f, _ in complainant_fields)
    if has_complainant:
        elements.append(Paragraph("Complainant Details", heading_style))
        for field_key, field_label in complainant_fields:
            value = incident_details.get(field_key, "")
            if value:
                elements.append(Paragraph(f"<b>{field_label}:</b> {value}", body_style))

    # Incident Details
    elements.append(Paragraph("Incident Details", heading_style))
    incident_fields = [
        ("incident_date", "Date of Incident"),
        ("incident_time", "Time of Incident"),
        ("incident_place", "Place of Occurrence"),
        ("district", "District"),
    ]
    for field_key, field_label in incident_fields:
        value = incident_details.get(field_key, "")
        if value:
            elements.append(Paragraph(f"<b>{field_label}:</b> {value}", body_style))

    # Description
    description = incident_details.get("description", "")
    if description:
        elements.append(Spacer(1, 2 * mm))
        elements.append(Paragraph("<b>Description of Offence:</b>", body_style))
        elements.append(Paragraph(description, body_style))

    # Accused Details
    accused_fields = [
        ("accused_name", "Name of Accused"),
        ("accused_description", "Description of Accused"),
    ]
    has_accused = any(incident_details.get(f) for f, _ in accused_fields)
    if has_accused:
        elements.append(Paragraph("Accused Details", heading_style))
        for field_key, field_label in accused_fields:
            value = incident_details.get(field_key, "")
            if value:
                elements.append(Paragraph(f"<b>{field_label}:</b> {value}", body_style))

    # Witness & Property
    witness = incident_details.get("witness_details", "")
    if witness:
        elements.append(Paragraph("Witnesses", heading_style))
        elements.append(Paragraph(witness, body_style))

    property_stolen = incident_details.get("property_stolen", "")
    if property_stolen:
        elements.append(Paragraph("Property Stolen/Involved", heading_style))
        elements.append(Paragraph(property_stolen, body_style))
        value_str = incident_details.get("property_value", "")
        if value_str:
            elements.append(Paragraph(f"<b>Estimated Value:</b> ₹{value_str}", body_style))

    # Sections Applied
    if sections_applied:
        elements.append(Paragraph("Sections Applied", heading_style))
        sections_text = ", ".join(sections_applied)
        elements.append(Paragraph(sections_text, body_style))

    # Status
    elements.append(Spacer(1, 6 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E5E7EB")))
    elements.append(Spacer(1, 4 * mm))
    elements.append(Paragraph(f"<b>Status:</b> {status.upper()}", body_style))
    if officer_name:
        elements.append(Paragraph(f"<b>Reporting Officer:</b> {officer_name}", body_style))

    # Build PDF
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
