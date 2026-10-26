// Campus analytics computed from the official timetable and room list (no sensor data is used).
import { useEffect, useState } from 'react';
import { BookOpen, Building2, CalendarRange, Users } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import MetricCard from '../components/dashboard/MetricCard.jsx';
import { DashboardHeading } from './StudentDashboard.jsx';
import { timetableApi } from '../utils/api.js';
import { DAY_SHORT as DAYS } from '../utils/campus.js';


function Bar({ label, sub, value, max, suffix = '' }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="truncate text-slate-200">{label}{sub && <span className="text-slate-500"> · {sub}</span>}</span>
        <span className="ml-2 shrink-0 font-semibold text-white">{value}{suffix}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { timetableApi.stats().then(setS).catch((e) => setError(e.message)); }, []);

  if (error) return <PageTransition className="mx-auto max-w-7xl px-4 pt-28"><p className="text-rose-300">{error}</p></PageTransition>;
  if (!s) return <PageTransition className="mx-auto max-w-7xl px-4 pt-28"><p className="text-slate-400">Loading…</p></PageTransition>;

  const t = s.totals;
  const peak = Math.max(...s.grid.map((g) => g.classes), 1);
  const avgUse = s.rooms.length ? Math.round(s.rooms.reduce((n, r) => n + r.utilization, 0) / s.rooms.length) : 0;

  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Campus analytics" title="How rooms, sections and faculty are used each week." />
      <p className="-mt-4 mb-6 text-sm text-slate-400">
        Computed from the official timetable ({t.classes_per_week} classes a week). Departments without an uploaded timetable don't appear yet.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CalendarRange} label="Classes per week" value={String(t.classes_per_week)} meta={`${t.sections} sections`} />
        <MetricCard icon={Building2} label="Rooms in use" value={`${t.rooms_in_timetable}/${t.rooms_total}`} meta={`Average ${avgUse}% of ${t.teaching_slots_per_week} weekly slots`} tone="secondary" />
        <MetricCard icon={Users} label="Faculty teaching" value={String(t.faculty_teaching)} meta={`of ${t.faculty_profiles} faculty profiles`} tone="accent" />
        <MetricCard icon={BookOpen} label="Departments loaded" value={String(s.departments.length)} meta={s.departments.map((d) => d.department).join(', ')} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="glass rounded-2xl p-6">
          <h2 className="section-title mb-1">Busiest times</h2>
          <p className="mb-4 text-xs text-slate-500">Classes running in each period of the week.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs">
              <thead><tr><th />{s.periods.map((p) => <th key={p.n} className="px-1 pb-2 font-semibold text-slate-400" title={p.time}>P{p.n}<br /><span className="font-normal text-slate-600">{p.time?.split('–')[0]}</span></th>)}</tr></thead>
              <tbody>
                {s.days.map((d) => (
                  <tr key={d}>
                    <td className="pr-2 text-left font-semibold text-slate-400">{DAYS[d]}</td>
                    {s.periods.map((p) => {
                      const n = s.grid.find((g) => g.day === d && g.period === p.n)?.classes || 0;
                      return (
                        <td key={p.n} className="p-0.5">
                          <div className="rounded-md py-2 font-semibold text-white" title={`${n} classes`}
                               style={{ background: n ? `rgba(0,229,255,${0.12 + 0.6 * (n / peak)})` : 'rgba(255,255,255,0.03)' }}>{n || '·'}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="section-title mb-1">Room usage</h2>
          <p className="mb-4 text-xs text-slate-500">Periods booked per week out of {t.teaching_slots_per_week} teaching slots.</p>
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {s.rooms.map((r) => <Bar key={r.id} label={r.name} sub={r.type} value={r.utilization} max={100} suffix="%" />)}
          </div>
          {s.unused_rooms.length > 0 && (
            <p className="mt-4 text-xs text-slate-400">Not in the timetable: {s.unused_rooms.map((r) => r.name).join(', ')}.</p>
          )}
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="section-title mb-4">Departments</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="pb-2">Department</th><th>Classes / week</th><th>Sections</th><th>Faculty</th></tr>
            </thead>
            <tbody>
              {s.departments.map((d) => (
                <tr key={d.department} className="border-t border-white/5 text-slate-200">
                  <td className="py-2 font-semibold">{d.department}</td><td>{d.classes_per_week}</td><td>{d.sections}</td><td>{d.teaching_faculty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="section-title mb-1">Faculty teaching load</h2>
          <p className="mb-4 text-xs text-slate-500">Periods per week, highest first.</p>
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {s.faculty.map((f) => <Bar key={f.id} label={f.name} value={f.periods_per_week} max={s.faculty[0]?.periods_per_week} />)}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
