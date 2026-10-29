"""
Printable login slips: one PDF per section (e.g. IT-3A.pdf), 10 cut-out slips to an A4 page, each with the student's
name, roll number, temporary password, mentor and how to sign in. Class in-charges hand them out in class, so nobody
reads passwords off a screen. Passwords come from student_accounts.local.txt (written by create_student_accounts.py).

Students who have already chosen their own password get no slip (theirs would no longer work).
The PDFs hold passwords: they go to backend/app/db/login_slips.local/ (git-ignored). Shred spare slips.

Usage (from the project root):
    python backend/app/db/print_login_slips.py --branch IT
    python backend/app/db/print_login_slips.py --branch IT --section IT-3A
"""
import argparse
import sys
from collections import defaultdict
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.db.migrations import ensure_columns  # noqa: E402
from backend.app.db.session import SessionLocal, engine  # noqa: E402
from backend.app.models.campus import UserModel  # noqa: E402
from backend.app.models.services import ApproverAssignmentModel, StudentProfileModel  # noqa: E402
from backend.app.student_services.pdf import COLLEGE_NAME, NAVY  # noqa: E402

HERE = Path(__file__).resolve().parent
LOGINS = HERE / "student_accounts.local.txt"
OUT = HERE / "login_slips.local"
COLS, ROWS = 2, 5
W, H = A4
MARGIN = 10 * mm
SLIP_W, SLIP_H = (W - 2 * MARGIN) / COLS, (H - 2 * MARGIN - 12 * mm) / ROWS


def read_passwords() -> dict:
    """{roll_no: temporary password}; the latest line wins if a roll appears twice."""
    if not LOGINS.exists():
        sys.exit(f"{LOGINS} not found: create the accounts first (create_student_accounts.py)")
    out = {}
    for line in LOGINS.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) >= 5 and line.startswith("Y"):
            out[parts[2]] = parts[-2]
    return out


def slip(c, x, y, s):
    c.setStrokeColor(colors.grey)
    c.setDash(3, 3)
    c.rect(x, y, SLIP_W, SLIP_H)                     # cut line
    c.setDash()
    left, top = x + 6 * mm, y + SLIP_H - 7 * mm
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(left, top, f"{COLLEGE_NAME} · CampusSphere")
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(left, top - 6 * mm, s["name"][:38])
    c.setFont("Helvetica", 8.5)
    c.drawString(left, top - 11 * mm, f"{s['class']}   ·   Mentor: {s['mentor']}")
    c.setFont("Helvetica", 8)
    c.drawString(left, top - 18 * mm, "Roll number (your login)")
    c.drawString(left + SLIP_W / 2 - 2 * mm, top - 18 * mm, "Temporary password")
    c.setFont("Courier-Bold", 12)
    c.drawString(left, top - 23.5 * mm, s["roll_no"])
    c.drawString(left + SLIP_W / 2 - 2 * mm, top - 23.5 * mm, s["password"])
    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.HexColor("#444444"))
    c.drawString(left, top - 30 * mm, "Sign in to CampusSphere with your roll number and this password.")
    c.drawString(left, top - 34 * mm, "You will be asked to choose your own password straight away.")
    c.drawString(left, top - 38 * mm, "Keep this slip private, then tear it up.")


def build(path: Path, section: str, incharge: str, students: list):
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle(f"CampusSphere login slips · {section}")
    per_page = COLS * ROWS
    pages = (len(students) + per_page - 1) // per_page
    for page in range(pages):
        c.setFont("Helvetica-Bold", 10)
        c.drawString(MARGIN, H - MARGIN - 4 * mm, f"CampusSphere login slips · {section} · {len(students)} students")
        c.setFont("Helvetica", 8)
        c.drawRightString(W - MARGIN, H - MARGIN - 4 * mm,
                          f"Class in-charge: {incharge} · page {page + 1} of {pages} · CONFIDENTIAL")
        for i, s in enumerate(students[page * per_page:(page + 1) * per_page]):
            col, row = i % COLS, i // COLS
            slip(c, MARGIN + col * SLIP_W, H - MARGIN - 12 * mm - (row + 1) * SLIP_H, s)
        c.showPage()
    c.save()


def main():
    ap = argparse.ArgumentParser(description="Printable login slips per section")
    ap.add_argument("--branch", required=True)
    ap.add_argument("--section", help="Only this class, e.g. IT-3A")
    args = ap.parse_args()
    branch = args.branch.strip().upper()
    ensure_columns(engine)
    passwords = read_passwords()
    db = SessionLocal()
    try:
        names = {u.id: u.name for u in db.query(UserModel).filter(UserModel.role.in_(["faculty", "staff", "admin"]))}
        incharges = {(a.year, a.section): names.get(a.user_id, "—") for a in db.query(ApproverAssignmentModel).filter(
            ApproverAssignmentModel.role == "class_incharge", ApproverAssignmentModel.department == branch)}
        classes, skipped = defaultdict(list), defaultdict(int)
        rows = db.query(StudentProfileModel, UserModel).join(UserModel, UserModel.id == StudentProfileModel.user_id).filter(
            StudentProfileModel.department == branch).all()
        for p, u in rows:
            key = f"{branch}-{p.year}{p.section}"
            if args.section and key != args.section.upper():
                continue
            if not u.must_change_password or p.roll_no not in passwords:
                skipped[key] += 1          # chose their own password already, or no temporary one on file
                continue
            classes[(p.year, p.section)].append({
                "name": u.name.upper(), "roll_no": p.roll_no, "password": passwords[p.roll_no],
                "class": f"{branch} · Year {p.year} · Section {p.section}", "mentor": names.get(p.mentor_id, "—"),
            })
    finally:
        db.close()

    OUT.mkdir(exist_ok=True)
    for (year, sec), studs in sorted(classes.items()):
        key = f"{branch}-{year}{sec}"
        studs.sort(key=lambda s: s["roll_no"])
        build(OUT / f"{key}.pdf", key, incharges.get((year, sec), "—"), studs)
        print(f"{key}: {len(studs)} slips" + (f" ({skipped[key]} skipped: own password already set)" if skipped[key] else ""))
    print(f"PDFs in {OUT} (git-ignored; they hold passwords)")


if __name__ == "__main__":
    main()
