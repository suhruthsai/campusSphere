// Mitra's Morning Brief: today's classes, substitutes and the student's requests (or a faculty member's
// approvals) in a few lines, built on the server from real records. Mitra can read it aloud.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, FileText, Info, Loader2, Megaphone, MessageCircle, Repeat, Square, Volume2, XCircle } from 'lucide-react';
import { aiApi } from '../../utils/api.js';
import * as voice from '../../utils/mitraVoice.js';

const TONES = {
  good:  { icon: CheckCircle2,  color: '#10b981' },
  warn:  { icon: AlertTriangle, color: '#f59e0b' },
  bad:   { icon: XCircle,       color: '#f43f5e' },
  muted: { icon: Info,          color: 'var(--text-3)' },
};
const KINDS = { classes: CalendarClock, substitution: Repeat, request: FileText, approvals: FileText, notice: Megaphone };

export default function MorningBrief({ className = '' }) {
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
    <section className={`ds-card relative overflow-hidden p-5 sm:p-6 ${className}`}
             style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-1) 12%, var(--surface-solid)) 0%, color-mix(in srgb, var(--brand-2) 13%, var(--surface-solid)) 100%)', borderColor: 'var(--border-strong)' }}
             aria-label="Morning brief from Mitra">
      <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--brand-grad)' }} />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-extrabold text-white" style={{ background: 'var(--brand-grad)', boxShadow: '0 8px 24px rgba(99,102,241,0.45)' }}>M</span>
          <div>
            <p className="ds-eyebrow">Mitra&rsquo;s brief{brief ? ` · ${brief.date}` : ''}</p>
            <h2 className="font-display text-lg font-bold sm:text-xl" style={{ color: 'var(--text)' }}>{brief ? brief.greeting : 'Getting your day ready…'}</h2>
          </div>
        </div>
        {brief && (
          <div className="flex gap-2">
            <button onClick={listen} className="ds-chip">
              {speaking ? <Square size={13} /> : <Volume2 size={13} />} {speaking ? 'Stop' : 'Listen'}
            </button>
            <button onClick={askMitra} className="ds-btn !rounded-xl !px-4 !py-2 !text-xs">
              <MessageCircle size={13} /> Ask Mitra
            </button>
          </div>
        )}
      </div>

      {!brief ? (
        <p className="relative mt-4 flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}><Loader2 size={14} className="animate-spin" /> Checking your timetable and requests…</p>
      ) : (
        <ul className="relative mt-4 grid gap-1.5 md:grid-cols-2">
          {brief.items.map((it, i) => {
            const tone = TONES[it.tone];
            const Icon = tone?.icon || KINDS[it.kind] || Info;
            const body = (
              <>
                <Icon size={15} className="mt-0.5 shrink-0" style={{ color: tone?.color || 'var(--brand-text)' }} />
                <span className="min-w-0 flex-1" style={{ color: it.tone === 'muted' ? 'var(--text-3)' : 'var(--text)' }}>{it.text}</span>
                {it.link && <ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-3)' }} />}
              </>
            );
            return (
              <li key={i}>
                {it.link
                  ? <Link to={it.link} className="flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm transition hover:bg-[var(--surface-hover)]">{body}</Link>
                  : <div className="flex items-start gap-2.5 px-3 py-2 text-sm">{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
