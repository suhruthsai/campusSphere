# Renders an approved document request as an A4 PDF: letterhead, certificate text,
# the approval trail and a QR code that links to the public verification page.
from datetime import datetime, timedelta
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfgen import canvas

from backend.app.core.config import settings
from backend.app.models.services import DocumentRequestModel
from backend.app.student_services.catalog import NOC_DATED_PURPOSES, OTHER

# Placeholder letterhead until the college supplies its official one
COLLEGE_NAME = "MVSR ENGINEERING COLLEGE"
COLLEGE_LINES = [
    "(Autonomous) · Affiliated to Osmania University, Hyderabad",
    "Nadergul, Hyderabad – 501 510, Telangana",
]
NAVY = colors.HexColor("#0D2137")
IST = timedelta(hours=5, minutes=30)
YEAR_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV"}


def verify_url(code: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/verify/{code}"


def _ist(iso_or_dt) -> datetime:
    dt = datetime.fromisoformat(iso_or_dt) if isinstance(iso_or_dt, str) else iso_or_dt
    return dt + IST


def _date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).strftime("%d-%m-%Y")
    except (TypeError, ValueError):
        return iso or ""


def _person(student: dict):
    """Honorific, relation and pronoun for the certificate text."""
    gender = (student.get("gender") or "").lower()
    if gender == "male":
        return "Mr.", "S/o", "his"
    if gender == "female":
        return "Ms.", "D/o", "her"
    return "", "child of", "their"


def _purpose_text(req: DocumentRequestModel) -> str:
    details = req.details or {}
    if req.purpose == OTHER:
        return details.get("purpose_details") or "personal use"
    return req.purpose


def certificate_body(req: DocumentRequestModel) -> tuple[str, list[str]]:
    """Title and paragraphs (ReportLab mini-markup, values escaped)."""
    s = req.student or {}
    honor, relation, pronoun = _person(s)
    name = escape(f"{honor} {s.get('name', '')}".strip())
    parent = f", {relation} {escape(s['parent_name'])}," if s.get("parent_name") else ","
    year = YEAR_ROMAN.get(s.get("year"), str(s.get("year") or ""))
    course = escape(f"{s.get('program', 'B.E.')} ({s.get('department', '')})")
    section = f", Section {escape(s['section'])}" if s.get("section") else ""
    roll = escape(s.get("roll_no") or "—")
    ay = escape(s.get("academic_year", ""))
    details = req.details or {}

    if req.doc_type == "bonafide":
        return "BONAFIDE CERTIFICATE", [
            f"This is to certify that <b>{name}</b>{parent} bearing Roll No. <b>{roll}</b>, is a bonafide "
            f"student of this college, studying <b>{course} {year} Year</b>{section}, during the academic "
            f"year {ay}.",
            f"This certificate is issued at the request of the student for the purpose of "
            f"<b>{escape(_purpose_text(req))}</b>.",
        ]

    # ── Leaving documents (V3): student snapshot carries the exit details ──
    he = {"his": "He", "her": "She", "their": "They"}[pronoun]
    left_on = _date(s.get("leaving_date")) if s.get("leaving_date") else "—"
    reason = escape(s.get("exit_reason") or "—")
    since = f" from the academic year {escape(str(s['admitted_year']))}" if s.get("admitted_year") else ""
    issued_for = f"This certificate is issued at the request of the student for the purpose of <b>{escape(_purpose_text(req))}</b>."

    if req.doc_type == "tc":
        dob = _date(s["date_of_birth"]) if s.get("date_of_birth") else "As per the SSC records"
        return "TRANSFER CERTIFICATE", [
            f"This is to certify that <b>{name}</b>{parent} bearing Roll No. <b>{roll}</b>, was a student of "
            f"this college in <b>{course}</b>{since}, and left the college on <b>{left_on}</b>.",
            [("Date of birth", dob), ("Reason for leaving", reason),
             ("Last class studied", f"{course} {year} Year"), ("Dues to the college", "Nil (no-dues cleared)")],
            f"{he} {'were' if he == 'They' else 'was'} of good conduct and character during the period of study.",
            issued_for,
        ]
    if req.doc_type == "conduct":
        return "CONDUCT CERTIFICATE", [
            f"This is to certify that <b>{name}</b>{parent} bearing Roll No. <b>{roll}</b>, was a student of "
            f"this college in <b>{course}</b>{since} until <b>{left_on}</b>.",
            f"During the period of study, {pronoun} conduct and character were <b>good</b>.",
            issued_for,
        ]
    if req.doc_type == "course_completion":
        return "COURSE COMPLETION CERTIFICATE", [
            f"This is to certify that <b>{name}</b>{parent} bearing Roll No. <b>{roll}</b>, has successfully "
            f"completed the four-year <b>{course}</b> programme of this college{since}, the course having been "
            f"completed on <b>{left_on}</b>.",
            "The degree is awarded by Osmania University, Hyderabad, to which the college is affiliated.",
            issued_for,
        ]
    if req.doc_type == "moi":
        studying = s.get("leaving_date") is None
        return "MEDIUM OF INSTRUCTION CERTIFICATE", [
            f"This is to certify that <b>{name}</b>{parent} bearing Roll No. <b>{roll}</b>, "
            + (f"is studying <b>{course} {year} Year</b> in this college." if studying
               else f"was a student of <b>{course}</b> in this college{since} until <b>{left_on}</b>."),
            "The medium of instruction and examination for the entire programme is <b>English</b>.",
            issued_for,
        ]

    # NOC
    org = escape(details.get("organization", ""))
    where = f", {escape(details['location'])}" if details.get("location") else ""
    period = ""
    if req.purpose in NOC_DATED_PURPOSES and details.get("from_date") and details.get("to_date"):
        period = f" from <b>{_date(details['from_date'])}</b> to <b>{_date(details['to_date'])}</b>"
    activity = {
        "Internship": f"undertaking an internship at <b>{org}</b>{where}{period}",
        "Hackathon / competition": f"participating in <b>{org}</b>{where}{period}",
        "Part-time work": f"taking up part-time work at <b>{org}</b>{where}{period}",
        "Higher studies / entrance exam": f"applying for <b>{org}</b>{where}",
        "Passport": "applying for a passport",
    }.get(req.purpose, f"{escape(_purpose_text(req))} (<b>{org}</b>{where}){period}")
    return "NO OBJECTION CERTIFICATE", [
        f"This is to certify that <b>{name}</b>{parent} bearing Roll No. <b>{roll}</b>, is a bonafide "
        f"student of this college, studying <b>{course} {year} Year</b>{section}, during the academic "
        f"year {ay}.",
        f"The college has <b>no objection</b> to {pronoun} {activity}, provided it does not affect "
        f"{pronoun} regular academic work and attendance.",
        "This certificate is issued at the request of the student.",
    ]


def draw_letterhead(c: canvas.Canvas) -> None:
    """College letterhead across the top of an A4 page (shared by certificates and receipts)."""
    W, H = A4
    c.setFillColor(NAVY)
    c.rect(0, H - 8 * mm, W, 8 * mm, fill=1, stroke=0)
    c.setFont("Times-Bold", 22)
    c.drawCentredString(W / 2, H - 24 * mm, COLLEGE_NAME)
    c.setFont("Helvetica", 9.5)
    c.setFillColor(colors.HexColor("#334155"))
    for i, line in enumerate(COLLEGE_LINES):
        c.drawCentredString(W / 2, H - (31 + i * 5) * mm, line)
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.4)
    c.line(20 * mm, H - 43 * mm, W - 20 * mm, H - 43 * mm)
    c.setLineWidth(0.4)
    c.line(20 * mm, H - 44.2 * mm, W - 20 * mm, H - 44.2 * mm)


def draw_footer(c: canvas.Canvas, *lines: str) -> None:
    W, _ = A4
    c.setFillColor(NAVY)
    c.rect(0, 0, W, 12 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 7.5)
    for i, line in enumerate(lines[:2]):
        c.drawCentredString(W / 2, (6.5 - i * 3.5) * mm, line)


def render_pdf(req: DocumentRequestModel) -> bytes:
    if req.status != "approved":
        raise ValueError("Only approved requests can be rendered")
    buf = BytesIO()
    W, H = A4
    c = canvas.Canvas(buf, pagesize=A4)
    title, paragraphs = certificate_body(req)
    c.setTitle(f"{title.title()} — {req.ref_no}")
    c.setAuthor(COLLEGE_NAME)

    draw_letterhead(c)

    # ── Ref no & date ──
    issued = _ist(req.issued_at)
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, H - 53 * mm, f"Ref. No.: {req.ref_no}")
    c.drawRightString(W - 20 * mm, H - 53 * mm, f"Date: {issued.strftime('%d-%m-%Y')}")

    # ── Title ──
    c.setFont("Times-Bold", 17)
    c.drawCentredString(W / 2, H - 70 * mm, title)
    tw = c.stringWidth(title, "Times-Bold", 17)
    c.setLineWidth(0.8)
    c.line(W / 2 - tw / 2, H - 71.5 * mm, W / 2 + tw / 2, H - 71.5 * mm)

    # ── Body ──
    body = ParagraphStyle("body", fontName="Times-Roman", fontSize=12.5, leading=20,
                          alignment=TA_JUSTIFY, firstLineIndent=12 * mm)
    y = H - 84 * mm
    width = W - 40 * mm
    cell = ParagraphStyle("cell", fontName="Times-Roman", fontSize=11.5, leading=14)
    for text in paragraphs:
        if isinstance(text, list):  # particulars: (label, value) rows drawn as a table
            rows = [[Paragraph(f"<b>{k}</b>", cell), Paragraph(v, cell)] for k, v in text]
            p = Table(rows, colWidths=[50 * mm, 108 * mm])
            p.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#94A3B8")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            _, h = p.wrap(width, H)
            y -= h
            p.drawOn(c, 26 * mm, y)
            y -= 6 * mm
            continue
        p = Paragraph(text, body)
        _, h = p.wrap(width, H)
        y -= h
        p.drawOn(c, 20 * mm, y)
        y -= 5 * mm

    # ── Approval trail ──
    y -= 4 * mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(NAVY)
    c.drawString(20 * mm, y, "DIGITAL APPROVAL TRAIL")
    y -= 2 * mm
    rows = [["#", "Role", "Approved by", "Date & time (IST)"]]
    for i, s in enumerate(req.steps, 1):
        when = _ist(s["acted_at"]).strftime("%d-%m-%Y %H:%M") if s.get("acted_at") else ""
        rows.append([str(i), s["label"], s.get("acted_by_name") or s["approver_name"], when])
    table = Table(rows, colWidths=[8 * mm, 38 * mm, 84 * mm, 40 * mm])  # = full 170 mm text width
    table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8.5),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 8.5),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#94A3B8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    _, th = table.wrap(width, H)
    y -= th
    table.drawOn(c, 20 * mm, y)

    # ── QR (left) and Principal's digital approval (right) ──
    url = verify_url(req.verify_code)
    qr = QrCodeWidget(url)
    x0, y0, x1, y1 = qr.getBounds()
    size = 32 * mm
    d = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    d.add(qr)
    qr_y = 34 * mm
    renderPDF.draw(d, c, 20 * mm, qr_y)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.HexColor("#334155"))
    c.drawString(20 * mm, qr_y - 4 * mm, "Scan to verify authenticity")
    c.drawString(20 * mm, qr_y - 8 * mm, f"Verification code: {req.verify_code}")

    principal = req.steps[-1]
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Oblique", 8.5)
    c.drawRightString(W - 20 * mm, qr_y + 22 * mm, f"Digitally approved by {principal.get('acted_by_name') or principal['approver_name']}")
    c.drawRightString(W - 20 * mm, qr_y + 17 * mm, f"on {_ist(principal['acted_at']).strftime('%d-%m-%Y %H:%M')} IST")
    c.setFont("Times-Bold", 13)
    c.drawRightString(W - 20 * mm, qr_y + 8 * mm, "PRINCIPAL")
    c.setFont("Helvetica", 9)
    c.drawRightString(W - 20 * mm, qr_y + 3 * mm, COLLEGE_NAME.title().replace("Mvsr", "MVSR"))

    draw_footer(c, "This document is digitally approved and does not require a physical signature.", f"Verify at {url}")

    c.showPage()
    c.save()
    return buf.getvalue()
