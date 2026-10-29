// mitraVoice.js — Mitra's voice in the browser, with fallbacks at every step:
//   speaking:  server voice (Sarvam AI, else Microsoft neural voices)  ->  the browser's best voice
//              for the language  ->  words on screen with a reading pause
//   listening: server (Sarvam AI, else Groq Whisper)  ->  the browser's speech recognition
import { guideApi } from './api.js';

let status = null;   // { speak, listen, speakers, listeners } from the backend, fetched once
export async function voiceStatus() {
  if (!status) status = await guideApi.voice().catch(() => ({ speak: false, listen: false }));
  return status;
}

/** Display names of the engines speak() reports. */
export const ENGINE_NAMES = { sarvam: 'Sarvam AI', microsoft: 'Microsoft neural', browser: 'Browser voice', text: 'Text only' };

// ── Speaking ──────────────────────────────────────────────────────────────────
const clips = new Map();   // `${lang}|${text}` -> Promise<{ url, engine }>
let current = null;        // { audio?, utterance?, finish }

function clip(text, lang) {
  const key = `${lang}|${text}`;
  if (!clips.has(key)) {
    // The server answers with Sarvam's WAV or, when it falls back, Microsoft's MP3
    const p = guideApi.speak(text, lang).then((blob) => ({
      url: URL.createObjectURL(blob), engine: blob.type.includes('mpeg') ? 'microsoft' : 'sarvam',
    }));
    p.catch(() => clips.delete(key));
    clips.set(key, p);
  }
  return clips.get(key);
}

/** Start fetching a line's audio now, so it plays the moment it's needed. */
export async function prefetch(text, lang) {
  if (text && (await voiceStatus()).speak) clip(text, lang).catch(() => {});
}

// The browser loads its voice list lazily: ask once now so it's ready by the first reply
if (typeof window !== 'undefined') window.speechSynthesis?.getVoices();

const readingTime = (text) => Math.min(9000, Math.max(2500, text.length * 65));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The browser loads its voice list lazily and may add voices later (online ones)
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => window.speechSynthesis.getVoices());
}

// Female names of the Indian voices that ship with Windows, Edge, Chrome, Android and Apple devices
const FEMALE = /heera|kalpana|swara|shruti|neerja|lekha|veena|priya|female|woman/i;

/** The browser's best voice for `lang`: exact locale, natural / online (neural) quality, a woman's voice. */
function browserVoice(lang) {
  const voices = window.speechSynthesis?.getVoices() || [];
  const base = lang.slice(0, 2);
  let best = null, bestScore = 0;
  for (const v of voices) {
    const vl = (v.lang || '').replace('_', '-');
    if (!vl.startsWith(base)) continue;
    let score = vl === lang ? 10 : 5;
    if (/natural|neural|online|enhanced|premium/i.test(v.name)) score += 4;
    if (/google/i.test(v.name)) score += 3;
    if (FEMALE.test(v.name)) score += 2;
    if (score > bestScore) { best = v; bestScore = score; }
  }
  return best;
}

/**
 * Say `text` in `lang`, trying the server voice, then the browser's, then words on screen. Resolves
 * with the engine used ('sarvam' | 'microsoft' | 'browser' | 'text') once it has been spoken (a
 * reading pause for 'text', so a tour keeps a natural pace), or early if stop() is called.
 * onEngine(engine) fires as soon as playback starts.
 */
export async function speak(text, lang, { muted = false, onEngine } = {}) {
  stop();
  if (!text) return 'text';
  let finish;
  const done = new Promise((r) => { finish = r; });
  const me = { finish };
  current = me;
  const pause = (engine) => {
    onEngine?.(engine);
    setTimeout(() => finish(engine), readingTime(text));
    return done;
  };
  // Safety net: some browsers never report the end of speech; don't let a tour hang on it
  setTimeout(() => finish('text'), readingTime(text) * 2 + 4000);
  if (muted) return pause('text');

  // 1. The server's voice (Sarvam, or Microsoft when Sarvam is down)
  if ((await voiceStatus()).speak) {
    try {
      const { url, engine } = await clip(text, lang);
      if (current !== me) return done;          // stopped while the clip loaded
      const audio = new Audio(url);
      me.audio = audio;
      audio.onended = () => finish(engine);
      audio.onerror = () => finish(engine);
      await audio.play();
      onEngine?.(engine);
      return done;
    } catch {
      /* server voice failed or autoplay was blocked: the browser's voice is next */
    }
  }
  if (current !== me) return done;

  // 2. The browser's own voice for the language
  const synth = window.speechSynthesis;
  const voice = synth && browserVoice(lang);
  if (!voice) return pause('text');             // 3. no voice for it here (e.g. Telugu): words on screen
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.95;
  u.onend = () => finish('browser');
  u.onerror = () => finish('browser');
  me.utterance = u;
  synth.speak(u);
  onEngine?.('browser');
  return done;
}

export function stop() {
  if (!current) return;
  const c = current;
  current = null;
  if (c.audio) { c.audio.pause(); c.audio.src = ''; }
  if (c.utterance) window.speechSynthesis.cancel();
  c.finish('stopped');
}

// ── Listening ─────────────────────────────────────────────────────────────────
const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export async function canListen() {
  const s = await voiceStatus();
  return (s.listen && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') || !!Recognition;
}

/**
 * Start listening. Returns { stop(): Promise<{ transcript, lang }> } — call stop() when the person
 * has finished (the browser recogniser may also finish by itself; stop() then just returns its result).
 * lang: 'auto' or a language code; Sarvam detects the language, the browser needs one.
 */
export async function listen(lang) {
  const s = await voiceStatus();
  if (s.listen && !serverEarsDown && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    let rec;
    try {
      rec = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      return listenInBrowser(lang);           // can't record here: the browser recogniser instead
    }
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start();
    const cap = setTimeout(() => rec.state === 'recording' && rec.stop(), 25000);   // Sarvam's limit is ~30 s
    const stopped = new Promise((r) => { rec.onstop = r; });
    return {
      async stop() {
        clearTimeout(cap);
        if (rec.state === 'recording') rec.stop();
        await stopped;
        stream.getTracks().forEach((t) => t.stop());
        const audio = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (audio.size < 1200) return { transcript: '', lang: null };   // a tap, not speech
        try {
          return await guideApi.listen(audio, lang === 'auto' ? 'unknown' : lang);
        } catch (e) {
          // Every server recogniser failed: the next tap uses the browser's, where there is one
          if (Recognition) serverEarsDown = true;
          throw new Error(Recognition ? "I couldn't hear that clearly. Please tap the mic and say it again."
            : `Voice input failed: ${e.message} Please type instead.`);
        }
      },
    };
  }
  return listenInBrowser(lang);
}

let serverEarsDown = false;   // set when the server's recognisers failed this session

/** The browser's own speech recognition (Chrome / Edge; needs a language, 'auto' means English). */
function listenInBrowser(lang) {
  if (!Recognition) throw new Error('Voice input is not supported in this browser. Please type instead.');
  const r = new Recognition();
  r.lang = lang === 'auto' ? 'en-IN' : lang;
  r.interimResults = false;
  r.maxAlternatives = 1;
  let transcript = '';
  let failure = null;
  const ended = new Promise((resolve) => { r.onend = resolve; });
  r.onresult = (e) => { transcript = Array.from(e.results).map((x) => x[0].transcript).join(' '); };
  r.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') failure = e.error; };
  r.start();
  return {
    async stop() {
      try { r.stop(); } catch { /* already ended */ }
      await ended;
      if (failure === 'not-allowed') throw new Error('Microphone permission was denied.');
      if (failure) throw new Error(`Voice input failed (${failure}).`);
      return { transcript: transcript.trim(), lang: lang === 'auto' ? null : lang };
    },
    ended,
  };
}

export { wait };
