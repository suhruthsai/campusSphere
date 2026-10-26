"""
Import the college's roll-list PDFs into the student_roster table.

Usage (from the project root):
    python backend/app/db/import_roll_lists.py --branch IT --year 4 "IT Roll List.pdf" [--dry-run]

Each PDF is one branch and one year. Rows are read from the PDF tables (S.No, Roll No, Name, and
optionally Section, Father Name and Email). Existing roll numbers are updated, new ones added.
Anything odd (a roll number without its year, an invalid email, the same email for two students)
is written to the row's notes and printed, so the list can be corrected at the source.
Requires pdfplumber (pip install pdfplumber); the roll lists themselves are personal data —
keep them out of git.
"""
import argparse
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.core.campus_time import campus_today  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.models.services import RosterEntryModel  # noqa: E402

ROLL = re.compile(r"^\d{4}-\d{2}(-\d{3})?-\d{3}$")
EMAIL = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def _clean(v):
    return re.sub(r"\s+", " ", (v or "").replace("\n", " ")).strip()


def academic_year(today=None):
    """Indian academic year: July–June. October 2026 → '2026-27'."""
    d = today or campus_today()
    start = d.year if d.month >= 7 else d.year - 1
    return f"{start}-{(start + 1) % 100:02d}"


def read_pdf(path: Path):
    """All student rows of a roll-list PDF as dicts (wrapped cells merged)."""
    import pdfplumber
    header, rows = None, []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for raw in table:
                    cells = [_clean(c) for c in raw]
                    if not any(cells):
                        continue
                    if "ROLL" in " ".join(cells).upper() and "NAME" in " ".join(cells).upper():
                        header = [c.upper() for c in cells]
                        continue
                    rows.append(cells)
    if not header:
        raise ValueError(f"{path.name}: no table header with ROLL and NAME found")
    col = lambda *keys: next((i for i, c in enumerate(header) if any(k in c for k in keys)), None)
    idx = {"sno": 0, "roll": col("ROLL"), "name": col("NAME OF", "NAME"), "section": col("SECTION"),
           "email": col("MAIL"), "father": col("FATHER")}
    out = []
    for cells in rows:
        get = lambda k: cells[idx[k]] if idx[k] is not None and idx[k] < len(cells) else ""
        roll = get("roll").replace(" ", "")
        if not ROLL.match(roll):
            if out and not roll and not get("sno"):          # continuation of a wrapped row
                for k, field in (("name", "name"), ("father", "father_name"), ("email", "email")):
                    if get(k):
                        out[-1][field] = (out[-1][field] + " " + get(k)).strip()
                continue
            print(f"  skipped (no roll number): {cells}")
            continue
        name, section = get("name"), get("section").upper()
        # A long name can spill into the section column: "NARASIH" + "MA D" -> "NARASIHMA", "D"
        spill = re.match(r"^(\S+)\s+([A-Z])$", section)
        if spill:
            name, section = name + spill.group(1), spill.group(2)
        out.append({"roll_no": roll, "name": name, "section": section or None,
                    "email": get("email"), "father_name": get("father") or None})
    return out


def import_file(db, path: Path, branch: str, year: int, ay: str, dry_run=False):
    rows = read_pdf(path)
    start = int(ay[:4])
    for r in rows:
        notes = []
        parts = r["roll_no"].split("-")
        adm = 2000 + int(parts[1]) if len(parts) == 4 else None
        if adm is None:
            notes.append("roll number has no admission year or branch code")
        elif start - adm + 1 != year:
            notes.append(f"roll number shows a {adm} admission (year {start - adm + 1} in {ay}), list says year {year}")
        email = r["email"]
        if email and not EMAIL.match(email):
            notes.append("email in the roll list was not a valid address (not stored)")
            email = None
        r.update(email=email or None, admission_year=adm, notes=notes)
    if dry_run:
        return rows
    for r in rows:
        row = db.query(RosterEntryModel).filter(RosterEntryModel.roll_no == r["roll_no"]).first() or RosterEntryModel(roll_no=r["roll_no"])
        row.name, row.father_name, row.department, row.year = r["name"], r["father_name"], branch, year
        row.section, row.email, row.admission_year = r["section"], r["email"], r["admission_year"]
        row.academic_year, row.source, row.notes = ay, path.name, "; ".join(r["notes"]) or None
        db.add(row)
    db.commit()
    return rows


def flag_shared_emails(db):
    """Note students whose email also belongs to another roll number."""
    rows = db.query(RosterEntryModel).filter(RosterEntryModel.email.isnot(None)).all()
    by = {}
    for r in rows:
        by.setdefault(r.email.lower(), []).append(r)
    for group in by.values():
        if len(group) < 2:
            continue
        for r in group:
            others = ", ".join(f"{o.roll_no} ({o.department})" for o in group if o is not r)
            msg = f"same email as {others}"
            if msg not in (r.notes or ""):
                r.notes = f"{r.notes}; {msg}" if r.notes else msg
    db.commit()


def main():
    ap = argparse.ArgumentParser(description="Import roll-list PDFs into the student roster")
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--branch", required=True, help="CSE, ECE, IT, CSIT, CSD, ...")
    ap.add_argument("--year", required=True, type=int, choices=[1, 2, 3, 4])
    ap.add_argument("--academic-year", default=None, help="default: current, e.g. 2026-27")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    Base.metadata.create_all(bind=engine)
    ay = a.academic_year or academic_year()
    db = SessionLocal()
    try:
        for f in a.files:
            rows = import_file(db, f, a.branch.upper(), a.year, ay, a.dry_run)
            secs = Counter(r["section"] or "-" for r in rows)
            print(f"{f.name}: {len(rows)} students · {a.branch.upper()} year {a.year} · sections {dict(secs)}"
                  f"{' (dry run, nothing saved)' if a.dry_run else ''}")
            for r in rows:
                if r["notes"]:
                    print(f"  {r['roll_no']} {r['name']}: {'; '.join(r['notes'])}")
        if not a.dry_run:
            flag_shared_emails(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
