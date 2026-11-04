// Examination results (Exam Cell totals): pass percentage, days to declare and evaluation grievances by year
// (NAAC 2.5.1, 2.5.2, 2.6.3), and each admission batch's enrolment ratio, success index and academic performance
// index (NBA 4.1-4.4). The Exam Cell, the IQAC and the programme's HOD / NBA coordinator enter the figures.
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { resultsApi as api } from '../../utils/api.js';
import { btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';

const th = 'py-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500';
const td = 'py-2 pr-3 text-slate-200';
const tip = { background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 11 };
const pct = (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);

function EntryForm({ prog, kind, onSaved }) {
  const blank = kind === 'summary'
    ? { year: '', semester: '', exam: 'regular', last_exam_on: '', declared_on: '', appeared: '', passed: '', distinction: '', first_class: '', mean_sgpa: '', complaints: '' }
    : { batch: '', intake: '', admitted: '', lateral: '', graduated_clean: '', graduated_backlog: '', cgpa_2nd: '', passed_2nd: '', appeared_2nd: '', cgpa_3rd: '', passed_3rd: '', appeared_3rd: '' };
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const data = { programme: prog };
    Object.entries(f).forEach(([k, v]) => { if (v !== '') data[k] = ['year', 'exam', 'last_exam_on', 'declared_on'].includes(k) ? v : Number(v); });
    try { await (kind === 'summary' ? api.saveSummary(data) : api.saveBatch(data)); setMsg('Saved'); setF(blank); onSaved(); } catch (err) { setMsg(err.message); }
  };
  const fields = kind === 'summary'
    ? [['year', 'Year (2025-26)', 'text'], ['semester', 'Semester'], ['last_exam_on', 'Last exam', 'date'], ['declared_on', 'Results declared', 'date'],
       ['appeared', 'Appeared'], ['passed', 'Passed all'], ['distinction', 'Distinction'], ['first_class', 'First class'], ['mean_sgpa', 'Mean SGPA'], ['complaints', 'Grievances']]
    : [['batch', 'Admission year'], ['intake', 'Sanctioned intake'], ['admitted', 'Admitted (1st year)'], ['lateral', 'Lateral entries'],
       ['graduated_clean', 'Graduated, no backlogs'], ['graduated_backlog', 'Graduated with backlogs'], ['cgpa_2nd', '2nd yr mean CGPA'],
       ['passed_2nd', '2nd yr successful'], ['appeared_2nd', '2nd yr appeared'], ['cgpa_3rd', '3rd yr mean CGPA'], ['passed_3rd', '3rd yr successful'], ['appeared_3rd', '3rd yr appeared']];
  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-4">
      {fields.map(([k, l, type]) => (
        <div key={k}><label className={labelCls}>{l}</label><input className={inputCls} type={type || 'number'} step="any" value={f[k]} onChange={set(k)}
          required={['year', 'semester', 'appeared', 'passed', 'batch', 'intake', 'admitted'].includes(k)} /></div>
      ))}
      <div className="flex items-end gap-2 sm:col-span-4"><button className={btnPrimary}>Save</button>{msg && <span className="text-sm text-cyan-300">{msg}</span>}</div>
    </form>
  );
}

export default function Results() {
  const [prog, setProg] = useState('IT');
  const [o, setO] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { setO(null); return api.overview(prog).then(setO).catch((e) => setError(e.message)); }, [prog]);
  useEffect(() => { load(); }, [load]);
  if (error) return <PageTransition className="mx-auto max-w-5xl px-4 pt-28 text-rose-300">{error}</PageTransition>;
  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Examination results" title={`${prog}: results and student performance`} />
      <select className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white" value={prog} onChange={(e) => setProg(e.target.value)}>
        <option value="IT">IT</option><option value="CIVIL">Civil</option>
      </select>
      {!o ? <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p> : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="glass min-w-0 rounded-2xl p-5">
              <h2 className="section-title">Pass percentage by year</h2>
              <p className="mb-3 mt-1 text-xs text-slate-400">All semesters' regular examinations (NAAC 2.6.3).</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={o.years} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={[60, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip contentStyle={tip} />
                    <Line type="monotone" dataKey="pass_pct" name="Pass %" stroke="#00FFB3" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="glass min-w-0 rounded-2xl p-5">
              <h2 className="section-title mb-3">By year</h2>
              <table className="w-full text-sm">
                <thead><tr><th className={th}>Year</th><th className={th}>Appeared</th><th className={th}>Pass</th><th className={th}>Days to declare</th><th className={th}>Grievances</th></tr></thead>
                <tbody>
                  {[...o.years].reverse().map((y) => (
                    <tr key={y.year} className="border-t border-white/5"><td className={td}>{y.year}</td><td className={td}>{y.appeared}</td>
                      <td className={td}>{y.pass_pct}%</td><td className={td}>{y.days_to_declare ?? '—'}</td><td className={td}>{y.complaints_pct}%</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-slate-500">NAAC 2.5.1 asks for the days from the last exam to results; 2.5.2 for grievances on evaluation as a share of students.</p>
            </section>
          </div>
          <section className="glass rounded-2xl p-5">
            <h2 className="section-title">Admission batches</h2>
            <p className="mb-3 mt-1 text-xs text-slate-400">NBA 4.1 enrolment ratio (admitted / intake), 4.2 success index (graduated in four years / admitted incl. laterals), 4.3–4.4 academic performance index (mean CGPA × successful / appeared).</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><th className={th}>Batch</th><th className={th}>Intake</th><th className={th}>Admitted + lateral</th><th className={th}>Enrolment</th><th className={th}>Success (no backlog)</th><th className={th}>Success (all)</th><th className={th}>API 2nd yr</th><th className={th}>API 3rd yr</th></tr></thead>
                <tbody>
                  {[...o.batches].reverse().map((b) => (
                    <tr key={b.batch} className="border-t border-white/5">
                      <td className={td}>{b.batch}–{String(b.graduating).slice(2)}</td><td className={td}>{b.intake}</td><td className={td}>{b.admitted} + {b.lateral}</td>
                      <td className={td}>{b.enrolment_ratio}%</td><td className={td}>{pct(b.success_clean)}</td><td className={td}>{pct(b.success_total)}</td>
                      <td className={td}>{b.api_2nd ?? '—'}</td><td className={td}>{b.api_3rd ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {o.can_manage && (
            <section className="glass space-y-3 rounded-2xl p-5">
              <h2 className="section-title">Enter results (Exam Cell)</h2>
              <p className="text-xs text-slate-400">Totals only: no student's marks or grades are entered here. Re-entering a semester or batch corrects it.</p>
              <p className={labelCls}>A semester examination</p>
              <EntryForm prog={prog} kind="summary" onSaved={load} />
              <p className={labelCls}>An admission batch</p>
              <EntryForm prog={prog} kind="batch" onSaved={load} />
            </section>
          )}
        </>
      )}
    </PageTransition>
  );
}
