// Accreditation Autopilot: NAAC / NBA criterion evidence computed from CampusSphere's own records,
// with each figure's source and status, the gaps to close, and a printable evidence pack.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Database, FileDown, Gauge, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import MetricCard from '../../components/dashboard/MetricCard.jsx';
import Button from '../../components/ui/Button.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { accreditationApi } from '../../utils/api.js';
import { CoverageBar, PilotBadge, SCOPES, STATUS, Segmented, StatusBadge } from '../../components/accreditation/accreditationUi.jsx';

const FRAMEWORKS = [{ id: 'naac', label: 'NAAC' }, { id: 'nba', label: 'NBA' }];

function CoverageRing({ percent }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 128 128" className="h-36 w-36 shrink-0" role="img" aria-label={`${percent}% backed by live records`}>
      <defs>
        <linearGradient id="cov-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00E5FF" /><stop offset="100%" stopColor="#00FFB3" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle cx="64" cy="64" r={r} fill="none" stroke="url(#cov-grad)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${(percent / 100) * c} ${c}`} transform="rotate(-90 64 64)"
              style={{ transition: 'stroke-dasharray 900ms cubic-bezier(.4,0,.2,1)' }} />
      <text x="64" y="62" textAnchor="middle" className="fill-white font-display text-[26px] font-bold">{percent}%</text>
      <text x="64" y="80" textAnchor="middle" className="fill-slate-400 text-[9px]">live evidence</text>
    </svg>
  );
}

function MiniBars({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="mt-4 space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-28 shrink-0 truncate text-slate-400" title={d.label}>{d.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right font-semibold text-slate-200">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function MetricPanel({ m }) {
  const [open, setOpen] = useState(false);
  const rows = m.table?.rows || [];
  const missing = m.status === 'missing';
  return (
    <article className={`glass rounded-2xl p-5 ${missing ? 'border border-dashed border-rose-400/20' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{m.indicator}</span>
        <StatusBadge status={m.status} />
      </div>
      <h3 className="mt-2 text-sm font-semibold text-white">{m.title}</h3>
      <p className={`mt-3 font-display text-2xl font-bold tracking-tight ${missing ? 'text-slate-500' : 'text-white'}`}>{m.value}</p>
      {m.detail && <p className="mt-2 text-xs leading-relaxed text-slate-400">{m.detail}</p>}
      {m.fix && (
        <p className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-300">
          <span className="font-semibold text-cyan-300">To close this gap: </span>{m.fix}
        </p>
      )}
      {m.chart?.length > 1 && <MiniBars data={m.chart.slice(0, 8)} />}
      {m.source && (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500"><Database size={12} /> {m.source}</p>
      )}
      {rows.length > 0 && (
        <>
          <button onClick={() => setOpen((o) => !o)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
            {open ? 'Hide' : 'Show'} the evidence table ({rows.length} rows)
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-white/8">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900/95 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>{m.table.columns.map((c) => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-white/5 text-slate-200">
                      {r.map((v, j) => <td key={j} className="px-3 py-1.5">{STATUS[v] ? <StatusBadge status={v} /> : v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </article>
  );
}

export default function Accreditation() {
  const [framework, setFramework] = useState('naac');
  const [scope, setScope] = useState('both');   // both = the whole Civil & IT Block pilot
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Switching quickly: only the latest request may fill the page
    let current = true;
    setReport(null);
    setError('');
    accreditationApi.report(framework, scope)
      .then((r) => { if (current) { setReport(r); setActive(r.criteria.find((c) => c.metrics.length)?.code ?? r.criteria[0].code); } })
      .catch((e) => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [framework, scope, attempt]);

  const criterion = useMemo(() => report?.criteria.find((c) => c.code === active), [report, active]);

  const download = () => {
    setDownloading(true);
    setError('');
    accreditationApi.evidencePack(framework, scope).catch((e) => setError(e.message)).finally(() => setDownloading(false));
  };

  // NBA accredits each programme separately, so it has no combined view
  const chooseFramework = (f) => {
    if (f === 'nba' && scope === 'both') setScope('it');
    setFramework(f);
  };
  const scopeOptions = framework === 'nba' ? SCOPES.filter((s) => s.id !== 'both') : SCOPES;

  const cov = report?.coverage;
  const needsReal = cov ? cov.simulated + cov.test_mode : 0;

  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Accreditation Autopilot" title="Accreditation evidence, compiled from the work the college already does." />

      <div className="-mt-5 mb-5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <PilotBadge />
        <span>Timetables, faculty and rooms are loaded for Civil and IT; other branches join as their data is added.</span>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented label="Framework" options={FRAMEWORKS} value={framework} onChange={chooseFramework} />
        <Segmented label={framework === 'nba' ? 'Programme' : 'Departments'} options={scopeOptions} value={scope} onChange={setScope} />
        <Button onClick={download} disabled={!report || downloading} size="md">
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          Download evidence pack
        </Button>
        <Link to="/accreditation/desks" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.13] bg-white/[0.06] px-5 text-sm font-semibold text-white hover:border-cyan-300/40">
          <Gauge size={16} /> Desk turnaround wall
        </Link>
      </div>
      {framework === 'nba' && (
        <p className="-mt-3 mb-6 text-xs text-slate-400">NBA accredits each programme separately, so this report covers one programme at a time.</p>
      )}

      {error && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          <AlertTriangle size={18} className="shrink-0 text-rose-300" />
          <span className="min-w-0 flex-1">
            <b>Couldn't load the {framework.toUpperCase()} evidence for {SCOPES.find((s) => s.id === scope)?.label}.</b>{' '}
            {/fetch|network|request failed|HTTP 50\d/i.test(error) ? 'The CampusSphere server isn’t reachable. Check that the backend is running.' : error}
          </span>
          {!report && (
            <button onClick={() => setAttempt((n) => n + 1)} className="rounded-lg border border-rose-300/30 px-3 py-1.5 font-semibold hover:bg-rose-400/10">
              Try again
            </button>
          )}
        </div>
      )}

      {!report ? (
        !error && <p className="flex items-center gap-2 text-slate-400"><Loader2 size={16} className="animate-spin" /> Computing {framework.toUpperCase()} evidence from CampusSphere's records…</p>
      ) : (
        <>
          <section className="glass mb-6 flex flex-col gap-6 rounded-2xl p-6 md:flex-row md:items-center">
            <CoverageRing percent={cov.percent} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{report.framework.long_name} · {report.scope.label}</p>
              <h2 className="mt-1 font-display text-xl font-bold text-white sm:text-2xl">
                {cov.live} of {cov.total} metrics are backed by live records, academic year {report.academic_year}.
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Every figure is recomputed from the timetable, roll list, faculty profiles, approval trails, joining and no-dues records
                each time you open this page. Nothing is typed in by hand.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                {['live', 'test_mode', 'simulated', 'missing'].map((k) => (
                  <span key={k} className="flex items-center gap-2 text-slate-300">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS[k].bar}`} /> {STATUS[k].label}: <b className="text-white">{cov[k]}</b>
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <MetricCard icon={ShieldCheck} label="Metrics ready to file" value={String(cov.live)} meta="Live records" tone="accent" />
            <MetricCard icon={AlertTriangle} label="Need real data before filing" value={String(needsReal)} meta="Simulated or test mode" tone="secondary" />
            <MetricCard icon={Sparkles} label="Evidence gaps CampusSphere can close" value={String(cov.missing)} meta="Not captured yet" />
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {report.criteria.map((c) => (
              <button key={c.code} onClick={() => setActive(c.code)}
                      className={`w-44 shrink-0 rounded-xl border p-3 text-left transition ${active === c.code ? 'border-cyan-300/50 bg-cyan-400/10' : 'border-white/8 bg-white/[0.03] hover:border-white/20'}`}>
                <span className="text-[11px] font-bold text-cyan-300">{report.framework.name} {c.code}</span>
                <span className="mt-0.5 block h-8 text-xs font-semibold leading-4 text-white line-clamp-2">{c.title}</span>
                <CoverageBar coverage={c.coverage} className="mt-2 h-1.5" />
                <span className="mt-1.5 block text-[10px] text-slate-500">{c.coverage.total ? `${c.coverage.live}/${c.coverage.total} live` : 'No data mapped'}</span>
              </button>
            ))}
          </div>

          {criterion && (
            <section className="mb-10">
              <h2 className="section-title mb-4">{report.framework.name} {criterion.code} · {criterion.title}</h2>
              {criterion.metrics.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {criterion.metrics.map((m) => <MetricPanel key={m.id} m={m} />)}
                </div>
              ) : (
                <p className="glass rounded-2xl p-6 text-sm text-slate-400">
                  No CampusSphere data is mapped to this criterion yet. It is prepared from the department's own documents.
                </p>
              )}
            </section>
          )}

          {report.gaps.length > 0 && (
            <section className="glass rounded-2xl p-6">
              <h2 className="section-title mb-1">Close these gaps to cover more of the report</h2>
              <p className="mb-4 text-xs text-slate-500">Each one is a record CampusSphere could start keeping. Once it does, the metric fills itself in.</p>
              <div className="divide-y divide-white/5">
                {report.gaps.map((g) => (
                  <button key={`${g.criterion}-${g.title}`} onClick={() => { setActive(g.criterion); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="flex w-full flex-col gap-1 py-3 text-left sm:flex-row sm:items-start sm:gap-4">
                    <span className="w-48 shrink-0 text-xs font-semibold text-cyan-300">{report.framework.name} {g.criterion} · {g.indicator}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">{g.title}</span>
                      <span className="block text-xs text-slate-400">{g.fix || g.why}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <p className="mt-6 text-xs text-slate-500">{report.note}</p>
        </>
      )}
    </PageTransition>
  );
}
