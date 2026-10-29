"""
Import a branch's roll list from an Excel sheet (.xlsx or the old .xls) into the student_roster table.

The college's sheets come in two layouts; this reads both:
  - a Section column (values A / B / C ...), e.g. "IV-SEM-ROLL LIST";
  - no Section column, but the serial number (S.NO.) starts again at 1 for each section: the first block is A,
    the next B, and so on, e.g. the fee-status sheets "III Sem" and "VII Sem".
Rows whose section is blank can take it from per-section sheets (--section-sheets "sec-a=A,Sheet3=B,Sheet5=C").

Only the roll number, name, year and section are stored. Phone numbers, category and fee columns are ignored:
the roll list doesn't need them, and they are personal data.

Existing students (same roll number) are updated in place (year, section, branch, academic year); their email and
father's name are kept, and if the sheet spells the name differently the existing name is kept and the other
spelling is noted for the Admin Office to check. --flag-missing notes students of this branch and year who are on
the roll list but not in the sheet (left? detained?), without deleting them.

Usage (from the project root; --dry-run first):
    python backend/app/db/import_roll_lists_excel.py FILE --sheet "VII Sem" --branch IT --year 4 --dry-run
"""
import argparse
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.db.import_roll_lists import academic_year  # noqa: E402
from backend.app.db.session import Base, SessionLocal, engine  # noqa: E402
from backend.app.models.services import RosterEntryModel  # noqa: E402

ROLL = re.compile(r"^\d{4}-\d{2}-\d{3}-\d{3}$")
SECTIONS = "ABCDEFGH"


def _clean(v) -> str:
    s = "" if v is None or (isinstance(v, float) and pd.isna(v)) else str(v)
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


def _sheet(path: str, name: str) -> pd.DataFrame:
    """The sheet whose name matches (ignoring spaces and case: 'VII Sem' finds 'VII Sem  ')."""
    xl = pd.ExcelFile(path)
    match = [s for s in xl.sheet_names if s.strip().lower() == name.strip().lower()]
    if not match:
        sys.exit(f"No sheet {name!r} in {path}. Sheets: {xl.sheet_names}")
    return pd.read_excel(path, sheet_name=match[0], header=None, dtype=str).map(_clean)


def _roll_col(df: pd.DataFrame) -> int:
    counts = {c: df[c].map(lambda v: bool(ROLL.match(v))).sum() for c in df.columns}
    best = max(counts, key=counts.get)
    if not counts[best]:
        sys.exit("No column of roll numbers (like 2451-23-737-001) found")
    return best


def read_sheet(path: str, sheet: str) -> list[dict]:
    """[{roll_no, name, section (or None), serial}] in sheet order."""
    df = _sheet(path, sheet)
    rc = _roll_col(df)
    rows = df[df[rc].map(lambda v: bool(ROLL.match(v)))]
    # A section column: only single letters, at least half the rows filled
    sec_col = next((c for c in df.columns if c != rc and rows[c].map(lambda v: v in SECTIONS and v != "").sum() >= len(rows) / 2
                    and rows[c].map(lambda v: v == "" or (len(v) == 1 and v in SECTIONS)).all()), None)
    out, block = [], -1
    for _, r in df.iterrows():
        serial = r[rc - 1] if rc > 0 else ""
        if serial in ("1", "1.0"):
            block += 1                      # the serial number starts again: the next section
        if not ROLL.match(r[rc]):
            continue
        if sec_col is not None:
            section = r[sec_col] or None
        else:
            section = SECTIONS[block] if block >= 0 else None
        out.append({"roll_no": r[rc], "name": r[rc + 1].upper(), "section": section, "serial": serial})
    return out


def sections_from_sheets(path: str, spec: str) -> dict:
    """'sec-a=A,Sheet3=B' -> {roll_no: section} from per-section sheets."""
    found = {}
    for part in filter(None, (p.strip() for p in spec.split(","))):
        name, _, sec = part.partition("=")
        df = _sheet(path, name)
        for v in df.values.ravel():
            if ROLL.match(v):
                found[v] = sec.strip().upper()
    return found


def main():
    ap = argparse.ArgumentParser(description="Import a roll list from an Excel sheet")
    ap.add_argument("file")
    ap.add_argument("--sheet", required=True)
    ap.add_argument("--branch", required=True, help="e.g. IT")
    ap.add_argument("--year", type=int, required=True, choices=[1, 2, 3, 4], help="Year of study this sheet is for, this academic year")
    ap.add_argument("--section-sheets", default="", help='Fill blank sections from per-section sheets, e.g. "sec-a=A,Sheet3=B,Sheet5=C"')
    ap.add_argument("--skip", default="", help="Roll numbers in this sheet to leave out (listed elsewhere), comma separated")
    ap.add_argument("--note", action="append", default=[], help='Note for one student: "ROLL=text" (may repeat)')
    ap.add_argument("--flag-missing", action="store_true", help="Note students of this branch and year who aren't in the sheet")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    branch, ay = args.branch.strip().upper(), academic_year()
    rows = read_sheet(args.file, args.sheet)
    skip = {s.strip() for s in args.skip.split(",") if s.strip()}
    rows = [r for r in rows if r["roll_no"] not in skip]
    if args.section_sheets:
        fill = sections_from_sheets(args.file, args.section_sheets)
        for r in rows:
            if not r["section"] and r["roll_no"] in fill:
                r["section"] = fill[r["roll_no"]]
    notes = dict(n.split("=", 1) for n in args.note)
    dupes = [k for k, v in Counter(r["roll_no"] for r in rows).items() if v > 1]
    if dupes:
        sys.exit(f"The same roll number appears twice in the sheet: {dupes[:5]}")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    added = updated = 0
    spelling, no_section = [], [r["roll_no"] for r in rows if not r["section"]]
    source = f"{Path(args.file).name} · {args.sheet.strip()}"
    try:
        for r in rows:
            row = db.get(RosterEntryModel, r["roll_no"])
            note = notes.get(r["roll_no"])
            if row is None:
                row = RosterEntryModel(roll_no=r["roll_no"], name=r["name"])
                added += 1
            else:
                updated += 1
                if row.name and row.name.split() != r["name"].split():
                    spelling.append((r["roll_no"], row.name, r["name"]))
                    note = "; ".join(filter(None, [note, f"{Path(args.file).name} spells the name {r['name']}"]))
            row.department, row.year, row.section = branch, args.year, r["section"]
            yy = r["roll_no"].split("-")[1]
            row.admission_year = 2000 + int(yy) if yy.isdigit() else None
            row.academic_year, row.source = ay, source
            if note:
                row.notes = note
            db.add(row)
        missing = []
        if args.flag_missing:
            listed = {r["roll_no"] for r in rows}
            for row in db.query(RosterEntryModel).filter(RosterEntryModel.department == branch, RosterEntryModel.year == args.year).all():
                if row.roll_no not in listed and not (row.source or "").startswith("GENERATED"):
                    missing.append((row.roll_no, row.name))
                    row.notes = f"Not in {Path(args.file).name} ({args.sheet.strip()}): check whether the student has left"
        if args.dry_run:
            db.rollback()
        else:
            db.commit()
    finally:
        db.close()

    by_sec = Counter(r["section"] or "?" for r in rows)
    print(f"{'DRY RUN · ' if args.dry_run else ''}{branch} year {args.year} from {source}: {len(rows)} students "
          f"(sections {dict(sorted(by_sec.items()))}) · {added} new · {updated} already on the list")
    for roll, old, new in spelling:
        print(f"  name kept {old!r}; the sheet spells it {new!r} ({roll}) — noted for the Admin Office")
    if no_section:
        print(f"  NO SECTION for {len(no_section)}: {no_section[:10]}")
    if args.flag_missing:
        print(f"  on the roll list but not in the sheet: {missing or 'none'}")


if __name__ == "__main__":
    main()
