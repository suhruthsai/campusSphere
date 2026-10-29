// Placement Cell: the batch's placement report (Placement Officer, admins, HODs for their department, management),
// every drive with who applied, recording round results and selections, and posting a new drive (Placement Cell).
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Plus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { placementsApi } from '../../utils/api.js';
import { DEPARTMENTS, btnGhost, btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';
import { DRIVE_STATUS, MY_STATUS } from './Placements.jsx';

const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const th = 'py-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500';
const td = 'py-2 pr-3 text-slate-200';
const tip = { background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 };

function Tile({ label, value, sub, tone = 'text-white' }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Report({ dept }) {
  const [batch, setBatch] = useState(null);
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { setR(null); placementsApi.report(dept, batch).then(setR).catch((e) => setError(e.message)); }, [dept, batch]);
  if (error) return <p className="text-rose-300">{error}</p>;
  if (!r) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  if (r.empty) return <p className="text-slate-400">No drives recorded for {dept} yet.</p>;
  // Finished batches as a line; the batch still being placed as its own point (its season isn't over)
  const trend = [...r.history.map((h) => ({ batch: String(h.batch), pct: h.placed_pct })),
    ...(r.history.some((h) => h.batch === r.batch) ? [] : [{ batch: `${r.batch} (so far)`, so_far: r.placed_pct }])];
  return (
    <div className="space-y-5">
      {r.batches.length > 1 && (
        <div className="flex gap-2">
          {r.batches.map((b) => (
            <button key={b} onClick={() => setBatch(b)} className={`rounded-full px-3 py-1 text-xs ${b === r.batch ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>
              {b} batch
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Students placed" value={`${r.placed_pct ?? 0}%`} sub={`${r.placed} of ${r.students} · ${r.applied} applied`} tone="text-emerald-300" />
        <Tile label="Offers" value={r.offers} sub={`${r.multiple_offers} students with 2+ · ${r.recruiters} recruiters`} tone="text-cyan-300" />
        <Tile label="Median package" value={r.median_ctc ? `${r.median_ctc} LPA` : '—'} sub={r.average_ctc ? `average ${r.average_ctc} LPA` : ''} tone="text-violet-300" />
        <Tile label="Highest package" value={r.highest_ctc ? `${r.highest_ctc} LPA` : '—'} sub={`${r.drives} drives this season`} tone="text-amber-300" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass min-w-0 rounded-2xl p-5">
          <h2 className="section-title">Placed, batch by batch</h2>
          <p className="mb-3 mt-1 text-xs text-slate-400">Share of each outgoing batch with at least one offer. The current batch is still being placed.</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="batch" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis domain={[40, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={tip} />
                <Line type="monotone" dataKey="pct" name="Placed" stroke="#00FFB3" strokeWidth={2} />
                <Line dataKey="so_far" name="Placed so far" stroke="#F59E0B" strokeWidth={0} dot={{ r: 5, fill: '#F59E0B' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="glass min-w-0 rounded-2xl p-5">
          <h2 className="section-title">Packages</h2>
          <p className="mb-3 mt-1 text-xs text-slate-400">Placed students by their best offer.</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.bands} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="band" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={tip} />
                <Bar dataKey="students" fill="#7B61FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass min-w-0 rounded-2xl p-5">
          <h2 className="section-title mb-3">Companies this season</h2>
          <div className="max-h-80 overflow-y-auto pr-1">
            <table className="w-full text-sm">
              <thead><tr><th className={th}>Company</th><th className={th}>Package</th><th className={th}>Applied</th><th className={th}>Offers</th></tr></thead>
              <tbody>
                {r.companies.map((c) => (
                  <tr key={c.company + c.role} className="border-t border-white/5">
                    <td className={td}>{c.company}<div className="text-[11px] text-slate-500">{c.role} · {fmt(c.date)} · <span className={DRIVE_STATUS[c.status]?.cls}>{DRIVE_STATUS[c.status]?.label}</span></div></td>
                    <td className={td}>{c.ctc} LPA</td>
                    <td className={td}>{c.registered}</td>
                    <td className={`${td} ${c.offers ? 'text-emerald-300' : 'text-slate-500'}`}>{c.status === 'completed' ? c.offers : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="glass min-w-0 rounded-2xl p-5">
          <h2 className="section-title mb-3">Sections</h2>
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Section</th><th className={th}>Students</th><th className={th}>Placed</th></tr></thead>
            <tbody>
              {r.by_section.map((s) => (
                <tr key={s.section} className="border-t border-white/5">
                  <td className={td}>{s.section}</td><td className={td}>{s.students}</td>
                  <td className={td}>{s.placed} <span className="text-xs text-slate-500">({Math.round((100 * s.placed) / (s.students || 1))}%)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 className="section-title mb-3 mt-6">Earlier batches</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th className={th}>Batch</th><th className={th}>Placed</th><th className={th}>Higher studies</th><th className={th}>Median</th><th className={th}>Highest</th></tr></thead>
              <tbody>
                {[...r.history].reverse().map((h) => (
                  <tr key={h.batch} className="border-t border-white/5">
                    <td className={td}>{h.batch}</td>
                    <td className={td}>{h.placed}/{h.eligible} <span className="text-xs text-slate-500">({h.placed_pct}%)</span></td>
                    <td className={td}>{h.higher_studies}</td><td className={td}>{h.median_ctc} LPA</td><td className={td}>{h.highest_ctc} LPA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function DriveDetail({ id, onBack }) {
  const [d, setD] = useState(null);
  const [edits, setEdits] = useState({});
  const [msg, setMsg] = useState('');
  const load = useCallback(() => placementsApi.drive(id).then((x) => { setD(x); setEdits({}); }).catch((e) => setMsg(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  const save = async (declare) => {
    const results = Object.entries(edits).map(([roll_no, status]) => ({
      roll_no, status, round_reached: status === 'selected' ? d.rounds.length : status === 'shortlisted' ? 1 : 0,
    }));
    try { setMsg((await placementsApi.results(d.id, results, declare)).message); load(); } catch (e) { setMsg(e.message); }
  };
  const counts = d.registrations.reduce((a, x) => ({ ...a, [x.status]: (a[x.status] || 0) + 1 }), {});
  return (
    <section className="glass rounded-2xl p-5">
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-xs text-slate-400 hover:text-white"><ChevronLeft size={14} /> All drives</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-white">{d.company} · {d.role}</h2>
          <p className="text-sm text-slate-400">{d.pay} · drive {fmt(d.drive_date)} · {d.departments.join(', ')} · {d.batch} batch · <span className={DRIVE_STATUS[d.status]?.cls}>{DRIVE_STATUS[d.status]?.label}</span></p>
          {d.rounds.length > 0 && <p className="mt-1 text-xs text-slate-500">Rounds: {d.rounds.join(' → ')}</p>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(counts).map(([k, n]) => <span key={k} className={`rounded-full px-2.5 py-1 ${MY_STATUS[k]?.cls}`}>{MY_STATUS[k]?.label}: {n}</span>)}
        </div>
      </div>
      {msg && <p className="mt-3 text-sm text-cyan-300">{msg}</p>}
      <div className="mt-4 max-h-[28rem] overflow-y-auto pr-1">
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Student</th><th className={th}>Section</th><th className={th}>Other offer</th><th className={th}>Result</th></tr></thead>
          <tbody>
            {d.registrations.map((x) => (
              <tr key={x.roll_no} className="border-t border-white/5">
                <td className={td}>{x.name}<div className="text-[11px] text-slate-500">{x.roll_no}</div></td>
                <td className={td}>{x.section}</td>
                <td className={td}>{x.best_offer_lpa && x.status !== 'selected' ? `${x.best_offer_lpa} LPA` : '—'}</td>
                <td className={td}>
                  {d.can_manage ? (
                    <select className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white" value={edits[x.roll_no] || x.status}
                            onChange={(e) => setEdits((s) => ({ ...s, [x.roll_no]: e.target.value }))}>
                      {['registered', 'shortlisted', 'selected', 'not_selected', 'absent'].map((s) => <option key={s} value={s}>{MY_STATUS[s].label}</option>)}
                    </select>
                  ) : <span className={`rounded-full px-2.5 py-1 text-xs ${MY_STATUS[x.status]?.cls}`}>{MY_STATUS[x.status]?.label}</span>}
                </td>
              </tr>
            ))}
            {d.registrations.length === 0 && <tr><td colSpan={4} className="py-3 text-slate-500">No applications yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {d.can_manage && d.registrations.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btnGhost} disabled={!Object.keys(edits).length} onClick={() => save(false)}>Save results</button>
          {!d.results_out && <button className={btnPrimary} onClick={() => save(true)}>Save and declare results</button>}
        </div>
      )}
    </section>
  );
}

const EMPTY = { company: '', role: '', kind: 'job', ctc_lpa: '', stipend: '', location: 'Hyderabad', mode: 'on-campus', departments: ['IT'],
  batch: new Date().getFullYear() + 1, eligibility: '60% or 6.5 CGPA throughout, no active backlogs', rounds: 'Online assessment, Technical interview, HR interview',
  opens_at: '', register_by: '', drive_date: '' };

function NewDrive({ onDone }) {
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    try {
      await placementsApi.create({
        ...f, ctc_lpa: f.kind === 'job' ? Number(f.ctc_lpa) : null, stipend: f.kind === 'internship' ? Number(f.stipend) || 0 : null,
        batch: Number(f.batch), rounds: f.rounds.split(',').map((x) => x.trim()).filter(Boolean),
        opens_at: new Date(f.opens_at).toISOString(), register_by: new Date(f.register_by).toISOString(),
      });
      onDone();
    } catch (err) { setMsg(err.message); }
  };
  return (
    <form onSubmit={submit} className="glass grid gap-3 rounded-2xl p-5 sm:grid-cols-6">
      <h2 className="section-title sm:col-span-6">Post a drive</h2>
      <div className="sm:col-span-3"><label className={labelCls}>Company</label><input className={inputCls} required value={f.company} onChange={set('company')} /></div>
      <div className="sm:col-span-3"><label className={labelCls}>Role</label><input className={inputCls} required value={f.role} onChange={set('role')} /></div>
      <div className="sm:col-span-2"><label className={labelCls}>Type</label>
        <select className={inputCls} value={f.kind} onChange={set('kind')}><option value="job">Job</option><option value="internship">Internship</option></select></div>
      {f.kind === 'job'
        ? <div className="sm:col-span-2"><label className={labelCls}>CTC (LPA)</label><input type="number" step="0.01" className={inputCls} required value={f.ctc_lpa} onChange={set('ctc_lpa')} /></div>
        : <div className="sm:col-span-2"><label className={labelCls}>Stipend (₹/month)</label><input type="number" className={inputCls} value={f.stipend} onChange={set('stipend')} /></div>}
      <div className="sm:col-span-2"><label className={labelCls}>Passing-out batch</label><input type="number" className={inputCls} required value={f.batch} onChange={set('batch')} /></div>
      <div className="sm:col-span-6"><label className={labelCls}>Branches</label>
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map((x) => (
            <label key={x} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-slate-200">
              <input type="checkbox" checked={f.departments.includes(x)}
                     onChange={(e) => setF((s) => ({ ...s, departments: e.target.checked ? [...s.departments, x] : s.departments.filter((y) => y !== x) }))} />{x}
            </label>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2"><label className={labelCls}>Registrations open</label><input type="datetime-local" className={inputCls} required value={f.opens_at} onChange={set('opens_at')} /></div>
      <div className="sm:col-span-2"><label className={labelCls}>Registrations close</label><input type="datetime-local" className={inputCls} required value={f.register_by} onChange={set('register_by')} /></div>
      <div className="sm:col-span-2"><label className={labelCls}>Drive date</label><input type="date" className={inputCls} required value={f.drive_date} onChange={set('drive_date')} /></div>
      <div className="sm:col-span-3"><label className={labelCls}>Location</label><input className={inputCls} value={f.location} onChange={set('location')} /></div>
      <div className="sm:col-span-3"><label className={labelCls}>Mode</label>
        <select className={inputCls} value={f.mode} onChange={set('mode')}><option value="on-campus">On campus</option><option value="virtual">Virtual</option><option value="pool">Pool campus</option></select></div>
      <div className="sm:col-span-6"><label className={labelCls}>Eligibility</label><input className={inputCls} value={f.eligibility} onChange={set('eligibility')} /></div>
      <div className="sm:col-span-6"><label className={labelCls}>Rounds (comma separated)</label><input className={inputCls} value={f.rounds} onChange={set('rounds')} /></div>
      {msg && <p className="text-sm text-rose-300 sm:col-span-6">{msg}</p>}
      <div className="flex gap-2 sm:col-span-6"><button className={btnPrimary}>Post drive</button><button type="button" className={btnGhost} onClick={onDone}>Cancel</button></div>
    </form>
  );
}

function Drives({ manage }) {
  const [drives, setDrives] = useState(null);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => placementsApi.drives().then(setDrives), []);
  useEffect(() => { load(); }, [load]);
  if (open) return <DriveDetail id={open} onBack={() => { setOpen(null); load(); }} />;
  if (adding) return <NewDrive onDone={() => { setAdding(false); load(); }} />;
  if (!drives) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">Drives</h2>
        {manage && <button className={btnPrimary} onClick={() => setAdding(true)}><Plus size={14} className="mr-1 inline" /> Post a drive</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Company</th><th className={th}>For</th><th className={th}>Pay</th><th className={th}>Drive</th><th className={th}>Applied</th><th className={th}>Selected</th></tr></thead>
          <tbody>
            {drives.map((d) => (
              <tr key={d.id} className="cursor-pointer border-t border-white/5 hover:bg-white/5" onClick={() => setOpen(d.id)}>
                <td className={td}>{d.company}<div className="text-[11px] text-slate-500">{d.role}</div></td>
                <td className={td}>{d.kind === 'internship' ? 'Internship' : 'Job'} · {d.batch}</td>
                <td className={td}>{d.pay}</td>
                <td className={td}>{fmt(d.drive_date)}<div className={`text-[11px] ${DRIVE_STATUS[d.status]?.cls}`}>{DRIVE_STATUS[d.status]?.label}</div></td>
                <td className={td}>{d.registered}</td>
                <td className={`${td} ${d.selected ? 'text-emerald-300' : 'text-slate-500'}`}>{d.status === 'completed' ? d.selected : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PlacementCell() {
  const [access, setAccess] = useState(null);
  const [tab, setTab] = useState('report');
  useEffect(() => { placementsApi.access().then(setAccess).catch(() => setAccess({ report: false })); }, []);
  if (!access) return null;
  if (!access.report) return <PageTransition className="mx-auto max-w-5xl px-4 pt-28 text-slate-400">The Placement Cell, HODs and management can see this page.</PageTransition>;
  const dept = access.all_departments ? 'IT' : access.departments[0];
  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Placement Cell" title={`${dept} placements`} />
      <div className="flex gap-2">
        {[['report', 'Report'], ['drives', 'Drives']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{label}</button>
        ))}
      </div>
      {tab === 'report' ? <Report dept={dept} /> : <Drives manage={access.manage} />}
    </PageTransition>
  );
}
