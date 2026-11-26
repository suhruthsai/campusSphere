"""Copy the files on this computer's disk into the S3 / R2 bucket (one time, before or after the first deploy).

    python -m backend.app.core.storage_migrate                  # what would be copied (nothing is sent)
    python -m backend.app.core.storage_migrate --copy           # copy everything not already in the bucket
    python -m backend.app.core.storage_migrate --copy --only locker,admissions,issued,accreditation,media

Reads private_uploads/ (or PRIVATE_UPLOADS_DIR) and media_uploads/, and writes to the bucket named by the S3_*
settings in .env. Files already in the bucket are skipped, so it is safe to run again. The local files are left
in place. college/ holds the PDFs read from the college website (~240 MB); leave it out with --only and an admin
can refresh them from the app instead.
"""
import argparse
import mimetypes
import sys

from backend.app.core import storage
from backend.app.core.config import settings


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--copy", action="store_true", help="actually copy (default: only list)")
    ap.add_argument("--only", default="", help="comma-separated top folders, e.g. locker,admissions,issued,accreditation,media,college")
    args = ap.parse_args(argv)

    for n in ("S3_ENDPOINT_URL", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"):
        if not getattr(settings, n):
            print(f"Set {n} in .env first (see .env.example).")
            return 2
    only = {x.strip() for x in args.only.split(",") if x.strip()}
    local, bucket = storage.LocalStorage(), storage.S3Storage()

    keys = [k for k in local.keys() if not only or k.split("/", 1)[0] in only]
    present = set(bucket.keys())
    todo = [k for k in keys if k not in present]
    size = sum(local._path(k).stat().st_size for k in todo)
    print(f"{len(keys)} local files, {len(keys) - len(todo)} already in bucket '{settings.S3_BUCKET}', "
          f"{len(todo)} to copy ({size / 1024 / 1024:.1f} MB)")
    by_top = {}
    for k in todo:
        by_top[k.split("/", 1)[0]] = by_top.get(k.split("/", 1)[0], 0) + 1
    for top, n in sorted(by_top.items()):
        print(f"  {top:<14} {n} files")
    if not args.copy:
        print("Nothing sent. Run again with --copy to copy them.")
        return 0
    for i, k in enumerate(todo, 1):
        with open(local._path(k), "rb") as f:
            bucket.put_file(k, f, mimetypes.guess_type(k)[0] or "application/octet-stream")
        if i % 25 == 0 or i == len(todo):
            print(f"  copied {i}/{len(todo)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
