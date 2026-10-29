// Shared pieces for the Accreditation Autopilot pages: evidence status badges, desk status dots, durations.

export const STATUS = {
  live:      { label: 'Live records', short: 'Live',         cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', bar: 'bg-emerald-400' },
  test_mode: { label: 'Test mode',    short: 'Test mode',    cls: 'border-amber-400/30 bg-amber-400/10 text-amber-300',       bar: 'bg-amber-400' },
  simulated: { label: 'Simulated',    short: 'Simulated',    cls: 'border-amber-400/30 bg-amber-400/10 text-amber-300',       bar: 'bg-amber-300/70' },
  missing:   { label: 'Not captured', short: 'Not captured', cls: 'border-rose-400/30 bg-rose-400/10 text-rose-300',          bar: 'bg-rose-400/60' },
};

export const RAG = {
  red:   { label: 'Overdue',  dot: 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.8)]',  text: 'text-rose-300',    border: 'border-rose-400/30' },
  amber: { label: 'Slipping', dot: 'bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.7)]',  text: 'text-amber-200',   border: 'border-amber-300/30' },
  green: { label: 'On time',  dot: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]', text: 'text-emerald-300', border: 'border-emerald-400/25' },
  idle:  { label: 'No activity', dot: 'bg-slate-600', text: 'text-slate-500', border: 'border-white/10' },
};

export const PILOT_NAME = 'Civil & IT Block pilot';
export const SCOPES = [
  { id: 'both',  label: 'Civil & IT' },
  { id: 'civil', label: 'Civil' },
  { id: 'it',    label: 'IT' },
];

/** Segmented control; `options` is a list of {id, label}. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${value === o.id ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PilotBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> {PILOT_NAME}
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.missing;
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.short}</span>;
}

export function RagDot({ rag }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${(RAG[rag] || RAG.idle).dot}`} title={(RAG[rag] || RAG.idle).label} />;
}

/** 12 min · 3.2 h · 2.1 days (same rules as the backend's fmt_hours). */
export function fmtHours(h) {
  if (h === null || h === undefined) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

/** Stacked bar of evidence statuses (live / test mode / simulated / missing). */
export function CoverageBar({ coverage, className = 'h-1.5' }) {
  const total = coverage?.total || 0;
  if (!total) return <div className={`${className} rounded-full bg-white/8`} />;
  return (
    <div className={`flex overflow-hidden rounded-full bg-white/8 ${className}`}>
      {['live', 'test_mode', 'simulated', 'missing'].map((k) => coverage[k] ? (
        <div key={k} className={STATUS[k].bar} style={{ width: `${(coverage[k] / total) * 100}%` }} title={`${STATUS[k].label}: ${coverage[k]}`} />
      ) : null)}
    </div>
  );
}
