// The college roll list (imported from the branch roll-list PDFs). Students' roll numbers are checked
// against it when they fill in their profile; this page lets the Admin Office browse and search it.
import { useEffect, useState } from 'react';
import { Search, UserCheck } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { inputCls, labelCls } from '../../components/services/requestUi.jsx';
import { servicesApi } from '../../utils/api.js';

const YEAR = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

export default function RollList() {
  const [filters, setFilters] = useState({ department: '', year: '', section: '', q: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const t = setTimeout(() => {
      servicesApi.rollList({ ...params, limit: 500 }).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message));
    }, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [filters]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value, ...(k === 'department' || k === 'year' ? { section: '' } : {}) }));
  const groups = data?.groups || [];
  const departments = [...new Set(groups.map((g) => g.department))];
  const sections = Object.keys(groups.filter((g) => (!filters.department || g.department === filters.department)
    && (!filters.year || String(g.year) === filters.year)).reduce((acc, g) => ({ ...acc, ...g.sections }), {}))
    .filter((s) => s !== '-').sort();

  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow={`Roll list${data?.academic_year ? ` · ${data.academic_year}` : ''}`} title="Students on the college roll." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {groups.map((g) => (
          <button key={`${g.department}${g.year}`} type="button"
            onClick={() => setFilters((f) => ({ ...f, department: g.department, year: String(g.year), section: '' }))}
            className={`glass rounded-xl p-4 text-left transition hover:border-cyan-400/40 ${filters.department === g.department && filters.year === String(g.year) ? 'border-cyan-400/50' : ''}`}>
            <div className="text-xs font-semibold tracking-wider text-cyan-300">{g.department} · {YEAR[g.year]} year</div>
            <div className="mt-1 font-display text-2xl font-bold text-white">{g.students}</div>
            <div className="text-[11px] text-slate-400">
              {Object.keys(g.sections).filter((s) => s !== '-').length
                ? Object.entries(g.sections).map(([s, n]) => `${s}: ${n}`).join(' · ') : 'no sections in the list'}
            </div>
          </button>
        ))}
      </div>

      <section className="glass rounded-2xl p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label><span className={labelCls}>Branch</span>
            <select className={inputCls} value={filters.department} onChange={set('department')}>
              <option value="">All</option>{departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label><span className={labelCls}>Year</span>
            <select className={inputCls} value={filters.year} onChange={set('year')}>
              <option value="">All</option>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>{YEAR[y]}</option>)}
            </select>
          </label>
          <label><span className={labelCls}>Section</span>
            <select className={inputCls} value={filters.section} onChange={set('section')} disabled={!sections.length}>
              <option value="">All</option>{sections.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label><span className={labelCls}>Search</span>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className={`${inputCls} pl-8`} placeholder="Name, roll number or email" value={filters.q} onChange={set('q')} />
            </div>
          </label>
        </div>

        {error && <p className="mb-3 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
        {!data ? <p className="text-sm text-slate-400">Loading…</p> : data.total === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">No students match.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-400">
              {data.items.length < data.total ? `Showing ${data.items.length} of ${data.total}` : `${data.total} students`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400">
                  <tr><th className="py-2 pr-3">Roll no.</th><th className="pr-3">Name</th><th className="pr-3">Branch</th>
                    <th className="pr-3">Sec</th><th className="pr-3">Father&rsquo;s name</th><th className="pr-3">Email</th><th>Account</th></tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.roll_no} className="border-t border-white/5 align-top">
                      <td className="py-2 pr-3 font-mono text-xs text-slate-200">{r.roll_no}</td>
                      <td className="pr-3 text-white">
                        {r.name}
                        {r.notes && <div className="text-[11px] text-amber-300/90">{r.notes}</div>}
                      </td>
                      <td className="pr-3 text-slate-300">{r.department} {YEAR[r.year]}</td>
                      <td className="pr-3 text-slate-300">{r.section || '—'}</td>
                      <td className="pr-3 text-slate-400">{r.father_name || '—'}</td>
                      <td className="pr-3 text-slate-400">{r.email || '—'}</td>
                      <td>{r.registered
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><UserCheck size={12} /> Signed up</span>
                        : <span className="text-xs text-slate-500">Not yet</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </PageTransition>
  );
}
