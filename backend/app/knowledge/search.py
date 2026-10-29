"""
Keyword search (BM25) over the knowledge base chunks, held in memory and rebuilt after each crawl.

Mitra writes the search query in English (she translates Telugu / Hindi questions first). College words
people use interchangeably are expanded ("stay" also finds "hostel") at a lower weight than the words
actually asked, words true of nearly every page ("college", "campus") count little, and a page's title and
heading count extra, so "transport" finds the Transport page before a passing mention. Passages with the
same text (one article under two menus) are indexed once.
"""
import math
import re
import threading
from collections import Counter

STOPWORDS = set("""a an and are as at be by can do does for from get got how i if in into is it its me my of on or
our please tell that the their there these this to was what when where which who why will with you your about
any are i'm we us he she they them his her him also than then""".split())

# Words people use for the same thing at a college (query side only)
SYNONYMS = {
    "fee": ["fees", "tuition", "payment"], "fees": ["fee", "tuition"], "pay": ["payment", "fee"],
    "hostel": ["accommodation", "boarding", "stay"], "stay": ["hostel", "accommodation"], "accommodation": ["hostel"],
    "bus": ["transport", "transportation", "route"], "transport": ["bus", "transportation"],
    "placement": ["placements", "recruitment", "companies", "package", "training"], "job": ["placement", "recruitment"],
    "salary": ["package", "ctc", "placement"], "package": ["ctc", "salary", "placement"],
    "admission": ["admissions", "eapcet", "counselling", "eligibility", "seats"], "join": ["admission", "admissions"],
    "eapcet": ["eamcet", "admission", "counselling"], "eamcet": ["eapcet", "admission"],
    "scholarship": ["scholarships", "epass", "reimbursement"], "reimbursement": ["scholarship", "epass"],
    "exam": ["examination", "examinations", "exams"], "result": ["results", "marks", "memo"],
    "marks": ["memo", "result", "grade"], "timetable": ["time", "table", "schedule"], "schedule": ["timetable"],
    "principal": ["director", "head"], "hod": ["head", "department"], "contact": ["phone", "email", "address"],
    "phone": ["contact", "ph", "mobile"], "address": ["contact", "location"], "location": ["address", "nadergul"],
    "canteen": ["food", "cafeteria"], "food": ["canteen", "mess"], "sports": ["games", "physical", "ground"],
    "library": ["books", "reading"], "ragging": ["anti", "antiragging"], "complaint": ["grievance", "redressal"],
    "cutoff": ["rank", "closing", "eapcet"], "rank": ["cutoff", "nirf", "ranking"], "ranking": ["nirf", "rank"],
    "accreditation": ["nba", "naac", "aicte"], "seats": ["intake", "admission"], "intake": ["seats"],
    "cse": ["computer", "science"], "ece": ["electronics", "communication"], "eee": ["electrical"],
    "mech": ["mechanical"], "civil": ["civil"], "it": ["information", "technology"],
    "centre": ["center"], "center": ["centre"], "supplementary": ["supple", "suppl"], "supply": ["supple"],
    "reach": ["address", "location", "route", "transport"], "directions": ["address", "route", "location"],
    "mba": ["business", "management"], "pg": ["m.e", "m.tech", "postgraduate"], "ug": ["b.e", "undergraduate"],
    "audit": ["audited", "accounts"], "warden": ["hostel"], "college": [],
    "founded": ["founder", "established", "society"], "founder": ["society", "established"], "runs": ["society", "management"],
    "revaluation": ["rv", "photocopy", "recounting"], "photocopy": ["rv", "revaluation"],
    "research": ["development", "consultancy", "grants"], "video": ["tour", "virtual"], "tour": ["virtual", "video"],
}
# A best score below this means the website most likely has no answer (the weakest correct match on the
# question bank scores ~3.3, tests/eval_knowledge.py). It marks questions as unanswered for the admin page and
# hides weak source links; a strong score is no proof of an answer, so Mitra still judges the passages.
ANSWERED_SCORE = 3.0
SYNONYM_WEIGHT = 0.35        # an expanded word counts a third of a word the person actually used
# Words true of nearly every page of a college website: they shouldn't decide the ranking
GENERIC = {"college", "campus", "mvsr", "engineering", "student", "offer", "available", "provide", "facility",
           "information", "detail", "contact", "institute"}
GENERIC_WEIGHT = 0.3


def stem(word: str) -> str:
    """A light English stemmer: enough to match fee/fees, admission/admissions, placed/placement."""
    for suffix, keep in (("ies", "y"), ("ings", ""), ("ing", ""), ("ments", "ment"), ("ed", ""), ("es", ""), ("s", "")):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)] + keep
    return word


def tokens(text: str) -> list:
    return [stem(w) for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOPWORDS and (len(w) > 1 or w.isdigit())]


def query_tokens(query: str) -> dict:
    """{token: weight}: the words asked (generic ones count less), then their synonyms at a lower weight."""
    words = [w for w in re.findall(r"[a-z0-9]+", query.lower()) if w not in STOPWORDS]
    out = {}
    for w in words:
        t = stem(w)
        out[t] = max(out.get(t, 0), GENERIC_WEIGHT if w in GENERIC or t in GENERIC else 1.0)
    for w in words:
        for syn in SYNONYMS.get(w, []):
            for t in tokens(syn):
                out.setdefault(t, SYNONYM_WEIGHT)
    return out


class Index:
    """BM25 (k1 1.4, b 0.75) over chunks: each chunk is title + heading (counted twice) + text."""

    def __init__(self, chunks: list):
        # chunks: dicts with id, title, url, kind, heading, text, checked_at
        seen, unique = set(), []
        for c in chunks:                 # the same passage under two menus / titles: index it once
            key = re.sub(r"\s+", " ", c["text"].lower()).strip()
            if key not in seen:
                seen.add(key)
                unique.append(c)
        self.chunks = chunks = unique
        self.docs = []
        df = Counter()
        for c in chunks:
            # Title and heading count extra, except for documents known by name only (their text is the name)
            boost = "" if c["kind"] == "link" else f"{c['title']} {c.get('heading') or ''}"
            tf = Counter(tokens(f"{boost} {boost} {c['text']}"))
            self.docs.append(tf)
            df.update(tf.keys())
        n = max(1, len(chunks))
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}
        self.lengths = [sum(tf.values()) for tf in self.docs]
        self.avg = (sum(self.lengths) / n) if chunks else 1

    def search(self, query: str, k: int = 5) -> list:
        q = query_tokens(query)
        if not q or not self.chunks:
            return []
        k1, b = 1.4, 0.75
        scored = []
        for i, tf in enumerate(self.docs):
            score = 0.0
            for t, weight in q.items():
                f = tf.get(t)
                if f:
                    score += weight * self.idf[t] * f * (k1 + 1) / (f + k1 * (1 - b + b * self.lengths[i] / self.avg))
            if score > 0:
                scored.append((score, i))
        scored.sort(reverse=True)
        out, per_doc = [], Counter()
        for score, i in scored:
            c = self.chunks[i]
            if per_doc[c["url"]] >= 2:          # at most two passages from one document
                continue
            per_doc[c["url"]] += 1
            out.append({**c, "score": round(score, 2)})
            if len(out) >= k:
                break
        return out


_index = Index([])
_lock = threading.Lock()


def current() -> Index:
    return _index


def rebuild(db) -> int:
    """Load every chunk from the database into a fresh index (swapped in atomically)."""
    from backend.app.models.knowledge import KbChunkModel, KbDocumentModel
    global _index
    rows = (db.query(KbChunkModel, KbDocumentModel).join(KbDocumentModel, KbChunkModel.document_id == KbDocumentModel.id).all())
    chunks = [{"id": c.id, "title": d.title, "url": d.url, "kind": d.kind, "heading": c.heading, "text": c.text,
               "checked_at": d.checked_at.isoformat() if d.checked_at else None} for c, d in rows]
    fresh = Index(chunks)
    with _lock:
        _index = fresh
    return len(chunks)
