// Mitra's Morning Brief: today's classes, substitutes and the student's requests (or a faculty member's
// approvals) in a few lines, built on the server from real records. Mitra can read it aloud.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, FileText, Info, Loader2, Megaphone, MessageCircle, Repeat, Square, Volume2, XCircle } from 'lucide-react';
import { aiApi } from '../../utils/api.js';
import * as voice from '../../utils/mitraVoice.js';

const TONES = {
  good:  { icon: CheckCircle2,  cls: 'text-emerald-300' },
  warn:  { icon: AlertTriangle, cls: 'text-amber-300' },
  bad:   { icon: XCircle,       cls: 'text-rose-300' },
  muted: { icon: Info,          cls: 'text-slate-500' },
};
const KINDS = { classes: CalendarClock, substitution: Repeat, request: FileText, approvals: FileText, notice: Megaphone };

export default function MorningBrief() {
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    aiApi.brief().then(setBrief).catch((e) => setError(e.message));
    return () => voice.stop();
  }, []);

  const listen = async () => {
    if (speaking) { voice.stop(); setSpeaking(false); return; }
    setSpeaking(true);
    try { await voice.speak(brief.speech, 'en-IN'); } finally { setSpeaking(false); }
  };

  const askMitra = () => navigate('/', { state: { openMitra: true } });   // the campus page opens with Mitra ready

  if (error) return null;   // the dashboard below still shows classes and requests
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-cyan-300/20 p-5 sm:p-6"
             style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.10) 0%, rgba(123,97,255,0.10) 100%)' }}
             aria-label="Morning brief from Mitra">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-cyan-300/40 bg-cyan-400/15 text-lg font-bold text-cyan-200 shadow-[0_0_18px_rgba(0,229,255,0.35)]">M</span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">Mitra&rsquo;s brief{brief ? ` · ${brief.date}` : ''}</p>
            <h2 className="font-display text-lg font-bold text-white sm:text-xl">{brief ? brief.greeting : 'Getting your day ready…'}</h2>
          </div>
        </div>
        {brief && (
          <div className="flex gap-2">
            <button onClick={listen} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:border-cyan-300/40">
              {speaking ? <Square size={13} /> : <Volume2 size={13} />} {speaking ? 'Stop' : 'Listen'}
            </button>
            <button onClick={askMitra} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300">
              <MessageCircle size={13} /> Ask Mitra
            </button>
          </div>
        )}
      </div>

      {!brief ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Checking your timetable and requests…</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {brief.items.map((it, i) => {
            const tone = TONES[it.tone];
            const Icon = tone?.icon || KINDS[it.kind] || Info;
            const body = (
              <>
                <Icon size={15} className={`mt-0.5 shrink-0 ${tone?.cls || 'text-cyan-300'}`} />
                <span className={`min-w-0 flex-1 ${it.tone === 'muted' ? 'text-slate-400' : 'text-slate-100'}`}>{it.text}</span>
                {it.link && <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-500" />}
              </>
            );
            return (
              <li key={i}>
                {it.link
                  ? <Link to={it.link} className="flex items-start gap-2.5 rounded-lg px-2 py-1 text-sm hover:bg-white/5">{body}</Link>
                  : <div className="flex items-start gap-2.5 px-2 py-1 text-sm">{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
