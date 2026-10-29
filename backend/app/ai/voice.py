"""
Mitra's voice: text to speech and speech to text for Telugu, Hindi and English, through a chain of
providers so she keeps talking when one is down or out of credits.

  speaking:  Sarvam AI (bulbul)  ->  Microsoft neural voices (edge-tts, no key)
  listening: Sarvam AI (saaras)  ->  Groq Whisper (the assistant's GROQ_API_KEY)

The browser's own voices / speech recognition are the last fallback, in src/utils/mitraVoice.js.
Keys stay on the server. A provider that fails is skipped for a few minutes so every request
doesn't wait on it, and synthesised audio is cached (the same tour lines repeat a lot).
"""
import asyncio
import base64
import hashlib
import re
import threading
import time
from collections import OrderedDict

import httpx
from fastapi import HTTPException

from backend.app.core.config import settings

try:
    import edge_tts
except ImportError:          # optional dependency: Microsoft voices are skipped without it
    edge_tts = None

SARVAM = "https://api.sarvam.ai"
GROQ_STT = "https://api.groq.com/openai/v1/audio/transcriptions"
CACHE_SIZE = 200             # ~200 short clips, a few MB
COOL_DOWN = 300              # seconds a failing provider is skipped

# Microsoft neural voices (female, to match Sarvam's)
MICROSOFT_VOICES = {"te-IN": "te-IN-ShrutiNeural", "hi-IN": "hi-IN-SwaraNeural", "en-IN": "en-IN-NeerjaNeural"}
WHISPER_LANGS = {"telugu": "te-IN", "hindi": "hi-IN", "english": "en-IN", "te": "te-IN", "hi": "hi-IN", "en": "en-IN"}


class VoiceError(Exception):
    """One provider failed; the chain moves on to the next."""


def speakable(text: str) -> str:
    """Strip the markdown a model sometimes adds anyway, so it isn't read aloud as symbols."""
    text = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), text)   # "&" copied from JSON
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)      # [label](url) -> label
    text = re.sub(r"[*_`#>|]+", "", text)
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.M)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n{2,}", "\n", text)).strip()


# ── Provider health ─────────────────────────────────────────────────────────────
_down_until: dict = {}
_lock = threading.Lock()


def _healthy(name: str) -> bool:
    return _down_until.get(name, 0) < time.monotonic()


def _failed(name: str, why: str):
    print(f"[voice] {name} failed, skipping it for {COOL_DOWN // 60} min: {why}")
    _down_until[name] = time.monotonic() + COOL_DOWN


def _configured_speakers() -> list:
    out = []
    if settings.SARVAM_API_KEY:
        out.append("sarvam")
    if edge_tts is not None:
        out.append("microsoft")
    return out


def _configured_listeners() -> list:
    out = []
    if settings.SARVAM_API_KEY:
        out.append("sarvam")
    if settings.GROQ_API_KEY:
        out.append("groq")
    return out


def status() -> dict:
    """What the server can do; the browser fills any gap with its own voices."""
    return {"speak": bool(_configured_speakers()), "listen": bool(_configured_listeners()),
            "speakers": _configured_speakers(), "listeners": _configured_listeners()}


# ── Speaking ───────────────────────────────────────────────────────────────────

def _sarvam_post(path: str, **kwargs) -> dict:
    try:
        r = httpx.post(f"{SARVAM}{path}", headers={"api-subscription-key": settings.SARVAM_API_KEY}, timeout=20, **kwargs)
    except httpx.HTTPError as e:
        raise VoiceError(f"unreachable ({type(e).__name__})")
    if r.status_code != 200:
        raise VoiceError(f"HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


def _speak_sarvam(text: str, lang: str) -> tuple[bytes, str]:
    data = _sarvam_post("/text-to-speech", json={
        "text": text, "language_code": lang, "model": settings.SARVAM_TTS_MODEL,
        "speaker": settings.SARVAM_SPEAKER, "pace": 1.0, "speech_sample_rate": 22050, "output_audio_codec": "wav",
    })
    audio = base64.b64decode("".join(data.get("audios") or []))
    if not audio:
        raise VoiceError("no audio returned")
    return audio, "audio/wav"


def _speak_microsoft(text: str, lang: str) -> tuple[bytes, str]:
    async def run():
        chunks = []
        async for part in edge_tts.Communicate(text, MICROSOFT_VOICES[lang]).stream():
            if part["type"] == "audio":
                chunks.append(part["data"])
        return b"".join(chunks)
    try:
        audio = asyncio.run(asyncio.wait_for(run(), timeout=20))   # sync endpoints run in a worker thread
    except Exception as e:  # noqa: BLE001 — any failure just moves on to the next voice
        raise VoiceError(f"{type(e).__name__}: {e}")
    if not audio:
        raise VoiceError("no audio returned")
    return audio, "audio/mpeg"


SPEAKERS = {"sarvam": _speak_sarvam, "microsoft": _speak_microsoft}
_cache: "OrderedDict[str, tuple]" = OrderedDict()


def speak(text: str, lang: str) -> tuple[bytes, str, str]:
    """(audio, media type, provider) for `text` spoken in `lang` (en-IN / hi-IN / te-IN)."""
    text = speakable(text)
    key = hashlib.sha256(f"{settings.SARVAM_SPEAKER}|{lang}|{text}".encode()).hexdigest()
    with _lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    tried = []
    for name in _configured_speakers():
        if not _healthy(name):
            continue
        try:
            audio, media = SPEAKERS[name](text, lang)
        except VoiceError as e:
            _failed(name, str(e))
            tried.append(name)
            continue
        result = (audio, media, name)
        with _lock:
            _cache[key] = result
            while len(_cache) > CACHE_SIZE:
                _cache.popitem(last=False)
        return result
    raise HTTPException(status_code=503, detail="No server voice is available right now"
                        + (f" ({', '.join(tried)} failed)." if tried else "."))


# ── Listening ──────────────────────────────────────────────────────────────────

def _listen_sarvam(audio: bytes, filename: str, content_type: str, lang: str) -> dict:
    data = _sarvam_post("/speech-to-text", files={"file": (filename, audio, content_type)},
                        data={"model": settings.SARVAM_STT_MODEL, "language_code": lang})
    heard = data.get("language_code")
    return {"transcript": (data.get("transcript") or "").strip(), "lang": heard if heard in MICROSOFT_VOICES else None}


def _listen_groq(audio: bytes, filename: str, content_type: str, lang: str) -> dict:
    form = {"model": "whisper-large-v3", "response_format": "verbose_json", "temperature": "0"}
    if lang in MICROSOFT_VOICES:
        form["language"] = lang[:2]
    try:
        r = httpx.post(GROQ_STT, headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                       files={"file": (filename, audio, content_type)}, data=form, timeout=30)
    except httpx.HTTPError as e:
        raise VoiceError(f"unreachable ({type(e).__name__})")
    if r.status_code != 200:
        raise VoiceError(f"HTTP {r.status_code}: {r.text[:200]}")
    data = r.json()
    return {"transcript": (data.get("text") or "").strip(), "lang": WHISPER_LANGS.get((data.get("language") or "").lower())}


LISTENERS = {"sarvam": _listen_sarvam, "groq": _listen_groq}


def listen(audio: bytes, filename: str, content_type: str, lang: str = "unknown") -> dict:
    """{transcript, lang, provider}: what was said, and the language heard (None if unsure)."""
    tried = []
    for name in _configured_listeners():
        if not _healthy(name):
            continue
        try:
            return {**LISTENERS[name](audio, filename, content_type, lang), "provider": name}
        except VoiceError as e:
            _failed(name, str(e))
            tried.append(name)
    raise HTTPException(status_code=503, detail="Voice input is not available right now"
                        + (f" ({', '.join(tried)} failed)." if tried else "."))
