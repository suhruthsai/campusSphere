// Department report: how a department uses CampusSphere — sign-ins, attendance, teachers marking, certificate
// requests and notices — from the first marked class to today. HOD (own department), Principal, management, admin.
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { reportsApi } from '../../utils/api.js';

const LINE_COLORS = ['#00E5FF', '#7B61FF', '#00FFB3', '#F59E0B', '#F472B6', '#38BDF8', '#A3E635', '#FB7185', '#C084FC'];
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

function Tile({ label, value, sub, tone = 'text-white' }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Card({ title, note, children }) {
  return (
    <section className="glass min-w-0 rounded-2xl p-5">
      <h2 className="section-title">{title}</h2>
      {note && <p className="mb-3 mt-1 text-xs text-slate-400">{note}</p>}
      <div className={note ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

function Bar({ value, tone = 'bg-cyan-400' }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

const th = 'py-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500';
const td = 'py-2 pr-3 text-slate-200';

export default function DepartmentReport() {
  const [depts, setDepts] = useState([]);
  const [dept, setDept] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi.departments().then((d) => { setDepts(d); setDept(d.includes('IT') ? 'IT' : d[0] || null); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!dept) return;
    setData(null);
    reportsApi.department(dept).then(setData).catch((e) => setError(e.message));
  }, [dept]);

  if (error) return <PageTransition className="mx-auto max-w-6xl px-4 pt-28 text-rose-300">{error}</PageTransition>;
  if (depts.length === 0 && !dept) {
    return <PageTransition className="mx-auto max-w-6xl px-4 pt-28 text-slate-400">No department has marked attendance yet.</PageTransition>;
  }
  const s = data?.summary;

  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Department report" title={data ? `${data.department} on CampusSphere` : 'Department report'} />
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        {depts.length > 1 && (
          <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={dept || ''} onChange={(e) => setDept(e.target.value)}>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {data && !data.empty && <span>{fmtDate(data.from)} – {fmtDate(data.to)} · {data.teaching_days} teaching days</span>}
      </div>

      {!data && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</div>}
      {data?.empty && <p className="text-slate-400">No attendance has been marked in {data.department} yet.</p>}

      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Students signed in" value={`${pct(s.signed_in, s.students)}%`} sub={`${s.signed_in} of ${s.students} · ${s.active_7d} this week`} tone="text-cyan-300" />
            <Tile label="Average attendance" value={`${s.avg_attendance_pct}%`} sub={`${s.condonation} need condonation · ${s.detained} below ${data.rules.floor_pct}%`} tone="text-emerald-300" />
            <Tile label="Periods marked" value={`${pct(s.periods_marked, s.periods_expected)}%`} sub={`${s.periods_marked} of ${s.periods_expected} · ${s.marked_on_time_pct}% within an hour`} tone="text-violet-300" />
            <Tile label="Certificates issued" value={s.issued} sub={`of ${s.requests} requests · ~${Math.round(s.avg_hours_to_issue / 24 * 10) / 10} days each`} tone="text-amber-300" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Attendance by week" note={`All periods marked, per section. ${data.rules.target_pct}% is required.`}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.attendance.trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={[70, 100]} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                    <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {data.attendance.section_names.map((sec, i) => (
                      <Line key={sec} type="monotone" dataKey={sec} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={1.5} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Sections" note="Students signed in, average attendance, and students below the rules.">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr><th className={th}>Section</th><th className={th}>Signed in</th><th className={th}>Attendance</th><th className={th}>65–75%</th><th className={th}>&lt;65%</th></tr></thead>
                  <tbody>
                    {data.attendance.sections.map((r) => {
                      const a = data.adoption.find((x) => x.section === r.section) || {};
                      return (
                        <tr key={r.section} className="border-t border-white/5">
                          <td className={td}>{r.section}</td>
                          <td className={`${td} w-28`}><div className="flex items-center gap-2"><Bar value={pct(a.signed_in, a.on_roll)} /><span className="text-xs">{a.signed_in}/{a.on_roll}</span></div></td>
                          <td className={td}>{r.avg_pct}%</td>
                          <td className={`${td} text-amber-300`}>{r.condonation}</td>
                          <td className={`${td} text-rose-300`}>{r.detained}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Certificate requests" note={`${s.issued} issued · ${s.waiting} waiting · ${s.rejected} rejected · ${s.withdrawn} withdrawn. Average hours at each desk:`}>
              <div className="space-y-2.5">
                {data.requests.desks.map((d) => (
                  <div key={d.role} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-sm">
                    <span className="text-slate-300">{d.label}</span>
                    <Bar value={(d.avg_hours / 30) * 100} tone={d.avg_hours > 24 ? 'bg-amber-400' : 'bg-emerald-400'} />
                    <span className="text-right text-slate-200">{d.avg_hours} h</span>
                  </div>
                ))}
              </div>
              {data.requests.waiting.length > 0 && (
                <>
                  <p className="mb-2 mt-5 text-[11px] uppercase tracking-wider text-slate-500">Waiting now</p>
                  <ul className="space-y-1.5 text-sm">
                    {data.requests.waiting.slice(0, 8).map((w) => (
                      <li key={w.ref_no} className="flex flex-wrap justify-between gap-2 border-t border-white/5 pt-1.5">
                        <span className="text-slate-200">{w.student} · <span className="text-slate-400">{w.document.replace(' Certificate', '').replace(' (NOC)', '')}</span></span>
                        <span className={w.overdue ? 'text-amber-300' : 'text-slate-400'}>{w.desk} ({w.with}) · {w.hours < 48 ? `${Math.round(w.hours)} h` : `${Math.round(w.hours / 24)} days`}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card title="Teachers marking attendance" note="Periods marked, how many within an hour of class, and periods never marked.">
              <div className="max-h-80 overflow-y-auto pr-1">
                <table className="w-full text-sm">
                  <thead><tr><th className={th}>Teacher</th><th className={th}>Periods</th><th className={th}>Within 1 h</th><th className={th}>Missed</th></tr></thead>
                  <tbody>
                    {data.teachers.map((t) => (
                      <tr key={t.name} className="border-t border-white/5">
                        <td className={td}>{t.name}<div className="text-[11px] text-slate-500">{t.subjects.join(', ')}</div></td>
                        <td className={td}>{t.marked}</td>
                        <td className={`${td} w-32`}><div className="flex items-center gap-2"><Bar value={t.on_time_pct} tone={t.on_time_pct < 60 ? 'bg-amber-400' : 'bg-emerald-400'} /><span className="text-xs">{t.on_time_pct}%</span></div></td>
                        <td className={`${td} ${t.missed ? 'text-rose-300' : 'text-slate-500'}`}>{t.missed || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {data.unmarked.length > 0 && (
            <Card title="Periods never marked" note={`${data.unmarked.length} timetabled periods on teaching days with no attendance saved. Follow up with the teacher; the HOD can still mark them from Attendance.`}>
              <div className="max-h-80 overflow-y-auto pr-1">
                <table className="w-full text-sm">
                  <thead><tr><th className={th}>Date</th><th className={th}>Period</th><th className={th}>Section</th><th className={th}>Subject</th><th className={th}>Teacher</th></tr></thead>
                  <tbody>
                    {data.unmarked.map((u) => (
                      <tr key={`${u.date}-${u.section}-${u.period}-${u.batch || ''}-${u.subject}`} className="border-t border-white/5">
                        <td className={td}>{new Date(u.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                        <td className={td}>P{u.period} <span className="text-[11px] text-slate-500">{u.time}</span></td>
                        <td className={td}>{u.section}{u.batch ? ` · ${u.batch}` : ''}</td>
                        <td className={td}>{u.subject}</td>
                        <td className={td}>{u.teacher}{u.substitute && <span className="text-[11px] text-slate-500"> (substitute)</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={`Below ${data.rules.target_pct}%`} note={`${data.attendance.below_target_total} students. Lowest first.`}>
              <div className="max-h-80 overflow-y-auto pr-1">
                <table className="w-full text-sm">
                  <thead><tr><th className={th}>Student</th><th className={th}>Section</th><th className={th}>Attendance</th></tr></thead>
                  <tbody>
                    {data.attendance.below_target.map((b) => (
                      <tr key={b.roll_no} className="border-t border-white/5">
                        <td className={td}>{b.name}<div className="text-[11px] text-slate-500">{b.roll_no}</div></td>
                        <td className={td}>{b.section}</td>
                        <td className={`${td} ${b.status === 'detained' ? 'text-rose-300' : 'text-amber-300'}`}>{b.pct}% <span className="text-[11px] text-slate-500">({b.attended}/{b.held})</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Notices" note={`${s.notices} posted. Staff signed in: ${s.staff_signed_in} of ${s.staff}.`}>
              <div className="mb-4 flex flex-wrap gap-2 text-xs">
                {data.notices.by_audience.map(([k, n]) => <span key={k} className="rounded-full bg-white/5 px-2.5 py-1 text-slate-300">{k}: {n}</span>)}
              </div>
              <ul className="space-y-2 text-sm">
                {data.notices.latest.map((n) => (
                  <li key={n.title + n.at} className="border-t border-white/5 pt-2">
                    <p className="text-slate-200">{n.title}</p>
                    <p className="text-[11px] text-slate-500">{n.author} · {fmtDate(n.at)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </PageTransition>
  );
}
