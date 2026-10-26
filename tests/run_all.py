"""Run every API test suite against a running backend and summarise.

    python tests/run_all.py [suite ...]

Needs: the backend running (CAMPUS_API, default http://127.0.0.1:8000), the seeded demo accounts
(backend/app/db/demo_accounts.local.txt) and ADMIN_PASSWORD in .env. The suites create throwaway
accounts and records and remove them again; generated PDFs go to a temporary folder.
Use 127.0.0.1 rather than localhost on Windows (Python tries IPv6 first and every call is slow)."""
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
DB, CREDS, ENV = ROOT / "campussphere.db", ROOT / "backend/app/db/demo_accounts.local.txt", ROOT / ".env"
OUT = Path(tempfile.mkdtemp(prefix="campussphere-tests-"))

SUITES = {
    "services": ["test_services.py", CREDS, OUT],
    "admin": ["test_admin.py", DB, CREDS],
    "joining": ["test_joining.py", DB, CREDS, OUT, ROOT],
    "leaving": ["test_leaving.py", DB, CREDS, OUT, ROOT],
    "writes": ["test_writes.py", ENV],
    "timetable": ["truth_timetable.py", DB, ENV, CREDS],
    "current_class": ["truth_current.py", DB, ENV],
    "roll_list": ["test_roll_list.py", DB, CREDS, ENV],
    "ai_tools": ["test_ai_tools.py", DB],
    "get_sweep": ["sweep_get.py", CREDS, ENV],
}

missing = [p for p in (DB, CREDS, ENV) if not p.exists()]
if missing:
    sys.exit("missing: " + ", ".join(map(str, missing)))
chosen = sys.argv[1:] or list(SUITES)
results = {}
for name in chosen:
    script, *args = SUITES[name]
    t = time.time()
    p = subprocess.run([sys.executable, str(Path(__file__).parent / script), *map(str, args)], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env={**os.environ, "PYTHONUTF8": "1"})
    results[name] = p.returncode == 0
    print(f"{'PASS' if p.returncode == 0 else 'FAIL'}  {name:<14} {time.time() - t:5.1f}s")
    if p.returncode:
        lines = [l for l in p.stdout.splitlines() if l.startswith("FAIL")] or p.stdout.splitlines()[-15:]
        print("      " + "\n      ".join(lines + p.stderr.splitlines()[-10:]))
print(f"\n{sum(results.values())}/{len(results)} suites passed · PDFs in {OUT}")
sys.exit(0 if all(results.values()) else 1)
