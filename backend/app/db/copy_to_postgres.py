"""Copy this computer's SQLite database into a Postgres database (e.g. Neon), once, before going live.

    python -m backend.app.db.copy_to_postgres --to "postgresql://user:pass@host/db?sslmode=require"
        lists what would be copied and checks the target (nothing is written)
    python -m backend.app.db.copy_to_postgres --to "..." --copy
        creates the tables and copies every row
    python -m backend.app.db.copy_to_postgres --to "..." --copy --replace
        the same, after EMPTYING the target's CampusSphere tables (use when the deployed server already
        started on it and seeded its own admin account and timetable)

The target URL can also come from TARGET_DATABASE_URL, in the environment or in .env (keeps the password out of
your shell history). Don't put it in DATABASE_URL yet: that would switch the local backend to Neon too.
The source defaults to ./campussphere.db; use --from for another SQLite file. Stop the local backend first so
nothing changes mid-copy.

Rows are read through the app's own models, so booleans, dates and JSON arrive as the right Postgres types.
Postgres enforces foreign keys, which this SQLite file never did: a row that points to a deleted parent is
handled as its foreign key says (ON DELETE CASCADE: the row is left out; SET NULL: the reference is cleared),
and anything else stops the copy with a report before a single row is written. Afterwards the id counters
are moved past the copied ids and every table's row count is checked.
"""
import argparse
import importlib
import os
import pkgutil
import sys
from collections import defaultdict

from sqlalchemy import Integer, create_engine, func, inspect, literal_column, select, text

from backend.app.core.config import DEFAULT_DB_PATH, ROOT_DIR
from backend.app.db.session import Base, normalize_url

BATCH = 2000


def load_models():
    import backend.app.models as models
    for m in pkgutil.iter_modules(models.__path__):
        importlib.import_module(f"backend.app.models.{m.name}")
    return Base.metadata


def pg_url(url: str) -> str:
    url = normalize_url(url)
    if not url.startswith("postgresql"):
        raise SystemExit("--to must be a Postgres URL (postgresql://...)")
    return url


def safe(url: str) -> str:
    """The URL without its password, for printing."""
    u = create_engine(url).url
    return u.render_as_string(hide_password=True)


def orphan_plan(src, meta):
    """Per table: rowids to leave out, {rowid: [columns to set NULL]}, and problems that stop the copy."""
    skip, nullify, problems = defaultdict(set), defaultdict(lambda: defaultdict(list)), []
    with src.connect() as c:
        for t in meta.sorted_tables:
            fk_cols = {row[0]: row[3] for row in c.exec_driver_sql(f'PRAGMA foreign_key_list("{t.name}")')}
            for _tbl, rowid, parent, fkid in c.exec_driver_sql(f'PRAGMA foreign_key_check("{t.name}")'):
                col = fk_cols.get(fkid)
                fk = next((f for f in t.c[col].foreign_keys), None) if col in t.c else None
                rule = (fk.ondelete or "").upper() if fk else ""
                if rule == "CASCADE":
                    skip[t.name].add(rowid)
                elif rule == "SET NULL" and t.c[col].nullable:
                    nullify[t.name][rowid].append(col)
                else:
                    problems.append(f"{t.name} row {rowid}: {col} points to a missing {parent} (no ON DELETE rule)")
    return skip, nullify, problems


def env_target() -> str:
    """TARGET_DATABASE_URL from the environment, else from the project's .env (git-ignored)."""
    if os.getenv("TARGET_DATABASE_URL"):
        return os.environ["TARGET_DATABASE_URL"]
    env = ROOT_DIR / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            k, sep, v = line.partition("=")
            if sep and k.strip() == "TARGET_DATABASE_URL":
                return v.strip().strip('"').strip("'")
    return ""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--from", dest="src", default=f"sqlite:///{DEFAULT_DB_PATH}", help="source SQLite URL (default: ./campussphere.db)")
    ap.add_argument("--to", dest="dst", default=env_target(), help="target Postgres URL (or TARGET_DATABASE_URL in the environment / .env)")
    ap.add_argument("--copy", action="store_true", help="actually copy (default: only check and list)")
    ap.add_argument("--replace", action="store_true", help="empty the target's CampusSphere tables first")
    args = ap.parse_args(argv)
    if not args.dst:
        print("Give the target with --to or TARGET_DATABASE_URL.")
        return 2
    if not args.src.startswith("sqlite"):
        print("--from must be a SQLite URL (sqlite:///path/to/campussphere.db)")
        return 2

    meta = load_models()
    tables = meta.sorted_tables                       # parents before children
    src = create_engine(args.src)
    dst = create_engine(pg_url(args.dst), pool_pre_ping=True)
    print(f"From: {args.src}\nTo:   {safe(pg_url(args.dst))}\n")

    # ── Source: row counts and orphans ──
    src_tables = set(inspect(src).get_table_names())
    unknown = sorted(src_tables - set(meta.tables) - {"sqlite_sequence"})
    if unknown:
        print(f"Not copied (no model for them): {', '.join(unknown)}")
    with src.connect() as c:
        counts = {t.name: c.execute(select(func.count()).select_from(t)).scalar() if t.name in src_tables else 0 for t in tables}
    skip, nullify, problems = orphan_plan(src, meta)
    total = sum(counts.values())
    left_out = sum(len(v) for v in skip.values())
    print(f"{len(tables)} tables, {total:,} rows to copy" + (f" ({left_out} orphan rows left out)" if left_out else ""))
    for name, ids in sorted(skip.items()):
        print(f"  {name}: {len(ids)} rows point to deleted parents (ON DELETE CASCADE) - left out, as Postgres would have")
    for name, rows in sorted(nullify.items()):
        print(f"  {name}: {len(rows)} rows point to deleted parents (ON DELETE SET NULL) - reference cleared")
    if problems:
        print("\nStopping: these rows point to missing parents and their foreign key has no ON DELETE rule:")
        for p in problems[:30]:
            print("  " + p)
        print("Fix them in the SQLite file (delete or correct the rows), then run again.")
        return 1

    # ── Target: reachable, and empty unless --replace ──
    with dst.connect() as c:
        version = c.exec_driver_sql("select version()").scalar()
        existing = set(inspect(c).get_table_names())
        filled = {t.name: c.execute(select(func.count()).select_from(t)).scalar() for t in tables if t.name in existing}
    filled = {k: v for k, v in filled.items() if v}
    print(f"\nTarget: {version.split(',')[0]}; {len(existing & set(meta.tables))} of the tables exist"
          + (f", {len(filled)} have rows ({sum(filled.values()):,} rows)" if filled else ", all empty"))
    if filled and not args.replace:
        print("The target already has data: " + ", ".join(f"{k} ({v})" for k, v in sorted(filled.items())[:12])
              + ("..." if len(filled) > 12 else ""))
        print("Run with --replace to empty those tables first (their current rows are deleted), or use an empty database.")
        return 1
    if not args.copy:
        print("\nNothing written. Run again with --copy" + (" --replace" if filled else "") + " to copy.")
        return 0

    # ── Copy (one transaction: all or nothing) ──
    meta.create_all(dst)
    with dst.begin() as out:
        if filled:
            names = ", ".join(f'"{t.name}"' for t in tables)
            out.exec_driver_sql(f"TRUNCATE {names} RESTART IDENTITY CASCADE")
            print(f"Emptied {len(filled)} tables in the target.")
        with src.connect() as inp:
            for t in tables:
                if not counts[t.name]:
                    continue
                q = select(t, literal_column("rowid").label("__rowid")).order_by(literal_column("rowid"))
                done, batch = 0, []
                for row in inp.execution_options(stream_results=True, yield_per=BATCH).execute(q):
                    m = dict(row._mapping)
                    rid = m.pop("__rowid")
                    if rid in skip.get(t.name, ()):
                        continue
                    for col in nullify.get(t.name, {}).get(rid, []):
                        m[col] = None
                    batch.append(m)
                    if len(batch) >= BATCH:
                        out.execute(t.insert(), batch)
                        done += len(batch)
                        batch = []
                if batch:
                    out.execute(t.insert(), batch)
                    done += len(batch)
                print(f"  {t.name:<34} {done:>7,}")
        # id counters: next id after the largest copied one
        for t in tables:
            pk = list(t.primary_key.columns)
            if len(pk) == 1 and isinstance(pk[0].type, Integer) and pk[0].autoincrement in (True, "auto"):
                seq = out.execute(text("select pg_get_serial_sequence(:t, :c)"), {"t": t.name, "c": pk[0].name}).scalar()
                if seq:
                    out.execute(text(f'select setval(:s, coalesce((select max("{pk[0].name}") from "{t.name}"), 0) + 1, false)'), {"s": seq})

    # ── Check ──
    bad = []
    with dst.connect() as c:
        for t in tables:
            want = counts[t.name] - len(skip.get(t.name, ()))
            got = c.execute(select(func.count()).select_from(t)).scalar()
            if got != want:
                bad.append(f"{t.name}: {got} rows, expected {want}")
    if bad:
        print("\nRow counts differ:\n  " + "\n  ".join(bad))
        return 1
    print(f"\nDone: {total - left_out:,} rows in {len(tables)} tables, every count matches.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
