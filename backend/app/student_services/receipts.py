# PDF slips for the joining process: fee payment receipts and the acknowledgement a student
# receives when the Admin Office takes in their original certificates.
from datetime import datetime, timedelta
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle

from backend.app.student_services.pdf import NAVY, draw_footer, draw_letterhead

IST = timedelta(hours=5, minutes=30)


def _ist(dt: datetime) -> str:
    return (dt + IST).strftime("%d-%m-%Y %H:%M") + " IST"


def _rupees(n: int) -> str:
    """Indian digit grouping: 125000 -> 1,25,000."""
    s = str(int(n))
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ",".join(groups + [tail])


def _title(c, text, y):
    W, _ = A4
    c.setFillColor(colors.black)
    c.setFont("Times-Bold", 16)
    c.drawCentredString(W / 2, y, text)
    tw = c.stringWidth(text, "Times-Bold", 16)
    c.setLineWidth(0.8)
    c.line(W / 2 - tw / 2, y - 1.5 * mm, W / 2 + tw / 2, y - 1.5 * mm)


def _table(c, rows, widths, y, header=True, align_right_cols=()):
    t = Table(rows, colWidths=widths)
    style = [
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9.5),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#94A3B8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    if header:
        style += [("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9.5),
                  ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0"))]
    for col in align_right_cols:
        style.append(("ALIGN", (col, 0), (col, -1), "RIGHT"))
    t.setStyle(TableStyle(style))
    _, h = t.wrap(170 * mm, 200 * mm)
    t.drawOn(c, 20 * mm, y - h)
    return y - h


def _student_rows(user, admission=None, profile=None):
    """Student block for slips: from the joining application, else the academic profile."""
    if admission is not None:
        return [
            ["Student", admission.full_name or user.name],
            ["Branch", f"B.E. ({admission.branch})" if admission.branch else "—"],
            ["TGEAPCET hall ticket / rank", f"{admission.hall_ticket_no or '—'}  /  {admission.eapcet_rank or '—'}"],
            ["Roll no.", admission.roll_no or "To be assigned at enrolment"],
            ["Academic year", admission.academic_year],
        ]
    return [
        ["Student", user.name],
        ["Course", f"{getattr(profile, 'program', None) or 'B.E.'} ({getattr(profile, 'department', None) or user.department or '—'})"],
        ["Roll no.", getattr(profile, "roll_no", None) or user.roll_no or "—"],
    ]


def render_payment_receipt(payment, user, admission=None, profile=None) -> bytes:
    buf = BytesIO()
    W, H = A4
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Fee receipt {payment.receipt_no}")
    draw_letterhead(c)
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, H - 53 * mm, f"Receipt No.: {payment.receipt_no}")
    c.drawRightString(W - 20 * mm, H - 53 * mm, f"Paid: {_ist(payment.paid_at)}")
    _title(c, "FEE RECEIPT", H - 68 * mm)

    y = _table(c, _student_rows(user, admission, profile), [55 * mm, 115 * mm], H - 78 * mm, header=False)
    rows = [["#", "Fee", "Amount (Rs.)"]]  # the built-in PDF fonts have no ₹ glyph
    for i, item in enumerate(payment.items, 1):
        rows.append([str(i), item["name"], _rupees(item["amount"])])
    rows.append(["", "Total paid", _rupees(payment.amount)])
    y = _table(c, rows, [10 * mm, 120 * mm, 40 * mm], y - 8 * mm, align_right_cols=(2,))

    c.setFont("Helvetica", 9.5)
    y -= 9 * mm
    c.drawString(20 * mm, y, f"Payment reference: {payment.provider_payment_id}")
    if payment.details.get("bus_boarding_point"):
        y -= 5.5 * mm
        c.drawString(20 * mm, y, f"Bus boarding point: {payment.details['bus_boarding_point']}")
    if payment.provider == "test":
        y -= 9 * mm
        c.setFillColor(colors.HexColor("#B45309"))
        c.setFont("Helvetica-Bold", 10)
        c.drawString(20 * mm, y, "TEST MODE — no money was charged. This receipt is for demonstration only.")
    draw_footer(c, "Computer-generated receipt; no signature required.", "MVSR Engineering College · Nadergul, Hyderabad")
    c.showPage()
    c.save()
    return buf.getvalue()


def render_originals_ack(ack_no, records, user, admission, received_by, received_at) -> bytes:
    buf = BytesIO()
    W, H = A4
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Acknowledgement {ack_no}")
    draw_letterhead(c)
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, H - 53 * mm, f"Ack. No.: {ack_no}")
    c.drawRightString(W - 20 * mm, H - 53 * mm, f"Received: {_ist(received_at)}")
    _title(c, "ACKNOWLEDGEMENT OF ORIGINAL CERTIFICATES", H - 68 * mm)

    y = _table(c, _student_rows(user, admission), [55 * mm, 115 * mm], H - 78 * mm, header=False)
    rows = [["#", "Original certificate received"]]
    for i, r in enumerate(records, 1):
        rows.append([str(i), r.label])
    y = _table(c, rows, [10 * mm, 160 * mm], y - 8 * mm)

    c.setFillColor(colors.black)
    c.setFont("Times-Roman", 11.5)
    y -= 10 * mm
    for line in [
        "The above original certificates have been received by the college and will be kept in safe custody.",
        "They will be returned on completion or discontinuation of the course, or lent temporarily on request",
        "through the Admin Office. Please keep this acknowledgement safe.",
    ]:
        c.drawString(20 * mm, y, line)
        y -= 6 * mm
    c.setFont("Helvetica-Oblique", 9)
    c.drawRightString(W - 20 * mm, 40 * mm, f"Received by {received_by}")
    c.setFont("Times-Bold", 12)
    c.drawRightString(W - 20 * mm, 33 * mm, "ADMIN OFFICE")
    c.setFillColor(NAVY)
    draw_footer(c, "Computer-generated acknowledgement.", "MVSR Engineering College · Nadergul, Hyderabad")
    c.showPage()
    c.save()
    return buf.getvalue()


def render_no_dues_certificate(exit_rec, items, user, profile, unit_labels) -> bytes:
    """Certificate that every unit has cleared the student (issued once the exit is fully cleared)."""
    buf = BytesIO()
    W, H = A4
    c = canvas.Canvas(buf, pagesize=A4)
    ref = f"MVSR/NDC/{exit_rec.cleared_at.year}/{exit_rec.id:05d}"
    c.setTitle(f"No-dues certificate {ref}")
    draw_letterhead(c)
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, H - 53 * mm, f"Ref. No.: {ref}")
    c.drawRightString(W - 20 * mm, H - 53 * mm, f"Cleared: {_ist(exit_rec.cleared_at)}")
    _title(c, "NO-DUES CERTIFICATE", H - 68 * mm)

    rows = _student_rows(user, None, profile) + [
        ["Reason for leaving", exit_rec.reason],
        ["Date of leaving", exit_rec.leaving_date.strftime("%d-%m-%Y")],
    ]
    y = _table(c, rows, [55 * mm, 115 * mm], H - 78 * mm, header=False)
    cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=9.5, leading=11.5)
    rows = [["Unit", "Status", "Cleared by", "On (IST)"]]
    for it in items:
        status = "Cleared" + (" (dues paid online)" if it.payment_id else " (dues settled at counter)" if it.dues_amount else "")
        when = (it.acted_at + IST).strftime("%d-%m-%Y %H:%M") if it.acted_at else "—"
        rows.append([unit_labels.get(it.unit, it.unit), Paragraph(status, cell), Paragraph(it.acted_by or "—", cell), when])
    y = _table(c, rows, [36 * mm, 42 * mm, 60 * mm, 32 * mm], y - 8 * mm)

    c.setFillColor(colors.black)
    c.setFont("Times-Roman", 11.5)
    c.drawString(20 * mm, y - 10 * mm, "Certified that the student has no dues to any section of the college.")
    c.setFont("Times-Bold", 12)
    c.drawRightString(W - 20 * mm, 33 * mm, "ADMIN OFFICE")
    draw_footer(c, "Computer-generated certificate based on the online no-dues clearance.", "MVSR Engineering College · Nadergul, Hyderabad")
    c.showPage()
    c.save()
    return buf.getvalue()
