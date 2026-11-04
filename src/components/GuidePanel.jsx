// GuidePanel.jsx — talk to Mitra, the hologram guide on the 3D campus. Ask by voice or text in
// English, Hindi or Telugu; she answers aloud and walks you there on the map. This panel directs the
// tour (one leg at a time through the store); SuhruthDigitalTwin.jsx moves her and the camera.
import { Check, ChevronDown, ChevronUp, ExternalLink, FileCheck, FileText, Loader2, MapPin, Mic, Send, SkipForward, Square, Volume2, VolumeX, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useCampusStore } from '../store/useCampusStore.js';
import { guideApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import * as voice from '../utils/mitraVoice.js';

const LANGS = [
  { code: 'auto', label: 'Auto' },
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'te-IN', label: 'తెలుగు' },
];

const SUGGESTIONS = {
  'en-IN': ['Show me the full campus', 'Is there a hostel for girls?', 'How do I pay the fees online?', 'Where do I get a bonafide certificate?'],
  'hi-IN': ['मुझे पूरा कैंपस दिखाइए', 'क्या लड़कियों के लिए हॉस्टल है?', 'फीस ऑनलाइन कैसे भरें?', 'बोनाफाइड सर्टिफिकेट कहाँ मिलेगा?'],
  'te-IN': ['పూర్తి క్యాంపస్ చూపించండి', 'అమ్మాయిలకు హాస్టల్ ఉందా?', 'ఫీజు ఆన్‌లైన్‌లో ఎలా కట్టాలి?', 'బోనఫైడ్ సర్టిఫికేట్ ఎక్కడ తీసుకోవాలి?'],
};

// Mitra Agent: signed-in students can also ask her to request documents and track them
const STUDENT_SUGGESTIONS = {
  'en-IN': ['I need a bonafide for my passport', 'Where is my request?'],
  'hi-IN': ['मुझे पासपोर्ट के लिए बोनाफाइड चाहिए', 'मेरी रिक्वेस्ट कहाँ है?'],
  'te-IN': ['పాస్‌పోర్ట్ కోసం బోనఫైడ్ కావాలి', 'నా రిక్వెస్ట్ ఎక్కడ ఉంది?'],
};

const GREETING = {
  'en-IN': "Namaste! I'm Mitra. Ask me anything about the college (admissions, fees, hostel, exams, placements) or where something is, and I'll walk you there.",
  'hi-IN': 'नमस्ते! मैं मित्रा हूँ। कॉलेज के बारे में कुछ भी पूछिए (एडमिशन, फीस, हॉस्टल, परीक्षा, प्लेसमेंट) या कोई जगह, मैं आपको वहाँ ले चलूँगी।',
  'te-IN': 'నమస్తే! నేను మిత్ర. కాలేజీ గురించి ఏదైనా అడగండి (అడ్మిషన్లు, ఫీజులు, హాస్టల్, పరీక్షలు, ప్లేస్‌మెంట్లు) లేదా ఏదైనా ప్రదేశం, నేను మిమ్మల్ని అక్కడికి తీసుకెళ్తాను.',
};

const MAX_HISTORY = 10;

export default function GuidePanel({ defaultOpen = false }) {
  const { user } = useAuth();
  const open = useCampusStore((s) => s.guideOpen);
  const setOpen = useCampusStore((s) => s.setGuideOpen);
  const [lang, setLang] = useState('auto');
  const [messages, setMessages] = useState([]);       // { role: 'user' | 'mitra', text, place? }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [tour, setTour] = useState(null);              // { stops, step, done, here }
  const [expanded, setExpanded] = useState(false);     // full panel while she walks (else a slim bar)
  const [hint, setHint] = useState(null);
  const [engine, setEngine] = useState(null);         // which voice is speaking: sarvam | microsoft | browser | text
  const run = useRef(0);                               // bumps to cancel a running tour
  const mic = useRef(null);
  const askRef = useRef(null);
  const bottom = useRef(null);
  const shownLang = lang === 'auto' ? 'en-IN' : lang;

  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen, setOpen]);
  useEffect(() => () => { run.current++; voice.stop(); useCampusStore.getState().setGuideOpen(false); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const cancelTour = () => {
    run.current++;
    voice.stop();
    useCampusStore.getState().stopGuide();
    setTour((t) => (t ? { ...t, done: true } : t));
  };

  const close = () => { cancelTour(); setOpen(false); };

  // Speak a line through the fallback chain, showing which engine spoke it
  const say = (text, replyLang) => voice.speak(text, replyLang, { muted, onEngine: (e) => {
    setEngine(e);
    if (e === 'text' && !muted) {
      setHint(replyLang === 'en-IN' ? 'No voice is available right now, so Mitra shows her words on screen.'
        : `No ${replyLang === 'te-IN' ? 'Telugu' : 'Hindi'} voice is available right now, so Mitra shows her words on screen.`);
    }
  } });

  async function playTour(id, reply, replyLang, stops) {
    const store = useCampusStore.getState();
    stops.forEach((s) => voice.prefetch(s.say, replyLang));
    store.setGuideBubble(reply);
    let speaking = say(reply, replyLang);
    for (let i = 0; i < stops.length; i++) {
      if (run.current !== id) return;
      setTour({ stops, step: i, done: false, here: false });
      await store.walkGuideTo(stops[i].place, stops[i].node, stops[i].look);
      if (run.current !== id) return;
      setTour({ stops, step: i, done: false, here: true });
      await speaking;                                   // let her finish the previous line
      if (run.current !== id) return;
      store.setGuideBubble(stops[i].say);
      setMessages((m) => [...m, { role: 'mitra', text: stops[i].say, place: stops[i].name }]);
      speaking = say(stops[i].say, replyLang);
      await speaking;
      await voice.wait(500);
    }
    await speaking;
    if (run.current !== id) return;
    setTour({ stops, step: stops.length, done: true });
    setTimeout(() => { if (run.current === id) useCampusStore.getState().setGuideBubble(null); }, 4000);
  }

  async function ask(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    cancelTour();
    setInput('');
    setHint(null);
    const history = [...messages.filter((m) => !m.place), { role: 'user', text: q }];
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    const id = run.current;
    try {
      const turns = history.slice(-MAX_HISTORY).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text.slice(0, 1500) }));
      const { reply, lang: replyLang, stops, sources, proposals } = await guideApi.chat(turns, lang, useCampusStore.getState().guideAt);
      if (run.current !== id) return;
      setMessages((m) => [...m, { role: 'mitra', text: reply, sources,
                                  proposals: (proposals || []).map((pr) => ({ ...pr, state: 'pending' })) }]);
      if (stops?.length) {
        setExpanded(false);                             // the map is the show: shrink to the bar
        playTour(id, reply, replyLang, stops);
      }
      else {
        useCampusStore.getState().setGuideBubble(reply);
        say(reply, replyLang);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'mitra', text: `Sorry, I couldn't answer just now. ${e.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  // A request Mitra prepared: nothing is submitted until the student taps Confirm
  const setProposal = (msgIndex, token, patch) => setMessages((all) => all.map((m, i) => (i !== msgIndex ? m
    : { ...m, proposals: m.proposals.map((pr) => (pr.token === token ? { ...pr, ...patch } : pr)) })));

  async function confirmProposal(msgIndex, pr) {
    setProposal(msgIndex, pr.token, { state: 'sending', error: null });
    try {
      const req = await guideApi.confirm(pr.token);
      setProposal(msgIndex, pr.token, { state: 'done', ref: req.ref_no });
      const line = req.status === 'awaiting_payment'
        ? `Done. Your ${req.doc_name} request is ${req.ref_no}. Pay Rs ${req.amount} on the Services page to start the approvals.`
        : `Done. Your ${req.doc_name} request is ${req.ref_no}, and it's with your ${req.current_label} now. I'll keep track of it for you.`;
      setMessages((m) => [...m, { role: 'mitra', text: line }]);
      useCampusStore.getState().setGuideBubble(line);
      say(line, 'en-IN');
    } catch (e) {
      setProposal(msgIndex, pr.token, { state: 'pending', error: e.message });
    }
  }

  // Send what the microphone heard. Uses refs only: the browser recogniser calls it from an old render.
  async function finishMic() {
    const m = mic.current;
    mic.current = null;
    setListening(false);
    if (!m) return;
    setBusy(true);
    try {
      const { transcript } = await m.stop();
      setBusy(false);
      if (transcript) askRef.current(transcript);
      else setHint("I didn't catch that. Tap the mic and speak again, or type your question.");
    } catch (e) {
      setBusy(false);
      setHint(e.message);
    }
  }

  async function toggleMic() {
    if (mic.current) return finishMic();
    cancelTour();
    setHint(null);
    try {
      const m = await voice.listen(lang);
      mic.current = m;
      setListening(true);
      m.ended?.then(() => { if (mic.current === m) finishMic(); });   // it stops by itself after a pause
    } catch (e) {
      setHint(e.name === 'NotAllowedError' ? 'Microphone permission was denied.' : e.message);
    }
  }

  askRef.current = ask;
  const greeting = GREETING[shownLang];
  const isStudent = user?.role === 'student';
  const suggestions = isStudent ? [...STUDENT_SUGGESTIONS[shownLang], ...SUGGESTIONS[shownLang].slice(0, 2)] : SUGGESTIONS[shownLang];
  const walking = !!tour && !tour.done;
  const compact = walking && !expanded;
  // Next: skip what she's saying and fast-forward to the next stop
  const next = () => { voice.stop(); useCampusStore.getState().hurryGuide(); };
  const nextButton = (
    <button type="button" onClick={next}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
      aria-label="Next stop" title="Next stop">
      <SkipForward size={14} />
    </button>
  );
  const lastLine = [...messages].reverse().find((m) => m.role === 'mitra' && !m.error)?.text;
  const muteButton = (
    <button type="button" onClick={() => { setMuted((m) => !m); voice.stop(); }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
      aria-label={muted ? 'Turn Mitra\'s voice on' : 'Mute Mitra'} title={muted ? 'Voice off' : 'Voice on'}>
      {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
    </button>
  );

  return (
    // On desktop she sits just right of the sidebar (Shell sets --sw to its width)
    <div className="keep-dark fixed bottom-5 left-5 z-50 lg:left-[calc(var(--sw,0px)+1.25rem)]">
      <AnimatePresence mode="wait">
        {open && compact && (
          // While she walks: a slim bar, so the 3D map (and Mitra) stay in view
          <motion.div
            key="bar"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="mb-1 flex w-[min(24rem,calc(100vw-2.5rem))] items-center gap-2.5 rounded-2xl py-2 pl-2 pr-1.5 shadow-glass"
            style={{
              background: 'linear-gradient(150deg, rgba(3,12,28,0.9) 0%, rgba(4,30,48,0.86) 100%)',
              border: '1px solid rgba(0,229,255,0.25)',
              backdropFilter: 'blur(24px) saturate(170%)',
              WebkitBackdropFilter: 'blur(24px) saturate(170%)',
            }}
            role="status"
            aria-label="Mitra is guiding you"
          >
            <HoloBadge size={34} pulse={!tour.here} />
            <div className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-300">
                {tour.here ? <MapPin size={11} className="shrink-0" /> : <Loader2 size={11} className="shrink-0 animate-spin" />}
                <span className="truncate">{tour.here ? 'At' : 'Walking to'} {tour.stops[tour.step]?.name}</span>
                <span className="shrink-0 font-normal text-slate-400">· {tour.step + 1} of {tour.stops.length}</span>
              </span>
              <span className="block truncate text-xs text-slate-200" title={lastLine}>{lastLine}</span>
            </div>
            {muteButton}
            {nextButton}
            <button type="button" onClick={cancelTour}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Stop the walk" title="Stop">
              <Square size={13} />
            </button>
            <button type="button" onClick={() => setExpanded(true)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-cyan-200 transition hover:bg-white/10"
              aria-label="Open the full conversation" title="Open the conversation">
              <ChevronUp size={15} />
            </button>
          </motion.div>
        )}
        {open && !compact && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="mb-4 w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl shadow-glass"
            style={{
              background: 'linear-gradient(150deg, rgba(3,12,28,0.94) 0%, rgba(4,30,48,0.9) 100%)',
              border: '1px solid rgba(0,229,255,0.22)',
              backdropFilter: 'blur(32px) saturate(170%)',
              WebkitBackdropFilter: 'blur(32px) saturate(170%)',
            }}
            role="dialog"
            aria-label="Mitra, the campus guide"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cyan-300/10 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <HoloBadge size={34} />
                <div>
                  <span className="block text-sm font-bold text-white">Mitra</span>
                  <span className="block text-[10px] text-cyan-300">
                    AI campus guide · walks you there
                    {engine && !muted && <span className="text-slate-400"> · voice: {voice.ENGINE_NAMES[engine]}</span>}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {walking && (
                  <button type="button" onClick={() => setExpanded(false)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
                    aria-label="Shrink to a bar and watch the map" title="Watch the map">
                    <ChevronDown size={15} />
                  </button>
                )}
                {muteButton}
                <button type="button" onClick={close}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Close Mitra">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Language */}
            <div className="flex gap-1.5 border-b border-cyan-300/10 px-4 py-2" role="radiogroup" aria-label="Language">
              {LANGS.map((l) => (
                <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} onClick={() => setLang(l.code)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${lang === l.code
                    ? 'bg-cyan-300 text-slate-900' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                  {l.label}
                </button>
              ))}
            </div>

            {/* Conversation */}
            {/* Shrinks on short screens so the whole panel (languages to mic) always fits */}
            <div className="no-scrollbar max-h-[clamp(4.5rem,calc(100vh-27rem),16rem)] space-y-2 overflow-y-auto px-4 py-3">
              {messages.length === 0 && <p className="py-2 text-sm leading-relaxed text-slate-300">{greeting}</p>}
              {messages.map((m, i) => (
                <div key={i} className={`rounded-xl px-3.5 py-2 text-sm leading-relaxed ${m.role === 'user'
                  ? 'ml-10 border border-cyan-300/15 bg-cyan-300/10 text-cyan-100'
                  : m.error ? 'border border-rose-400/20 bg-rose-400/10 text-rose-200' : 'border border-white/8 bg-white/5 text-slate-100'}`}>
                  {m.place && <span className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-cyan-300"><MapPin size={10} /> {m.place}</span>}
                  {m.text}
                  {m.sources?.length > 0 && (
                    // Where the answer came from: the college's own pages and documents
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {m.sources.map((src) => (src.url ? (
                        <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 rounded-md border border-cyan-300/20 bg-cyan-300/5 px-1.5 py-0.5 text-[10px] text-cyan-200 transition hover:bg-cyan-300/15"
                          title={`Source: ${src.title}`}>
                          <FileText size={10} className="shrink-0" /><span className="truncate">{src.title}</span><ExternalLink size={9} className="shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <span key={src.title} className="inline-flex max-w-full items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                          <FileText size={10} className="shrink-0" /><span className="truncate">{src.title}</span>
                        </span>
                      )))}
                    </span>
                  )}
                  {m.proposals?.map((pr) => (
                    <ProposalCard key={pr.token} pr={pr} onConfirm={() => confirmProposal(i, pr)}
                      onCancel={() => setProposal(i, pr.token, { state: 'cancelled' })} />
                  ))}
                </div>
              ))}
              {busy && (
                <div className="flex w-16 items-center justify-center gap-1 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5">
                  {[0, 0.1, 0.2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" style={{ animationDelay: `${d}s` }} />)}
                </div>
              )}
              <div ref={bottom} />
            </div>

            {/* Tour progress */}
            {tour && (
              <div className="flex items-center gap-2 border-t border-cyan-300/10 px-4 py-2">
                {tour.stops.length > 6 ? (
                  // The full campus tour: a progress bar instead of 21 chips
                  <div className="min-w-0 flex-1">
                    <span className={`flex items-center gap-1 text-[11px] ${tour.done ? 'text-emerald-300' : 'text-cyan-200'}`}>
                      {tour.done ? <Check size={11} /> : <Loader2 size={11} className="animate-spin" />}
                      <span className="truncate">{tour.done ? 'Full campus tour' : tour.stops[tour.step]?.name}</span>
                      <span className="shrink-0 text-slate-400">· {Math.min(tour.step + 1, tour.stops.length)} of {tour.stops.length}</span>
                    </span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-cyan-300 transition-all duration-500"
                        style={{ width: `${(Math.min(tour.step + (tour.here || tour.done ? 1 : 0.5), tour.stops.length) / tour.stops.length) * 100}%` }} />
                    </span>
                  </div>
                ) : (
                <ol className="flex flex-1 flex-wrap items-center gap-1.5 text-[11px]">
                  {tour.stops.map((s, i) => {
                    const passed = i < tour.step || (tour.done && i <= tour.step);
                    const now = i === tour.step && !tour.done;
                    return (
                      <li key={i} className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${now ? 'bg-cyan-300/20 text-cyan-200' : passed ? 'text-emerald-300' : 'text-slate-500'}`}>
                        {passed ? <Check size={11} /> : now ? <Loader2 size={11} className="animate-spin" /> : <MapPin size={11} />}
                        {s.name}
                      </li>
                    );
                  })}
                </ol>
                )}
                {!tour.done && nextButton}
                {!tour.done && (
                  <button type="button" onClick={cancelTour} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10" aria-label="Stop the walk">
                    <Square size={10} /> Stop
                  </button>
                )}
              </div>
            )}

            {hint && <p className="border-t border-cyan-300/10 px-4 py-2 text-[11px] leading-snug text-amber-200/90">{hint}</p>}

            {/* Suggestions */}
            <div className="flex flex-wrap gap-1.5 border-t border-cyan-300/10 px-4 py-2.5">
              {suggestions.map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => ask(s)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 border-t border-cyan-300/10 px-4 py-3">
              <button type="button" onClick={toggleMic} disabled={busy && !listening}
                className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition disabled:opacity-50 ${listening
                  ? 'bg-rose-500 text-white' : 'bg-cyan-300 text-slate-900 hover:bg-cyan-200'}`}
                aria-label={listening ? 'Stop and send' : 'Speak to Mitra'} title={listening ? 'Tap when you finish speaking' : 'Tap and speak'}>
                {listening && <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/50" />}
                {listening ? <Square size={14} className="relative" /> : <Mic size={18} />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask()}
                disabled={busy || listening}
                placeholder={listening ? 'Listening… tap ■ when done' : 'Ask, or tap the mic and speak'}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 disabled:opacity-60"
                aria-label="Your question"
              />
              <button type="button" onClick={() => ask()} disabled={!input.trim() || busy}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-cyan-200 transition hover:bg-white/15 disabled:opacity-40" aria-label="Send">
                <Send size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 rounded-2xl border border-cyan-300/30 py-2 pl-2 pr-4 text-left shadow-glow"
          style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.16), rgba(4,20,40,0.9))', backdropFilter: 'blur(20px)' }}
          aria-label="Ask Mitra, the campus guide"
        >
          <HoloBadge size={38} pulse />
          <span>
            <span className="block text-sm font-bold text-white">Ask Mitra</span>
            <span className="block text-[10px] text-cyan-200">మిత్రను అడగండి · मित्रा से पूछिए</span>
          </span>
        </motion.button>
      )}
    </div>
  );
}

/** A request Mitra prepared, with the Confirm button that actually submits it. */
function ProposalCard({ pr, onConfirm, onCancel }) {
  const done = pr.state === 'done';
  return (
    <span className={`mt-2 block rounded-lg border p-2.5 ${done ? 'border-emerald-400/30 bg-emerald-400/10' : pr.state === 'cancelled'
      ? 'border-white/10 bg-white/[0.03] opacity-60' : 'border-cyan-300/30 bg-cyan-300/[0.07]'}`}>
      <span className="flex items-center gap-1.5 text-xs font-bold text-white">
        <FileCheck size={13} className="shrink-0 text-cyan-300" /> {pr.title}
        {pr.fee > 0 && <span className="ml-auto shrink-0 rounded bg-amber-400/15 px-1.5 text-[10px] font-semibold text-amber-200">Rs {pr.fee}</span>}
      </span>
      <span className="mt-1 block space-y-0.5 text-[11px] leading-snug text-slate-300">
        {pr.lines.map((l) => <span key={l} className="block">{l}</span>)}
      </span>
      {pr.error && <span className="mt-1 block text-[11px] text-rose-300">{pr.error}</span>}
      {done ? (
        <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-300"><Check size={12} /> Submitted · {pr.ref}</span>
      ) : pr.state === 'cancelled' ? (
        <span className="mt-2 block text-[11px] text-slate-400">Not submitted.</span>
      ) : (
        <span className="mt-2 flex gap-1.5">
          <button type="button" onClick={onConfirm} disabled={pr.state === 'sending'}
            className="inline-flex items-center gap-1 rounded-md bg-cyan-300 px-2.5 py-1 text-[11px] font-bold text-slate-900 hover:bg-cyan-200 disabled:opacity-60">
            {pr.state === 'sending' ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Confirm &amp; submit
          </button>
          <button type="button" onClick={onCancel} disabled={pr.state === 'sending'}
            className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10">Not now</button>
        </span>
      )}
    </span>
  );
}

/** Mitra's little hologram portrait. */
function HoloBadge({ size, pulse = false }) {
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: 'radial-gradient(circle at 50% 35%, rgba(0,229,255,0.35), rgba(0,229,255,0.05) 70%)', border: '1px solid rgba(0,229,255,0.45)' }}>
      {pulse && <span className="absolute inset-0 animate-ping rounded-full border border-cyan-300/40" />}
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="#7DF9FF" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="7" r="3.2" />
        <path d="M6 21c0-4.2 2.7-7.5 6-7.5s6 3.3 6 7.5" />
        <path d="M4 21h16" strokeOpacity="0.5" />
      </svg>
    </span>
  );
}
