// Accreditation readiness: DVV-style checks, a readiness estimate per criterion (as recorded / fileable now), a mock
// peer-team drill-down, and the filing exports (data workbook, evidence ZIP).
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Dices, Download, Loader2, XCircle } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { accreditationApi as api } from '../../utils/api.js';
import { btnGhost, btnPrimary } from '../../components/services/requestUi.jsx';

const SEV = { blocker: 'bg-rose-500/20 text-rose-200', high: 'bg-amber-400/20 text-amber-200', medium: 'bg-sky-400/15 text-sky-200', low: 'bg-white/10 text-slate-300' };

function Bar({ a, b }) {
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
      <span className="absolute inset-y-0 left-0 bg-cyan-400/35" style={{ width: `${a}%` }} />
      <span className="absolute inset-y-0 left-0 bg-emerald-400" style={{ width: `${b}%` }} />
    </div>
  );
}

function ReadinessView({ fw, prog }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { setD(null); api.readiness(fw, prog).then(setD).catch((e) => setError(e.message)); }, [fw, prog]);
  if (error) return <p className="text-rose-300">{error}</p>;
  if (!d) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Checking every metric…</p>;
  const e = d.estimate;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Fileable now</p>
          <p className="mt-1 font-display text-4xl font-bold text-emerald-300">{e.fileable}<span className="text-lg text-slate-500"> / {e.max}</span></p>
          <p className="mt-1 text-xs text-slate-400">Backed by real records or evidence today.</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">As recorded</p>
          <p className="mt-1 font-display text-4xl font-bold text-cyan-300">{e.total}<span className="text-lg text-slate-500"> / {e.max}</span></p>
          <p className="mt-1 text-xs text-slate-400">{e.demo_data.length ? 'If everything CampusSphere holds now were real and evidenced.' : 'Everything recorded is real.'}</p>
        </div>
      </div>
      <section className="glass rounded-2xl p-5">
        <h2 className="section-title mb-3">By criterion</h2>
        <div className="space-y-3">
          {e.criteria.map((c) => (
            <div key={c.code} className="grid items-center gap-2 sm:grid-cols-[1fr_14rem_8rem]">
              <p className="text-sm text-slate-200">Criterion {c.code} · {c.title} <span className="text-xs text-slate-500">({c.marks})</span>
                {c.computed && <span className="ml-2 text-[11px] text-violet-300">{Object.entries(c.computed).map(([k, v]) => `${k} ${v}`).join(' · ')}</span>}</p>
              <Bar a={c.ready_pct} b={c.fileable_pct} />
              <p className="text-right text-xs text-slate-300"><span className="text-emerald-300">{c.estimate_fileable}</span> / <span className="text-cyan-300">{c.estimate}</span></p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">{e.note} Green: fileable now · light: as recorded.</p>
      </section>
      <section className="glass rounded-2xl p-5">
        <h2 className="section-title mb-3">What NAAC's DVV / the peer team would flag ({d.checks.length})</h2>
        {d.checks.length === 0 ? <p className="flex items-center gap-2 text-emerald-300"><CheckCircle2 size={16} /> Nothing found.</p> : (
          <ul className="space-y-2">
            {d.checks.map((c, i) => (
              <li key={i} className="rounded-xl bg-white/5 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] uppercase ${SEV[c.severity]}`}>{c.severity}</span>
                  <span className="text-xs text-slate-500">{c.area}{c.metric ? ` · ${c.metric}` : ''}</span></p>
                <p className="mt-1 text-slate-200">{c.message}</p>
                <p className="mt-0.5 text-xs text-slate-400">{c.fix}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MockVisit({ prog }) {
  const [d, setD] = useState(null);
  const draw = useCallback(() => { setD(null); api.mockVisit(prog || 'IT').then(setD); }, [prog]);
  useEffect(() => { draw(); }, [draw]);
  if (!d) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> The peer team is choosing…</p>;
  const card = (title, body) => <section className="glass rounded-2xl p-4"><p className="text-[11px] uppercase tracking-wider text-cyan-300">{title}</p><div className="mt-1 text-sm text-slate-200">{body}</div></section>;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className={`font-display text-2xl font-bold ${d.passed === d.total ? 'text-emerald-300' : 'text-amber-300'}`}>{d.passed} / {d.total} spot checks passed</p>
        <button className={btnGhost} onClick={draw}><Dices size={14} className="mr-1 inline" />Draw again</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {d.course && card('A course file', <>{d.course.code} · {d.course.name} ({d.course.year}) — {d.course.cos} COs, {d.course.assessments} assessments, CO average {d.course.average ?? '—'}</>)}
        {d.student && card('A student', <>{d.student.name} · {d.student.roll_no} · {d.student.class} — attendance {d.student.attendance ?? '—'}%, mentor {d.student.mentor ? 'assigned' : 'none'}</>)}
        {d.teacher && card('A teacher', <>{d.teacher.name} · {d.teacher.designation}, {d.teacher.qualification} — {d.teacher.verified_items} verified items, {d.teacher.with_evidence} with evidence</>)}
        {d.meeting && card('A meeting', <>{d.meeting.body.replaceAll('_', ' ')} on {d.meeting.held_on} — {d.meeting.done} / {d.meeting.decisions} decisions done, minutes {d.meeting.minutes ? 'attached' : 'missing'}</>)}
      </div>
      <section className="glass rounded-2xl p-5">
        <h2 className="section-title mb-2">Spot checks</h2>
        <ul className="space-y-1 text-sm">{d.checks.map((c) => <li key={c.check} className="flex items-center gap-2">{c.pass ? <CheckCircle2 size={14} className="text-emerald-300" /> : <XCircle size={14} className="text-rose-300" />}{c.check}</li>)}</ul>
      </section>
      <section className="glass rounded-2xl p-5">
        <h2 className="section-title mb-2">Questions to expect</h2>
        <ul className="space-y-1.5 text-sm text-slate-300">{d.questions.map((q) => <li key={q.criterion}><span className="mr-2 text-xs text-cyan-300">C{q.criterion}</span>{q.question}</li>)}</ul>
      </section>
    </div>
  );
}

function Exports({ fw, prog }) {
  const [msg, setMsg] = useState('');
  const run = async (fn, label) => { setMsg(`Preparing ${label}…`); try { await fn(); setMsg(`${label} downloaded`); } catch (e) { setMsg(e.message); } };
  return (
    <section className="glass space-y-4 rounded-2xl p-5">
      <p className="flex items-start gap-2 text-sm text-amber-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" />While demonstration data is loaded, every export is marked DRAFT – NOT FOR SUBMISSION.</p>
      <div className="flex flex-wrap gap-3">
        <button className={btnPrimary} onClick={() => run(() => api.exportWorkbook(fw, prog), 'Data workbook')}><Download size={14} className="mr-1 inline" />Data workbook (Excel)</button>
        <button className={btnGhost} onClick={() => run(() => api.exportEvidence(fw, prog), 'Evidence pack')}><Download size={14} className="mr-1 inline" />Evidence pack (ZIP)</button>
        <button className={btnGhost} onClick={() => run(() => api.evidencePack(fw, fw === 'nba' ? (prog || 'IT').toLowerCase() : 'both'), 'Criterion report')}><Download size={14} className="mr-1 inline" />Criterion report (PDF)</button>
      </div>
      <p className="text-xs text-slate-400">Workbook: the Extended Profile and every criterion's metrics by year with their evidence links, plus the DVV checks. Evidence pack: every file by criterion / metric / year with an index.</p>
      {msg && <p className="text-sm text-cyan-300">{msg}</p>}
    </section>
  );
}

export default function Readiness() {
  const [fw, setFw] = useState('naac');
  const [tab, setTab] = useState('readiness');
  const prog = fw === 'nba' ? 'IT' : '';
  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Accreditation readiness" title="Are we ready for the peer team?" />
      <div className="flex flex-wrap gap-2">
        {[['naac', 'NAAC'], ['nba', 'NBA · IT']].map(([k, l]) => <button key={k} onClick={() => setFw(k)} className={`rounded-full px-4 py-1.5 text-sm ${fw === k ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{l}</button>)}
        <span className="mx-2 h-5 w-px bg-white/10" />
        {[['readiness', 'Readiness & DVV'], ['visit', 'Mock peer visit'], ['exports', 'Exports']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-violet-400/20 text-violet-200' : 'bg-white/5 text-slate-400'}`}>{l}</button>)}
      </div>
      {tab === 'readiness' ? <ReadinessView fw={fw} prog={prog} /> : tab === 'visit' ? <MockVisit prog={prog || 'IT'} /> : <Exports fw={fw} prog={prog} />}
    </PageTransition>
  );
}
