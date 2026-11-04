// Faculty & research (HOD, IQAC, NBA coordinator, management): the yearly NBA criterion 5 and NAAC 2.4 / 3 / 6.3
// figures, the faculty service records, research items to verify, and MoUs / extension / collaborations.
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { researchApi as api } from '../../utils/api.js';
import { btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';
import { ItemRow, KINDS, yearNow } from './shared.jsx';

const th = 'py-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500';
const td = 'py-2 pr-3 text-slate-200';
const tip = { background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 11 };
const v = (x, suffix = '') => (x === null || x === undefined ? '—' : `${x}${suffix}`);

function Summary({ prog }) {
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); api.summary(prog).then(setD); }, [prog]);
  if (!d) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  const ys = d.years;
  const done = ys.filter((y) => y.year < d.current_year);
  const last = done[done.length - 1] || {};
  const flag = (bad) => (bad ? 'text-amber-300' : 'text-emerald-300');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Student-faculty ratio', v(last.sfr), `NBA norm ≤ 20 · ${last.faculty} faculty, ${v(last.students)} students`, flag(last.sfr > 20)],
          ['Faculty with PhD', v(last.phd_pct, '%'), `FQI ${v(last.fqi_marks)} / 25`, flag(last.phd_pct < 30)],
          ['Retention (2 years)', v(last.retention_pct, '%'), `${last.retained} of ${last.two_years_ago} still here`, flag(last.retention_pct < 85)],
          ['Indexed papers', v(last.indexed_journals), `${v(last.papers_per_teacher)} per teacher · ${last.year}`, 'text-cyan-300']].map(([k, val, sub, tone]) => (
          <div key={k} className="glass rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">{k}</p>
            <p className={`mt-1 font-display text-2xl font-bold ${tone}`}>{val}</p><p className="mt-0.5 text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>
      <section className="glass min-w-0 rounded-2xl p-5">
        <h2 className="section-title">Research output by year</h2>
        <p className="mb-3 mt-1 text-xs text-slate-400">Verified items only. The year in progress fills as teachers report and the HOD verifies.</p>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ys} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#64748b' }} /><YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="indexed_journals" name="Indexed papers" fill="#00E5FF" radius={[4, 4, 0, 0]} />
              <Bar dataKey="conferences" name="Conference papers" fill="#7B61FF" radius={[4, 4, 0, 0]} />
              <Bar dataKey="patents" name="Patents" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="fdp_attended" name="FDPs attended" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="glass rounded-2xl p-5">
        <h2 className="section-title mb-3">NBA criterion 5 and NAAC figures</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Year</th><th className={th}>Faculty</th><th className={th}>SFR</th><th className={th}>Prof : Assoc : Asst</th><th className={th}>FCR /25</th>
              <th className={th}>PhD</th><th className={th}>FQI /25</th><th className={th}>Retention</th><th className={th}>Avg exp.</th><th className={th}>Grants</th><th className={th}>Consultancy</th><th className={th}>PhDs guided</th><th className={th}>In FDPs</th><th className={th}>To verify</th></tr></thead>
            <tbody>
              {[...ys].reverse().map((y) => (
                <tr key={y.year} className="border-t border-white/5">
                  <td className={td}>{y.year}{y.year === d.current_year && <span className="text-[10px] text-slate-500"> (now)</span>}</td><td className={td}>{y.faculty}</td>
                  <td className={`${td} ${y.sfr > 20 ? 'text-amber-300' : ''}`}>{v(y.sfr)}</td>
                  <td className={td}>{y.cadre.Professor}:{y.cadre['Associate Professor']}:{y.cadre['Assistant Professor']}</td>
                  <td className={td}>{v(y.fcr_marks)}</td><td className={td}>{v(y.phd_pct, '%')}</td><td className={td}>{v(y.fqi_marks)}</td>
                  <td className={td}>{v(y.retention_pct, '%')}</td><td className={td}>{v(y.avg_experience)}</td>
                  <td className={td}>₹{y.grants_lakh} L</td><td className={td}>₹{y.consultancy_lakh} L</td><td className={td}>{y.phd_guided}</td>
                  <td className={td}>{v(y.fdp_pct, '%')}</td><td className={`${td} ${y.unverified ? 'text-amber-300' : 'text-slate-500'}`}>{y.unverified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">SFR = students of 2nd–4th year ÷ faculty. FCR against the 1 : 2 : 6 cadre norm. FQI = 2.5 × (10 × PhDs + 4 × M.Tech) ÷ max(faculty, students ÷ 20).</p>
      </section>
    </div>
  );
}

function Faculty({ prog }) {
  const [rows, setRows] = useState(null);
  const [former, setFormer] = useState(false);
  useEffect(() => { setRows(null); api.faculty(prog, former).then(setRows); }, [prog, former]);
  if (!rows) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">Faculty service records ({rows.length})</h2>
        <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={former} onChange={(e) => setFormer(e.target.checked)} />Include former faculty</label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Name</th><th className={th}>Designation</th><th className={th}>Qualification</th><th className={th}>Joined</th><th className={th}>Experience</th><th className={th}>Research items</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className={td}>{r.name}{r.research_guide && <span className="ml-2 rounded bg-violet-400/15 px-1.5 text-[10px] text-violet-300">PhD guide</span>}{r.left_on && <div className="text-[11px] text-slate-500">left {r.left_on}</div>}</td>
                <td className={td}>{r.designation}</td><td className={td}>{r.qualification}{r.phd_year ? ` (${r.phd_year})` : ''}</td>
                <td className={td}>{r.joined_on.slice(0, 4)}</td><td className={td}>{r.experience_now} y</td>
                <td className={td}>{r.items}{r.unverified ? <span className="text-xs text-amber-300"> · {r.unverified} to verify</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Items({ prog }) {
  const [filters, setFilters] = useState({ year: '', kind: '', verified: 'false' });
  const [d, setD] = useState(null);
  const load = useCallback(() => api.items(prog, { ...filters, verified: filters.verified === '' ? '' : filters.verified }).then(setD), [prog, filters]);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setFilters((s) => ({ ...s, [k]: e.target.value }));
  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="section-title mr-auto">Research items</h2>
        <select className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white" value={filters.verified} onChange={set('verified')}>
          <option value="false">Awaiting verification</option><option value="true">Verified</option><option value="">All</option>
        </select>
        <select className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white" value={filters.kind} onChange={set('kind')}>
          <option value="">All types</option>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input className="w-28 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white" placeholder="2024-25" value={filters.year} onChange={set('year')} />
      </div>
      {!d ? <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p> : d.items.length === 0 ? <p className="text-sm text-slate-400">Nothing here.</p> : (
        <div className="max-h-[36rem] overflow-y-auto"><table className="w-full text-sm"><tbody>
          {d.items.map((i) => <ItemRow key={i.id} i={i} showFaculty canVerify={d.can_verify} onChanged={load} />)}
        </tbody></table></div>
      )}
    </section>
  );
}

const ACT = { mou: 'MoU', extension: 'Extension programme', collaboration: 'Collaboration', ipr_workshop: 'IPR / research workshop' };

function Activities({ prog, canManage }) {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ kind: 'extension', title: '', partner: '', year: yearNow(), on_date: '', participants: '', college: false });
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api.activities(prog).then(setRows), [prog]);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.addActivity({ kind: f.kind, title: f.title, year: f.year, department: f.college ? null : prog, partner: f.partner || null,
        on_date: f.on_date || null, participants: f.participants ? Number(f.participants) : null });
      setMsg('Added'); setF((s) => ({ ...s, title: '', partner: '', participants: '' })); load();
    } catch (err) { setMsg(err.message); }
  };
  return (
    <div className="space-y-5">
      {canManage && (
        <form onSubmit={submit} className="glass grid gap-3 rounded-2xl p-5 sm:grid-cols-6">
          <div className="sm:col-span-2"><label className={labelCls}>Type</label><select className={inputCls} value={f.kind} onChange={set('kind')}>{Object.entries(ACT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="sm:col-span-4"><label className={labelCls}>Title</label><input className={inputCls} required minLength={3} value={f.title} onChange={set('title')} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Partner</label><input className={inputCls} value={f.partner} onChange={set('partner')} required={f.kind === 'mou'} /></div>
          <div><label className={labelCls}>Year</label><input className={inputCls} value={f.year} onChange={set('year')} pattern="\d{4}-\d{2}" /></div>
          <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={f.on_date} onChange={set('on_date')} /></div>
          <div><label className={labelCls}>Participants</label><input type="number" className={inputCls} value={f.participants} onChange={set('participants')} /></div>
          <label className="flex items-end gap-2 pb-2 text-xs text-slate-300"><input type="checkbox" checked={f.college} onChange={(e) => setF((s) => ({ ...s, college: e.target.checked }))} />College-wide</label>
          <div className="flex items-center gap-3 sm:col-span-6"><button className={btnPrimary}>Add</button>{msg && <span className="text-sm text-cyan-300">{msg}</span>}</div>
        </form>
      )}
      <section className="glass rounded-2xl p-5">
        <h2 className="section-title mb-3">MoUs, extension and collaborations</h2>
        {!rows ? <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p> : (
          <div className="max-h-[32rem] overflow-y-auto"><table className="w-full text-sm">
            <thead><tr><th className={th}>Year</th><th className={th}>Type</th><th className={th}>Activity</th><th className={th}>Participants</th></tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id} className="border-t border-white/5"><td className={td}>{a.year}</td><td className={`${td} text-xs text-cyan-300`}>{ACT[a.kind]}</td>
                <td className={td}>{a.title}{a.partner && a.kind !== 'mou' ? ` · ${a.partner}` : ''}<div className="text-[11px] text-slate-500">{a.department || 'College-wide'}{a.valid_until ? ` · valid to ${a.valid_until}` : ''}</div></td>
                <td className={td}>{a.participants ?? '—'}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}

export default function FacultyResearch() {
  const [prog, setProg] = useState('IT');
  const [tab, setTab] = useState('summary');
  const [access, setAccess] = useState(null);
  useEffect(() => { api.access().then(setAccess).catch(() => setAccess({ view: false })); }, []);
  if (!access) return null;
  if (!access.view) return <PageTransition className="mx-auto max-w-5xl px-4 pt-28 text-slate-400">HODs, the IQAC, NBA coordinators and management can see faculty and research records. Teachers: use My research.</PageTransition>;
  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Faculty & research" title={`${prog}: faculty, research and extension`} />
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white" value={prog} onChange={(e) => setProg(e.target.value)}><option value="IT">IT</option><option value="CIVIL">Civil</option></select>
        {[['summary', 'NBA / NAAC figures'], ['faculty', 'Faculty'], ['items', 'Research items'], ['activities', 'MoUs & extension']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{l}</button>
        ))}
      </div>
      {tab === 'summary' ? <Summary prog={prog} /> : tab === 'faculty' ? <Faculty prog={prog} /> : tab === 'items' ? <Items prog={prog} /> : <Activities prog={prog} canManage={access.manage} />}
    </PageTransition>
  );
}
