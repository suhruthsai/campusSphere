// Shared bits for Student Services pages: status styles, time formatting, the approval timeline.
import { Check, Clock3, X } from 'lucide-react';

export const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'S&H'];

export const STATUS = {
  awaiting_payment: { label: 'Fee due', cls: 'border-amber-400/40 bg-amber-500/10 text-amber-300' },
  in_review: { label: 'In review', cls: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300' },
  processing: { label: 'Being prepared', cls: 'border-violet-400/40 bg-violet-500/10 text-violet-300' },
  approved:  { label: 'Ready',     cls: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' },
  rejected:  { label: 'Rejected',  cls: 'border-rose-400/40 bg-rose-500/10 text-rose-300' },
  cancelled: { label: 'Withdrawn', cls: 'border-slate-400/30 bg-slate-500/10 text-slate-400' },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.in_review;
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}

/** Backend timestamps are UTC without a zone suffix; read them as UTC. */
export function parseUtc(iso) {
  if (!iso) return null;
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
}

export function fmtIst(iso, withTime = true) {
  const d = parseUtc(iso);
  if (!d) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function fmtWaiting(hours) {
  if (hours == null) return '';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.floor(hours / 24)} d ${Math.round(hours % 24)} h`;
}

/** Where the request is right now, in words. */
export function whereNow(req) {
  if (req.status === 'awaiting_payment') return `Pay the fee (₹${req.amount}) to send it for approval`;
  if (req.status === 'processing') return 'Approved · the Exam Cell is preparing it';
  if (req.status === 'approved') {
    if (req.dispatch?.tracking) return `Dispatched · tracking ${req.dispatch.tracking}`;
    return `Ready at the ${req.counter_name}`;
  }
  if (req.status === 'rejected') {
    const s = req.steps.find((x) => x.status === 'rejected');
    return `Rejected by ${s?.label || 'an approver'}`;
  }
  if (req.status === 'cancelled') return 'Withdrawn';
  return `With ${req.current_label} · ${req.current_approver}`;
}

/** Five approval steps and the final "issued" step, left to right. */
export function RequestTimeline({ req, compact = false }) {
  const steps = [...req.steps, { label: 'Issued', status: req.status === 'approved' ? 'approved' : 'pending', issued: true }];
  if (req.amount > 0) steps.unshift({ label: `Fee ₹${req.amount}`, status: req.status === 'awaiting_payment' ? 'pending' : 'approved', fee: true });
  const offset = req.amount > 0 ? 1 : 0;
  return (
    <div>
      <ol className="flex items-start">
        {steps.map((s, i) => {
          const isCurrent = s.fee ? req.status === 'awaiting_payment'
            : s.issued ? req.status === 'processing'
            : req.status === 'in_review' && i - offset === req.current_step;
          const done = s.status === 'approved';
          const rejected = s.status === 'rejected';
          const tone = rejected ? 'border-rose-400 bg-rose-500/20 text-rose-300'
            : done ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
            : isCurrent ? (req.overdue ? 'border-rose-400 bg-rose-500/15 text-rose-300 animate-pulse' : 'border-cyan-400 bg-cyan-500/15 text-cyan-300 animate-pulse')
            : 'border-white/15 bg-white/5 text-slate-500';
          return (
            <li key={i} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && (
                <span className={`absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 ${done || rejected || isCurrent ? 'bg-emerald-400/50' : 'bg-white/10'}`} />
              )}
              <span className={`relative z-10 grid h-7 w-7 place-items-center rounded-full border text-[11px] font-bold ${tone}`}>
                {rejected ? <X size={13} /> : done ? <Check size={13} /> : isCurrent ? <Clock3 size={13} /> : i + 1}
              </span>
              <span className={`mt-1.5 text-[10px] font-semibold leading-tight ${isCurrent ? 'text-white' : 'text-slate-400'}`}>{s.label}</span>
              {!compact && !s.issued && !s.fee && (
                <span className="mt-0.5 hidden text-[10px] leading-tight text-slate-500 sm:block">
                  {s.acted_at ? fmtIst(s.acted_at) : s.approver_name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {req.status === 'rejected' && (() => {
        const s = req.steps.find((x) => x.status === 'rejected');
        return s ? (
          <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <b>{s.label}</b> ({s.acted_by_name}): {s.remarks}
          </p>
        ) : null;
      })()}
    </div>
  );
}

export const inputCls =
  'w-full rounded-lg border border-white/10 bg-[#0f1620] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/60';
export const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-50';
export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-50';
