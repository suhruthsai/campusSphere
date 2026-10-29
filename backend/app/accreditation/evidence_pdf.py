# Renders an accreditation report (metrics.build_report) as an A4 evidence pack for the IQAC:
# coverage summary, every criterion's metrics with their source and status, and the evidence gaps.
from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, CondPageBreak, Frame, KeepTogether, NextPageTemplate, PageTemplate, Paragraph, Spacer, Table,
    TableStyle,
)

from backend.app.student_services.pdf import COLLEGE_NAME, IST, NAVY, draw_footer, draw_letterhead

STATUS_LABELS = {"live": "Live records", "test_mode": "Test mode", "simulated": "Simulated", "missing": "Not captured"}
STATUS_COLORS = {"live": "#047857", "test_mode": "#B45309", "simulated": "#B45309", "missing": "#B91C1C"}
MAX_ROWS = 15

BODY = ParagraphStyle("body", fontName="Helvetica", fontSize=9, leading=12.5, textColor=colors.HexColor("#1E293B"))
SMALL = ParagraphStyle("small", parent=BODY, fontSize=8, leading=10.5, textColor=colors.HexColor("#475569"))
CELL = ParagraphStyle("cell", parent=BODY, fontSize=8, leading=10)
TITLE = ParagraphStyle("title", fontName="Times-Bold", fontSize=17, leading=21, alignment=1, textColor=colors.black)
SUBTITLE = ParagraphStyle("subtitle", parent=BODY, alignment=1, textColor=colors.HexColor("#334155"))
H1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=NAVY, spaceBefore=6, spaceAfter=4)
H2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=colors.HexColor("#0F172A"))


def _p(text, style=CELL):
    return Paragraph(escape(str(text if text is not None else "—")), style)


def _grid(rows, widths, header=True):
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")))
    t.setStyle(TableStyle(style))
    return t


def _status(status):
    color = STATUS_COLORS.get(status, "#334155")
    return Paragraph(f'<font color="{color}"><b>{STATUS_LABELS.get(status, status)}</b></font>', CELL)


def _metric_block(m: dict) -> list:
    width = 170 * mm
    out = [Paragraph(f"{escape(m['title'])} <font size=8 color='#64748B'>· {escape(m['indicator'])}</font>", H2),
           Spacer(1, 1.5 * mm)]
    out.append(_grid([[_p("Value", CELL), _p("Status", CELL), _p("Source", CELL)],
                      [Paragraph(f"<b>{escape(str(m['value']))}</b>", CELL), _status(m["status"]), _p(m.get("source") or "—", SMALL)]],
                     [62 * mm, 30 * mm, 78 * mm]))
    if m.get("detail"):
        out += [Spacer(1, 1.2 * mm), _p(m["detail"], SMALL)]
    if m.get("fix"):
        out += [Spacer(1, 1 * mm), Paragraph(f"<b>To close this gap:</b> {escape(m['fix'])}", SMALL)]
    table = m.get("table")
    if table and table.get("rows"):
        cols = table["columns"]
        rows = table["rows"][:MAX_ROWS]
        out += [Spacer(1, 1.5 * mm),
                _grid([[_p(c) for c in cols]] + [[_p(v) for v in r] for r in rows], [width / len(cols)] * len(cols))]
        if len(table["rows"]) > MAX_ROWS:
            out.append(_p(f"+ {len(table['rows']) - MAX_ROWS} more rows in CampusSphere.", SMALL))
    return [KeepTogether(out[:4]), *out[4:], Spacer(1, 5 * mm)]


def _draft_mark(c):
    """Across every page when the figures rest on demonstration data: such a pack must never be filed."""
    W, H = A4
    c.saveState()
    c.setFillColor(colors.Color(0.8, 0.1, 0.1, alpha=0.13))
    c.setFont("Helvetica-Bold", 30)
    c.translate(W / 2, H / 2)
    c.rotate(40)
    c.drawCentredString(0, 12, "DRAFT - CONTAINS DEMONSTRATION DATA")
    c.drawCentredString(0, -26, "NOT FOR SUBMISSION TO NAAC / NBA")
    c.restoreState()


def render_evidence_pack(report: dict, demonstration: bool = False) -> bytes:
    fw = report["framework"]
    scope = report["scope"]
    generated = (datetime.fromisoformat(report["generated_at"]) + IST).strftime("%d-%m-%Y %H:%M IST")
    footer = (f"{COLLEGE_NAME} · {fw['name']} evidence pack · {scope['label']} · generated {generated}",
              "Figures are computed from live records; items marked Simulated, Test mode or Not captured must not be filed as evidence.")

    def first(c, _doc):
        draw_letterhead(c)
        draw_footer(c, *footer)
        if demonstration:
            _draft_mark(c)

    def later(c, doc):
        W, H = A4
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(NAVY)
        c.drawString(20 * mm, H - 12 * mm, f"{COLLEGE_NAME} · {fw['name']} evidence pack · {scope['short']}")
        c.drawRightString(W - 20 * mm, H - 12 * mm, f"Page {doc.page}")
        draw_footer(c, *footer)
        if demonstration:
            _draft_mark(c)

    buf = BytesIO()
    W, H = A4
    doc = BaseDocTemplate(buf, pagesize=A4, title=f"{fw['name']} evidence pack · {scope['label']}", author="CampusSphere")
    doc.addPageTemplates([
        PageTemplate("first", [Frame(20 * mm, 16 * mm, W - 40 * mm, H - 66 * mm, id="f1")], onPage=first),
        PageTemplate("later", [Frame(20 * mm, 16 * mm, W - 40 * mm, H - 36 * mm, id="f2")], onPage=later),
    ])

    cov = report["coverage"]
    story = [
        NextPageTemplate("later"),
        Paragraph(f"{escape(fw['name'])} EVIDENCE PACK", TITLE),
        Paragraph(f"<b>{escape(scope['label'])}</b>" + ("" if scope["id"] == "both" else f" · {escape(scope['pilot'])}"), SUBTITLE),
        Paragraph(escape(fw["long_name"]) + f" · Academic year {escape(report['academic_year'])}", SUBTITLE),
        Paragraph(f"Generated {generated}", SUBTITLE),
        Spacer(1, 6 * mm),
        Paragraph("Evidence coverage", H1),
        _grid([[_p("Live records"), _p("Test mode"), _p("Simulated"), _p("Not captured"), _p("Metrics")],
               [_p(cov["live"]), _p(cov["test_mode"]), _p(cov["simulated"]), _p(cov["missing"]), _p(cov["total"])]],
              [34 * mm] * 5),
        Spacer(1, 2 * mm),
        _p(f"{cov['percent']}% of the mapped metrics are backed by live records. {report['note']}", SMALL),
        Spacer(1, 4 * mm),
        _grid([[_p("Criterion"), _p("Metrics"), _p("Live"), _p("Gaps")]] +
              [[_p(f"{c['code']} · {c['title']}"), _p(c["coverage"]["total"]), _p(c["coverage"]["live"]),
                _p(c["coverage"]["missing"] + c["coverage"]["simulated"])] for c in report["criteria"]],
              [100 * mm, 24 * mm, 22 * mm, 24 * mm]),
    ]

    for crit in report["criteria"]:
        story += [CondPageBreak(60 * mm), Paragraph(f"{escape(crit['code'])} · {escape(crit['title'])}", H1)]
        if not crit["metrics"]:
            story += [_p("No CampusSphere data is mapped to this criterion yet.", SMALL), Spacer(1, 4 * mm)]
        for m in crit["metrics"]:
            story += _metric_block(m)

    if report["gaps"]:
        story += [CondPageBreak(60 * mm), Paragraph("Evidence gaps and how to close them", H1),
                  _grid([[_p("Criterion"), _p("What's missing"), _p("How to close it")]] +
                        [[_p(f"{g['criterion']} · {g['indicator']}"), _p(f"{g['title']}. {g['why'] or ''}"), _p(g.get("fix") or
                          "Record real data in CampusSphere (see the metric).")] for g in report["gaps"]],
                        [45 * mm, 62 * mm, 63 * mm])]

    doc.build(story)
    return buf.getvalue()
