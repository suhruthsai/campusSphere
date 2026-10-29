// Placements (students): drives open to my branch and batch, applying before the deadline, my applications'
// progress, and my offers. Final years see jobs; pre-final years see internships.
import { useCallback, useEffect, useState } from 'react';
import { Briefcase, CalendarClock, CheckCircle2, Loader2, MapPin, Trophy } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { placementsApi } from '../../utils/api.js';
import { btnGhost, btnPrimary, parseUtc } from '../../components/services/requestUi.jsx';

// Times from the API are UTC (opens_at, register_by); drive dates are plain dates
const fmt = (iso, time = false) => (iso.length > 10 ? parseUtc(iso) : new Date(iso)).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
});

export const MY_STATUS = {
  registered:   { label: 'Applied', cls: 'bg-sky-400/15 text-sky-300' },
  shortlisted:  { label: 'Shortlisted', cls: 'bg-violet-400/15 text-violet-300' },
  selected:     { label: 'Selected', cls: 'bg-emerald-400/15 text-emerald-300' },
  not_selected: { label: 'Not selected', cls: 'bg-white/10 text-slate-400' },
  absent:       { label: 'Absent', cls: 'bg-amber-400/15 text-amber-300' },
  withdrawn:    { label: 'Withdrawn', cls: 'bg-white/10 text-slate-400' },
};
export const DRIVE_STATUS = {
  open:            { label: 'Registrations open', cls: 'text-emerald-300' },
  upcoming:        { label: 'Opens soon', cls: 'text-sky-300' },
  closed:          { label: 'Registrations closed', cls: 'text-slate-400' },
  results_awaited: { label: 'Results awaited', cls: 'text-amber-300' },
  completed:       { label: 'Results out', cls: 'text-slate-400' },
  cancelled:       { label: 'Cancelled', cls: 'text-rose-300' },
};

function daysLeft(iso) {
  const ms = parseUtc(iso) - new Date();
  const d = Math.floor(ms / 86400000);
  return d >= 1 ? `${d} day${d > 1 ? 's' : ''} left` : `${Math.max(1, Math.round(ms / 3600000))} h left`;
}

function DriveCard({ d, onAct, busy }) {
  const st = DRIVE_STATUS[d.status] || DRIVE_STATUS.closed;
  const mine = d.my_status && MY_STATUS[d.my_status];
  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-white">{d.company}</p>
          <p className="text-sm text-slate-300">{d.role}</p>
        </div>
        <span className="shrink-0 rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-300">{d.pay}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1"><CalendarClock size={13} /> Drive {fmt(d.drive_date)}</span>
        {d.location && <span className="flex items-center gap-1"><MapPin size={13} /> {d.location}</span>}
        <span className="capitalize">{d.mode.replace('-', ' ')}</span>
      </div>
      {d.rounds.length > 0 && <p className="text-xs text-slate-400">Rounds: {d.rounds.join(' → ')}</p>}
      {d.eligibility && <p className="text-xs text-slate-500">Eligibility: {d.eligibility}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
        <span className={`text-xs ${st.cls}`}>
          {st.label}
          {d.status === 'open' && ` · closes ${fmt(d.register_by, true)} (${daysLeft(d.register_by)})`}
          {d.status === 'upcoming' && ` · from ${fmt(d.opens_at)}`}
        </span>
        {mine && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${mine.cls}`}>{mine.label}</span>}
        {d.can_register && <button className={btnPrimary} disabled={busy} onClick={() => onAct(d, 'register')}>Apply</button>}
        {d.can_withdraw && <button className={btnGhost} disabled={busy} onClick={() => onAct(d, 'withdraw')}>Withdraw</button>}
      </div>
      {d.why_not && d.status === 'open' && <p className="text-xs text-amber-300/90">{d.why_not}</p>}
    </div>
  );
}

export default function Placements() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => placementsApi.me().then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const act = async (d, what) => {
    setBusy(true);
    setMsg('');
    try {
      const res = await (what === 'register' ? placementsApi.register(d.id) : placementsApi.withdraw(d.id));
      setMsg(res.message);
      await load();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  if (error) return <PageTransition className="mx-auto max-w-5xl px-4 pt-28 text-rose-300">{error}</PageTransition>;
  if (!data) return <PageTransition className="mx-auto flex max-w-5xl items-center gap-2 px-4 pt-28 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</PageTransition>;
  if (!data.ready) return <PageTransition className="mx-auto max-w-5xl px-4 pt-28 text-slate-400">{data.reason}</PageTransition>;

  const now = data.drives.filter((d) => ['open', 'upcoming'].includes(d.status));
  const history = data.drives.filter((d) => d.my_status && !now.includes(d));
  const isJobs = data.drives.some((d) => d.kind === 'job');

  return (
    <PageTransition className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Placements" title={isJobs ? `Placements · ${data.batch} batch` : `Internships · ${data.batch} batch`} />

      {data.offers.length > 0 && (
        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300"><Trophy size={16} /> Your offers</p>
          <ul className="flex flex-wrap gap-2">
            {data.offers.map((o) => (
              <li key={o.company + o.role} className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                <span className="font-semibold">{o.company}</span> · {o.role} · <span className="text-emerald-300">{o.pay}</span>
              </li>
            ))}
          </ul>
          {data.best_offer_lpa && (
            <p className="mt-2 text-xs text-slate-400">
              College rule: with an offer you can apply only to drives paying {data.dream_factor}× your best offer ({data.min_new_offer_lpa} LPA or more).
            </p>
          )}
        </section>
      )}

      {msg && <p className="flex items-center gap-2 text-sm text-cyan-300"><CheckCircle2 size={15} /> {msg}</p>}

      <section>
        <h2 className="section-title mb-3 flex items-center gap-2"><Briefcase size={16} className="text-cyan-300" /> Open and coming up</h2>
        {now.length === 0 ? <p className="text-sm text-slate-400">No drives open for your branch and batch right now.</p> : (
          <div className="grid gap-4 md:grid-cols-2">{now.map((d) => <DriveCard key={d.id} d={d} onAct={act} busy={busy} />)}</div>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="section-title mb-3">My applications</h2>
        {history.length === 0 ? <p className="text-sm text-slate-400">You haven't applied to any completed drive yet.</p> : (
          <ul className="divide-y divide-white/5 text-sm">
            {history.map((d) => {
              const m = MY_STATUS[d.my_status] || MY_STATUS.registered;
              const st = DRIVE_STATUS[d.status];
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="text-slate-200"><span className="font-semibold">{d.company}</span> · {d.role} <span className="text-slate-500">· {d.pay} · {fmt(d.drive_date)}</span></span>
                  <span className="flex items-center gap-2">
                    {d.my_status !== 'selected' && d.my_round > 0 && <span className="text-[11px] text-slate-500">cleared {d.my_round} of {d.rounds.length} rounds</span>}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${d.status === 'results_awaited' ? 'bg-amber-400/15 text-amber-300' : m.cls}`}>
                      {d.status === 'results_awaited' ? st.label : m.label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageTransition>
  );
}
