// Desk turnaround wall: every approver desk, no-dues unit and the Admissions desk measured against the
// desk time target, slowest first. Refreshes every minute; TV mode fills the screen for an office display.
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Hourglass, MapPin, Maximize2, Minimize2, RefreshCw, Timer, TriangleAlert } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import MetricCard from '../../components/dashboard/MetricCard.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { accreditationApi } from '../../utils/api.js';
import { useCampusStore } from '../../store/useCampusStore.js';
import { PilotBadge, RAG, RagDot, SCOPES, Segmented, fmtHours } from '../../components/accreditation/accreditationUi.jsx';

const REFRESH_MS = 60_000;

function ShowOnTwin({ building }) {
  const navigate = useNavigate();
  if (!building) return null;
  return (
    <button title="Show this desk on the 3D campus" aria-label="Show on the 3D campus"
            onClick={() => { useCampusStore.getState().setAIFlyTarget(building); navigate('/'); }}
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-slate-400 hover:border-cyan-300/40 hover:text-cyan-300">
      <MapPin size={13} />
    </button>
  );
}

function ChainFlow({ stages, sla }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {stages.map((s, i) => (
        <Fragment key={s.role}>
          {i > 0 && <ArrowRight size={16} className="self-center text-slate-600" />}
          <div className={`min-w-[132px] flex-1 rounded-xl border bg-white/[0.03] p-3 ${(RAG[s.rag] || RAG.idle).border}`}>
            <div className="flex items-center gap-2"><RagDot rag={s.rag} /><span className="text-xs font-semibold text-white">{s.label}</span></div>
            <p className="mt-2 font-display text-xl font-bold text-white">{fmtHours(s.median_hours)}</p>
            <p className="text-[11px] text-slate-500">median · {s.handled} handled</p>
            <p className={`mt-1 text-[11px] font-semibold ${s.overdue ? 'text-rose-300' : s.pending ? 'text-amber-200' : 'text-slate-500'}`}>
              {s.pending ? `${s.pending} waiting${s.overdue ? ` · ${s.overdue} over ${sla} h` : ''}` : 'Nothing waiting'}
            </p>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function UnitCard({ title, place, s }) {
  return (
    <div className={`rounded-xl border bg-white/[0.03] p-4 ${(RAG[s.rag] || RAG.idle).border}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><RagDot rag={s.rag} /> {title}</span>
        <ShowOnTwin building={place} />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {s.handled ? `${s.handled} done · median ${fmtHours(s.median_hours)}` : 'None done yet'}
      </p>
      <p className={`mt-0.5 text-xs font-semibold ${s.overdue ? 'text-rose-300' : s.pending ? 'text-amber-200' : 'text-slate-500'}`}>
        {s.pending ? `${s.pending} waiting, oldest ${fmtHours(s.oldest_wait_hours)}` : 'Nothing waiting'}
      </p>
    </div>
  );
}

export default function DeskWall() {
  const [wall, setWall] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tv, setTv] = useState(false);
  const [scope, setScope] = useState('both');   // both = the whole Civil & IT Block pilot
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const load = useCallback(() => {
    setLoading(true);
    accreditationApi.desks(scope)
      .then((w) => { if (w.scope.id === scopeRef.current) { setWall(w); setError(''); } })   // ignore answers for an old scope
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [scope]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Leaving full screen (Esc) also leaves TV mode
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setTv(false); };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // TV mode works on its own; full screen is added where the browser allows it (kiosks and embedded views may not)
  const toggleTv = () => {
    if (tv) {
      setTv(false);
      if (document.fullscreenElement) document.exitFullscreen();
    } else {
      setTv(true);
      document.documentElement.requestFullscreen?.()?.catch(() => {});
    }
    window.scrollTo({ top: 0 });
  };

  if (error && !wall) return <PageTransition className="mx-auto max-w-7xl px-4 pt-28"><p className="text-rose-300">{error}</p></PageTransition>;
  if (!wall) return <PageTransition className="mx-auto max-w-7xl px-4 pt-28"><p className="text-slate-400">Loading…</p></PageTransition>;

  const s = wall.summary;
  const sla = wall.sla_hours;
  // The headline numbers are certificate desks; flag late no-dues units and admissions separately
  const lateUnits = [...wall.clearance, { ...wall.admissions, label: 'Admissions verification' }].filter((u) => u.overdue);
  const oldestLate = Math.max(0, ...lateUnits.map((u) => u.oldest_wait_hours || 0));
  const updated = new Date(wall.generated_at + 'Z').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

  return (
    <PageTransition className={`mx-auto min-h-screen max-w-7xl px-4 pb-20 sm:px-6 ${tv ? 'pt-24' : 'pt-28'}`}>
      {!tv && <DashboardHeading eyebrow="Desk turnaround" title="Where every request is waiting, desk by desk." />}

      <div className={`${tv ? '' : '-mt-5'} mb-4 flex flex-wrap items-center gap-3`}>
        <PilotBadge />
        <Segmented label="Departments" options={SCOPES} value={scope} onChange={setScope} />
        <span className="text-xs text-slate-400">Requests from {wall.scope.short} students{wall.scope.id === 'both' ? '' : ' only'}.</span>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><Clock size={13} /> Target: each desk acts within {sla} hours</span>
        <span className="flex items-center gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Updated {updated} IST · refreshes every minute
        </span>
        <div className="ml-auto flex gap-2">
          {!tv && <Link to="/accreditation" className="rounded-lg border border-white/10 px-3 py-1.5 font-semibold text-slate-200 hover:border-cyan-300/40">Accreditation evidence</Link>}
          <button onClick={toggleTv} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 font-semibold text-slate-200 hover:border-cyan-300/40">
            {tv ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {tv ? 'Exit TV mode' : 'TV mode'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Timer} label="Desk steps done on time" value={s.within_sla_pct === null ? '—' : `${s.within_sla_pct}%`} meta={`${s.handled} steps`} tone="accent" />
        <MetricCard icon={Clock} label="Median time at a desk" value={fmtHours(s.median_hours)} meta={`90% within ${fmtHours(s.p90_hours)}`} />
        <MetricCard icon={Hourglass} label="Requests waiting now" value={String(s.pending)} meta={s.oldest_wait_hours ? `oldest ${fmtHours(s.oldest_wait_hours)}` : 'none waiting'} tone="secondary" />
        <MetricCard icon={TriangleAlert} label={`Waiting over ${sla} hours`} value={String(s.overdue)} meta={s.overdue ? 'needs a nudge' : 'all on time'} tone="secondary" />
      </div>

      {wall.bottleneck && (wall.bottleneck.overdue > 0 || (wall.bottleneck.median_hours ?? 0) > sla / 2) && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          <TriangleAlert size={18} className="shrink-0 text-rose-300" />
          <span>
            <b>Slowest stage: {wall.bottleneck.label}.</b> Median {fmtHours(wall.bottleneck.median_hours)} per request
            {wall.bottleneck.overdue ? `, ${wall.bottleneck.overdue} waiting over ${sla} hours` : ''}.
          </span>
        </div>
      )}

      {lateUnits.length > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
          <Hourglass size={18} className="shrink-0 text-amber-300" />
          <span>
            <b>{lateUnits.length === 1 ? `${lateUnits[0].label} has` : `${lateUnits.length} clearance desks have`} students waiting over {sla} hours</b>
            {' '}(oldest {fmtHours(oldestLate)}): {lateUnits.map((u) => u.label).join(', ')}.
          </span>
        </div>
      )}

      <section className="glass mt-6 rounded-2xl p-6">
        <h2 className="section-title mb-1">The approval chain</h2>
        <p className="mb-4 text-xs text-slate-500">Each stage's median time, measured from the moment a request reached it until the desk acted.</p>
        {wall.stages.length ? <ChainFlow stages={wall.stages} sla={sla} /> : <p className="text-sm text-slate-400">No requests have reached a desk yet.</p>}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="glass min-w-0 rounded-2xl p-6 lg:col-span-2">
          <h2 className="section-title mb-1">Every desk, slowest first</h2>
          <p className="mb-4 text-xs text-slate-500">Ranked by overdue requests, then by how long the oldest one has waited.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="pb-2" /><th className="pb-2">Desk</th><th>Handled</th><th>Median</th><th>90%</th><th>On time</th><th>Waiting</th><th>Oldest</th><th /></tr>
              </thead>
              <tbody>
                {wall.desks.map((d) => (
                  <tr key={d.key} className="border-t border-white/5 text-slate-200">
                    <td className="py-2.5 pr-2"><RagDot rag={d.rag} /></td>
                    <td className="py-2.5"><span className="font-semibold text-white">{d.desk}</span><span className="block text-[11px] text-slate-500">{d.role_label}</span></td>
                    <td>{d.handled}</td>
                    <td>{fmtHours(d.median_hours)}</td>
                    <td>{fmtHours(d.p90_hours)}</td>
                    <td className={(RAG[d.rag] || RAG.idle).text}>{d.within_sla_pct === null ? '—' : `${d.within_sla_pct}%`}</td>
                    <td className={d.overdue ? 'font-semibold text-rose-300' : ''}>{d.pending}{d.overdue ? ` (${d.overdue} late)` : ''}</td>
                    <td>{fmtHours(d.oldest_wait_hours)}</td>
                    <td><ShowOnTwin building={d.building} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!wall.desks.length && <p className="py-4 text-sm text-slate-400">No {wall.scope.short} student has made a request yet.</p>}
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="section-title mb-1">Waiting longest</h2>
          <p className="mb-4 text-xs text-slate-500">The requests students are waiting on right now.</p>
          {wall.queue.length ? (
            <ul className="space-y-2.5">
              {wall.queue.map((q) => (
                <li key={`${q.request_id}-${q.desk}`} className={`rounded-xl border p-3 ${q.overdue ? 'border-rose-400/25 bg-rose-500/[0.06]' : 'border-white/8 bg-white/[0.03]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-white">{q.doc_name}</span>
                    <span className={`shrink-0 text-xs font-bold ${q.overdue ? 'text-rose-300' : 'text-amber-200'}`}>{fmtHours(q.waiting_hours)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{q.ref_no} · with {q.desk}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-emerald-300">Nothing is waiting at any desk.</p>}
        </section>
      </div>

      <section className="glass mt-6 rounded-2xl p-6">
        <h2 className="section-title mb-1">No-dues units and the Admissions desk</h2>
        <p className="mb-4 text-xs text-slate-500">No-dues time runs from the day the student started clearance; Admissions from submission to verification.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UnitCard title="Admissions verification" place="civilit" s={wall.admissions} />
          {wall.clearance.map((u) => <UnitCard key={u.unit} title={u.label} place={u.building} s={u} />)}
        </div>
      </section>
    </PageTransition>
  );
}
