"""
Mitra — the talking 3D guide on the campus map.

Public (visitors and parents need no account): the model plans a walk across the twin with the
guide_walk tool, and Mitra's voice goes through Sarvam AI (Telugu / Hindi / English). Visitors only
get the public data tools; a signed-in user also gets their own timetable. Every route is rate
limited per user, or per IP for visitors, with an overall visitor cap that protects the Groq quota.
"""
import json
import re
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.ai import agent, campus_guide, campus_tools, voice
from backend.app.api.v1.endpoints.ai import _groq
from backend.app.core.campus_time import campus_now
from backend.app.core.config import settings
from backend.app.core.rate_limit import SlidingWindowLimiter, client_ip
from backend.app.core.security import get_optional_user
from backend.app.db.session import get_db
from backend.app.knowledge import search as kb_search
from backend.app.models.knowledge import KbAskedModel

router = APIRouter()

GUIDE_NAME = "Mitra"

# Every building and area of the campus, with what it's used for (backend/app/ai/campus_guide.py)
PLACES = campus_guide.PLACES


def _whats_where() -> str:
    return "\n".join(f"- {pid} = {p['name']}: {p['short']}" for pid, p in PLACES.items())


LANGUAGES = {"en-IN": "English", "hi-IN": "Hindi (Devanagari script)", "te-IN": "Telugu (Telugu script)"}


def detect_lang(text: str) -> str:
    """Telugu or Hindi by script, else English (Telugu typed in English letters reads as English)."""
    if re.search(r"[ఀ-౿]", text):
        return "te-IN"
    if re.search(r"[ऀ-ॿ]", text):
        return "hi-IN"
    return "en-IN"

GUIDE_PROMPT = f"""You are {GUIDE_NAME}, a young woman who is the friendly guide of MVSR Engineering College, Nadergul, Hyderabad. You appear as a
glowing hologram on a 3D map of the campus and you WALK people to places. You talk with students and with their
parents, many of whom are visiting for the first time. Use simple, warm, respectful words (address parents as
"you", never use jargon). You speak with a woman's voice: in Hindi and Telugu use feminine forms for
yourself (e.g. "चलती हूँ"). Your replies are read aloud, so:
- keep each reply to 1-3 short sentences (up to 5 when answering a college question), no markdown, lists,
  tables, emojis or URLs;
- write phone numbers, amounts, dates and times in digits (the voice reads them correctly), never as words.

Every building and area of the campus (id = name: what it is for):
{_whats_where()}

When the person asks where something is, how to get somewhere, where to collect / submit something, or to be
shown around, ALWAYS call guide_walk. If the question names a certificate, office, department or place in any
language (e.g. bonafide / బోనఫైడ్ / बोनाफाइड → Admin Office in the Civil & IT Block), do not ask a follow-up
question: work out the place from the list above and walk there. Each stop has `say`: what you tell them on arrival (1-2 sentences: what this
place is, what it is used for and what to do there). For a short tour, pick up to 6 stops in a sensible walking order.
When they want to see the WHOLE campus, every building, or a full / complete tour, call full_campus_tour: it walks
every building and area in order with its own narration.
When they ask what a place is, what is inside it or what it is used for, call place_info and answer from it (and walk
there with guide_walk so they can see it). Use services_info for the certificates students request in this app
(bonafide, TC, NOC...: where to apply, approvals, document fees), and building_info / find_room for classrooms and labs.

For ANY other question about the college itself (admissions and eligibility, tuition fees and paying fees,
scholarships and fee reimbursement, hostel, transport, placements, exams, results, revaluation, syllabus, calendar,
departments, faculty, facilities, clubs, committees, accreditation, rankings, rules, contacts, history) call
search_college_info with a short ENGLISH search query (translate Telugu / Hindi questions first). It searches the
official college website. Answer ONLY from what it returns, naming the source briefly ("the college's Hostel page
says..."); never read out a URL. If a result is a document known only by name (a scanned notice or a Drive file),
say the details are in that document and that its link is shown on screen. If the results don't answer the
question, say honestly that the college website doesn't say, and suggest calling the college office (the Contact
page has the numbers). If the answer is about a place on campus, also walk there with guide_walk.
Questions like "is there a hostel / bus / canteen / ...?", "does the college have ...?", "how is / what about ...?"
are college questions too: ALWAYS call search_college_info FIRST, before guide_walk, and put the facts it found
(availability, contact person and phone, timings, fees) into your reply or the arrival `say`. Only a pure "where
is ..." / "take me to ..." / tour request may skip the search.
Never invent offices, floors, timings, fees, numbers, procedures or people: if the tools don't say it, say you are
not sure. Never guess where something is: walk only to a place the place list or a search result names for it
(e.g. a page that says "computer centres" without saying which building means you don't know the building).
Your text reply is what you say as you set off, e.g. "Come, I'll walk you to the Admin Office." /
"चलिए, मैं आपको एडमिन ऑफिस तक ले चलती हूँ।" / "రండి, మిమ్మల్ని అడ్మిన్ ఆఫీస్‌కి తీసుకెళ్తాను.\""""

GUIDE_WALK_TOOL = {"type": "function", "function": {
    "name": "guide_walk",
    "description": "Walk the guide (and the camera) across the 3D campus to one or more places, speaking at each.",
    "parameters": {"type": "object", "properties": {
        "stops": {"type": "array", "minItems": 1, "maxItems": 6, "items": {"type": "object", "properties": {
            "place": {"type": "string", "enum": list(PLACES)},
            "say": {"type": "string", "description": "What to say on arrival, in the reply language."},
        }, "required": ["place", "say"]}},
    }, "required": ["stops"]}}}

FULL_TOUR_TOOL = {"type": "function", "function": {
    "name": "full_campus_tour",
    "description": "The complete guided tour: walk every building and area of the campus in order, narrating each.",
    "parameters": {"type": "object", "properties": {}}}}

SEARCH_TOOL = {"type": "function", "function": {
    "name": "search_college_info",
    "description": "Search the official MVSR college website (pages, PDFs, notices) for facts about the college.",
    "parameters": {"type": "object", "properties": {
        "query": {"type": "string", "description": "A short English search query, e.g. 'hostel fee girls' or 'B.E. fee structure'."},
    }, "required": ["query"]}}}

PLACE_INFO_TOOL = {"type": "function", "function": {
    "name": "place_info",
    "description": "What a building or area is, what is inside it (offices, labs, rooms) and what it is used for.",
    "parameters": {"type": "object", "properties": {
        "place": {"type": "string", "enum": list(PLACES)},
    }, "required": ["place"]}}}

# Visitors see public information only: no section or teacher timetables, never anyone's own data
PUBLIC_TOOLS = {"building_info", "find_room", "services_info", "classes_now"}


def _is_student(current: Optional[dict]) -> bool:
    return bool(current) and current.get("role") == "student"


def _tools(current: Optional[dict]) -> list:
    data = [t for t in campus_tools.TOOLS if current or t["function"]["name"] in PUBLIC_TOOLS]
    # Mitra Agent: only a signed-in student gets the tools that act on their own requests
    return data + [GUIDE_WALK_TOOL, FULL_TOUR_TOOL, PLACE_INFO_TOOL, SEARCH_TOOL] + (agent.TOOLS if _is_student(current) else [])


def _prompt(current: Optional[dict], lang: str, at: Optional[str]) -> str:
    now = campus_now()
    who = {"student": "a student", "faculty": "a faculty member", "staff": "college staff", "admin": "the administrator"}
    person = f"{who.get(current['role'], 'a user')} named {current['name']}" if current else \
        "a visitor (often a parent) who is not signed in; you cannot see anyone's personal records"
    language = f"Reply ONLY in {LANGUAGES[lang]}, including every `say`, even if earlier messages used another language."
    where = f" You are standing at {PLACES[at]['name']}." if at in PLACES else " You are standing at the Main Gate."
    return (GUIDE_PROMPT + (agent.PROMPT if _is_student(current) else "") + f"\n\nNow: {now.strftime('%A %d %B %Y, %H:%M')} India time. You are talking with {person}."
            + where + " " + language)


# Signed-in users are keyed by account, visitors by IP; the overall visitor cap keeps the free Groq quota for everyone
chat_limiter = SlidingWindowLimiter(limit=12, window=60)
visitor_chat_cap = SlidingWindowLimiter(limit=60, window=60)
speak_limiter = SlidingWindowLimiter(limit=30, window=60)
listen_limiter = SlidingWindowLimiter(limit=12, window=60)


def _key(request: Request, current: Optional[dict]) -> str:
    return f"user:{current['sub']}" if current else f"ip:{client_ip(request)}"


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=1500)


class GuideChatRequest(BaseModel):
    messages: List[Turn] = Field(..., min_length=1, max_length=12)
    lang: Literal["auto", "en-IN", "hi-IN", "te-IN"] = "auto"
    at: Optional[str] = Field(None, max_length=20)   # where the guide is standing now (a place id)


class Stop(BaseModel):
    place: str
    name: str
    say: str
    node: str            # walking-graph node she walks to
    look: dict           # {x, z} she turns to and points at


class Source(BaseModel):
    title: str
    url: Optional[str] = None   # None for an uploaded document without a public link


class Proposal(BaseModel):
    """A request Mitra prepared; nothing happens until the student confirms it (POST /confirm)."""
    token: str
    kind: str
    title: str
    lines: List[str]
    fee: int
    first_desk: str
    counter: str


class GuideChatResponse(BaseModel):
    reply: str
    lang: str            # the language Mitra answered in (speak it with this voice)
    stops: List[Stop] = []
    sources: List[Source] = []   # the college pages her answer came from
    proposals: List[Proposal] = []   # requests she prepared, waiting for the student's Confirm


def _set_off(stops: list, lang: str) -> str:
    return (f"Walking now via {', '.join(s.name for s in stops[:6])}{' and more' if len(stops) > 6 else ''}. Now reply "
            f"with ONE short sentence that you say as you set off, entirely in {LANGUAGES[lang]}, using feminine forms "
            f"for yourself. {SET_OFF[lang]} Do not repeat the arrival lines.")


def _stops(raw_args: str, lang: str) -> tuple[list, str]:
    try:
        args = json.loads(raw_args or "{}")
    except json.JSONDecodeError:
        return [], "Error: invalid arguments."
    stops = []
    for s in (args.get("stops") or [])[:6]:
        if not isinstance(s, dict) or s.get("place") not in PLACES:
            return [], f"Error: unknown place {s!r}. Valid ids: {', '.join(PLACES)}"
        stops.append(Stop(**campus_guide.stop(s["place"], voice.speakable(str(s.get("say") or ""))[:400])))
    if not stops:
        return [], "Error: give at least one stop."
    return stops, _set_off(stops, lang)


ANSWERED_SCORE = kb_search.ANSWERED_SCORE


def _search(db: Session, query: str, lang: str, found: list) -> str:
    """Top passages for the model, numbered; logs the query so admins see what people ask."""
    hits = kb_search.current().search(query, k=5) if query.strip() else []
    found.extend(hits)
    top = hits[0]["score"] if hits else 0.0
    try:
        db.add(KbAskedModel(question=query, lang=lang, top_score=top, answered=top >= ANSWERED_SCORE))
        db.commit()
    except Exception:  # noqa: BLE001 — logging must never break an answer
        db.rollback()
    if not hits:
        return json.dumps({"results": [], "note": "Nothing on the college website matches. Say so honestly."})
    return json.dumps({"rules": GROUNDING, "results": [
        {"n": i + 1, "source": h["title"], "section": h.get("heading"), "type": h["kind"],
         "text": h["text"][:900], "checked": (h.get("checked_at") or "")[:10]}
        for i, h in enumerate(hits)]}, ensure_ascii=False)


# Sent with every set of search results: search always returns *something*, so the model must judge it
GROUNDING = ("Use only facts written in these passages. Do not add steps, documents, requirements, locations, "
             "dates or numbers they don't state. If no passage directly answers the question, say plainly that the "
             "college website doesn't have that information and suggest calling the college office; do not walk "
             "anywhere for it. If the exact thing asked for (e.g. 'audit reports') is not named in a passage, say first "
             "that the website doesn't have it, and only then mention a related document as 'you could also look at'. "
             "Walk only when the place list or a passage says where it is.")


def _sources(found: list) -> list:
    """Up to three distinct documents behind the answer (best first)."""
    out, seen = [], set()
    best = max((h["score"] for h in found), default=0)
    for h in sorted(found, key=lambda h: -h["score"]):
        if h["url"] in seen or h["score"] < max(ANSWERED_SCORE * 0.6, best * 0.6):   # only the strong matches
            continue
        seen.add(h["url"])
        out.append(Source(title=h["title"][:120], url=None if h["url"].startswith("upload://") else h["url"]))
        if len(out) == 3:
            break
    return out


# How to start the set-off line in each language (the model once opened Telugu with "చాలా," = "very")
SET_OFF = {
    "en-IN": 'Start with "Come," e.g. "Come, I\'ll walk you to the Library."',
    "hi-IN": 'Start with "चलिए," e.g. "चलिए, मैं आपको लाइब्रेरी तक ले चलती हूँ।"',
    "te-IN": 'Start with "రండి," (come) e.g. "రండి, మిమ్మల్ని లైబ్రరీకి తీసుకెళ్తాను." Never start with "చాలా".',
}
# Openers the model has used that read wrongly aloud, and what to say instead
BAD_OPENERS = {"te-IN": [("చాలా,", "రండి,"), ("చాలా ", "రండి, ")], "hi-IN": [("चलिये,", "चलिए,")]}


def _polish(reply: str, lang: str, walking: bool) -> str:
    """Speakable text, with a known-wrong opening word replaced when she sets off on a walk."""
    reply = voice.speakable(reply)
    if lang == "te-IN":
        reply = reply.replace("మీను ", "మిమ్మల్ని ")    # "you" (object): the model sometimes writes the ungrammatical "మీను"
    if walking:
        for bad, good in BAD_OPENERS.get(lang, []):
            if reply.startswith(bad):
                return good + reply[len(bad):]
    return reply


@router.post("/chat", response_model=GuideChatResponse, summary="Talk to Mitra; she may walk you somewhere")
def guide_chat(req: GuideChatRequest, request: Request, db: Session = Depends(get_db),
               current: Optional[dict] = Depends(get_optional_user)):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="The guide is not configured (GROQ_API_KEY missing on server).")
    if not current:
        visitor_chat_cap.check_and_hit("all", "Mitra is talking with a lot of visitors right now.")
    chat_limiter.check_and_hit(_key(request, current), "You're asking Mitra very quickly.")

    lang = req.lang if req.lang != "auto" else detect_lang(req.messages[-1].content)
    tools = _tools(current)
    allowed = {t["function"]["name"] for t in tools}
    messages = [{"role": "system", "content": _prompt(current, lang, req.at)}] + [m.model_dump() for m in req.messages]
    stops: list = []
    found: list = []          # search results, in order (the sources shown under her answer)
    proposals: list = []      # requests she prepared for the student to confirm

    for _ in range(4):
        msg = _groq(messages, use_tools=True, tools=tools)
        calls = msg.get("tool_calls") or []
        if not calls:
            if not (msg.get("content") or "").strip():
                break     # the model went quiet after its tools: ask for the spoken reply below
            return GuideChatResponse(reply=_polish(msg.get("content") or "", lang, bool(stops)), lang=lang, stops=stops,
                                     sources=_sources(found), proposals=proposals)
        messages.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": calls})
        for call in calls:
            fn = call.get("function", {})
            name = fn.get("name")
            if name not in allowed:
                result = f"Error: tool '{name}' is not available."
            elif name == "guide_walk":
                stops, result = _stops(fn.get("arguments"), lang)
            elif name == "full_campus_tour":
                stops = [Stop(**s) for s in campus_guide.full_tour(lang)]
                result = (f"The full campus tour ({len(stops)} stops, every building and area) is starting at the Main "
                          f"Gate with its own narration. " + _set_off(stops, lang)
                          + " Welcome them and say you will show them the whole campus.")
            elif name == "search_college_info":
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                result = _search(db, str(args.get("query", ""))[:200], lang, found)
            elif name in agent.NAMES:
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                result = agent.run(db, current, name, args if isinstance(args, dict) else {}, proposals)
            elif name == "place_info":
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                result = json.dumps(campus_guide.place_info(str(args.get("place", ""))), ensure_ascii=False)
            else:
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                result = campus_tools.run(db, current, name, args if isinstance(args, dict) else {})
            messages.append({"role": "tool", "tool_call_id": call.get("id"), "content": result})

    final = _groq(messages, use_tools=False)
    reply = (final.get("content") or "").strip() or (QUIET_REPLY["prepared" if proposals else "other"][lang])
    return GuideChatResponse(reply=_polish(reply, lang, bool(stops)), lang=lang, stops=stops,
                             sources=_sources(found), proposals=proposals)


# Said when the model returns no words at all (rare), so Mitra never answers with silence
QUIET_REPLY = {
    "prepared": {"en-IN": "I've prepared it for you. Please check the details and tap Confirm.",
                 "hi-IN": "मैंने आपके लिए तैयार कर दिया है। कृपया विवरण देखकर Confirm दबाइए।",
                 "te-IN": "మీ కోసం సిద్ధం చేశాను. దయచేసి వివరాలు చూసి Confirm నొక్కండి."},
    "other": {"en-IN": "Sorry, could you say that again?",
              "hi-IN": "माफ़ कीजिए, क्या आप फिर से कह सकते हैं?",
              "te-IN": "క్షమించండి, మళ్ళీ చెప్పగలరా?"},
}


class ConfirmRequest(BaseModel):
    token: str = Field(..., max_length=4000)


@router.post("/confirm", summary="Submit a request Mitra prepared, once the student taps Confirm")
def guide_confirm(req: ConfirmRequest, request: Request, db: Session = Depends(get_db),
                  current: Optional[dict] = Depends(get_optional_user)):
    if not current:
        raise HTTPException(status_code=401, detail="Sign in to submit requests.")
    chat_limiter.check_and_hit(_key(request, current), "You're asking Mitra very quickly.")
    return agent.confirm(db, current, req.token)


# ── Voice ──────────────────────────────────────────────────────────────────────

@router.get("/voice", summary="Which server voices Mitra can use (the browser covers the rest)")
def voice_status():
    return {**voice.status(), "languages": list(LANGUAGES)}


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=900)
    lang: Literal["en-IN", "hi-IN", "te-IN"]


@router.post("/speak", summary="Mitra's voice for a line of text (WAV from Sarvam, MP3 from Microsoft)",
             response_class=Response, responses={200: {"content": {"audio/wav": {}, "audio/mpeg": {}}}})
def speak(req: SpeakRequest, request: Request, current: Optional[dict] = Depends(get_optional_user)):
    speak_limiter.check_and_hit(_key(request, current), "Too many voice requests.")
    audio, media, provider = voice.speak(req.text, req.lang)
    return Response(audio, media_type=media,
                    headers={"Cache-Control": "private, max-age=3600", "X-Voice-Provider": provider})


MAX_AUDIO_BYTES = 2 * 1024 * 1024   # ~30 s of compressed speech, Sarvam's limit for this endpoint


@router.post("/listen", summary="What the person said (speech to text, language detected)")
async def listen(request: Request, file: UploadFile = File(...), lang: str = "unknown",
                 current: Optional[dict] = Depends(get_optional_user)):
    listen_limiter.check_and_hit(_key(request, current), "Too many voice requests.")
    audio = await file.read(MAX_AUDIO_BYTES + 1)
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Please keep it under 30 seconds.")
    if not audio:
        raise HTTPException(status_code=400, detail="No audio received.")
    lang = lang if lang in LANGUAGES else "unknown"
    return await run_in_threadpool(voice.listen, audio, file.filename or "speech.webm", file.content_type or "audio/webm", lang)
