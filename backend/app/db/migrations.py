# Additive schema changes for tables that already exist. Base.metadata.create_all() creates
# new tables but never adds columns to existing ones, so new columns are added here.
# Safe to run on every startup: only columns that are missing are added.
from sqlalchemy import inspect, text

# table -> [(column, SQL type)] ; types valid on both SQLite and PostgreSQL
ADDED_COLUMNS = {
    "document_requests": [          # Student Services V3: leaving documents
        ("amount", "INTEGER"),          # fee charged for this request (rupees)
        ("payment_id", "INTEGER"),      # payments.id once a fee is involved
        ("fulfilment", "VARCHAR"),      # "generated" (PDF from the portal) | "upload" (Exam Cell uploads it)
        ("issued_file", "VARCHAR"),     # stored name of the uploaded final document
        ("dispatch", "JSON"),           # {"mode", "tracking", "at", "by"} for postal / WES delivery
    ],
}


def ensure_columns(engine) -> list[str]:
    added = []
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, columns in ADDED_COLUMNS.items():
            if table not in existing_tables:
                continue  # create_all() makes it with every column
            present = {c["name"] for c in inspector.get_columns(table)}
            for name, sql_type in columns:
                if name not in present:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {name} {sql_type}'))
                    added.append(f"{table}.{name}")
    return added
