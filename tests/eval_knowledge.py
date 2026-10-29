"""Evaluate Mitra's college search on the question bank: does a top-3 passage contain the right content?

    python tests/eval_knowledge.py [--k 3] [--show-misses]

Runs on the local database's crawled knowledge base (no server needed). For each question in
backend/app/knowledge/questions.py, a hit means one of the top-k passages (title, heading or text)
contains one of the question's expected words. Prints the hit rate per audience, the misses, and the
best-score spread used to tune ANSWERED_SCORE in the guide."""
import argparse
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.stdout.reconfigure(encoding="utf-8")

from backend.app.db.session import SessionLocal  # noqa: E402
from backend.app.knowledge import search  # noqa: E402
from backend.app.knowledge.questions import QUESTIONS  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--k", type=int, default=3)
ap.add_argument("--show-misses", action="store_true")
args = ap.parse_args()

db = SessionLocal()
n = search.rebuild(db)
db.close()
if not n:
    sys.exit("The knowledge base is empty: crawl first (Admin > Mitra's knowledge > Refresh).")
print(f"{n} passages indexed\n")

index = search.current()
total = hits = 0
misses, hit_scores, miss_scores = [], [], []
unanswerable = []
for audience, items in QUESTIONS.items():
    a_hits = 0
    for question, expected in items:
        found = index.search(question, k=args.k)
        best = found[0]["score"] if found else 0.0
        if expected is None:            # the website has no answer: reported, not scored (Mitra judges it)
            unanswerable.append((question, best, [h["title"] for h in found]))
            continue
        else:
            blob = " ".join(f"{h['title']} {h.get('heading') or ''} {h['text']}".lower() for h in found)
            ok = any(e.lower() in blob for e in expected)
            (hit_scores if ok else miss_scores).append(best)
        a_hits += ok
        if not ok:
            misses.append((audience, question, expected, [h["title"] for h in found]))
    scored = sum(1 for _, e in items if e is not None)
    total += scored
    hits += a_hits
    print(f"{audience:15} {a_hits:3}/{scored:<3} {100 * a_hits / scored:5.1f}%")
print(f"{'all':15} {hits:3}/{total:<3} {100 * hits / total:5.1f}%  (top-{args.k})\n")
if hit_scores:
    print(f"best score when found:  median {statistics.median(hit_scores):.1f}, min {min(hit_scores):.1f}")
if miss_scores:
    print(f"best score when missed: median {statistics.median(miss_scores):.1f}, max {max(miss_scores):.1f}")
for q, best, titles in unanswerable:
    print(f"not on the website (Mitra must say so): {q!r}: best score {best}, nearest {titles[:2]}")
if args.show_misses:
    print("\nMisses:")
    for audience, q, exp, titles in misses:
        print(f"- [{audience}] {q}\n    expected {exp}; got {titles}")
