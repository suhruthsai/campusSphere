// Faculty home: my classes today (timetable), what's waiting for me (approvals, no-dues),
// today's substitutions and department figures — all from the database.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, FileCheck, ListChecks, Repeat } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import MetricCard from '../components/dashboard/MetricCard.jsx';
import MyDay, { fmtIn, today } from '../components/dashboard/MyDay.jsx';
import { DashboardHeading } from './StudentDashboard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { leavingApi, servicesApi, substitutionsApi, timetableApi } from '../utils/api.js';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [week, setWeek] = useState(null);
  const [inbox, setInbox] = useState(null);
  const [clearance, setClearance] = useState(null);
  const [subs, setSubs] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    timetableApi.mine().then(setWeek).catch((e) => setWeek({ entries: [], substitutions_today: [], reason: e.message }));
    // Only requests at this person's own desk (admins also get others' in 'others')
    servicesApi.inbox().then((d) => setInbox(d.mine || [])).catch(() => setInbox([]));
    leavingApi.queue('pending').then((d) => setClearance(d)).catch(() => setClearance({ units: [], items: [] }));
    substitutionsApi.today().then(setSubs).catch(() => setSubs([]));
    timetableApi.stats().then(setStats).catch(() => setStats(null));
  }, []);

  const day = week ? today(week.entries) : null;
  const myDept = stats?.departments.find((d) => d.department.toUpperCase() === (user?.department || '').toUpperCase());

  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Faculty home" title="Your classes and what's waiting for you." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CalendarClock} label="My classes today"
          value={!day ? '…' : week.reason ? '—' : String(day.list.length)}
          meta={!day ? '' : week.reason ? 'Not linked to the timetable' : day.current ? `Now: ${day.current.section}` : day.next ? `Next in ${fmtIn(day.next.startsIn)}` : 'No more classes today'} />
        <MetricCard icon={FileCheck} label="Approvals waiting" value={inbox ? String(inbox.length) : '…'}
          meta={inbox?.some((r) => r.overdue) ? `${inbox.filter((r) => r.overdue).length} overdue` : 'Certificates to sign'} tone="secondary" />
        <MetricCard icon={ListChecks} label="No-dues to clear" value={clearance ? String(clearance.items.length) : '…'}
          meta={clearance?.units.length ? clearance.units.join(', ') : 'Not a clearance officer'} tone="accent" />
        <MetricCard icon={Repeat} label="Substitutions today" value={subs ? String(subs.length) : '…'} meta="Across the campus" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        {week ? <MyDay data={week} showSection /> : <section className="glass rounded-2xl p-6 text-sm text-slate-400">Loading timetable…</section>}

        <section className="glass rounded-2xl p-6 space-y-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">Waiting for you</h2>
              <Link to="/services/approvals" className="text-xs font-semibold text-cyan-300 hover:underline">Approvals →</Link>
            </div>
            {!inbox ? <p className="text-sm text-slate-400">Loading…</p> : inbox.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing to sign. All caught up.</p>
            ) : (
              <ul className="space-y-2">
                {inbox.slice(0, 4).map((r) => (
                  <li key={r.id} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm">
                    <p className="font-semibold text-white">{r.doc_name}</p>
                    <p className="text-xs text-slate-400">{r.student?.name} · {r.student?.roll_no}{r.overdue ? ' · overdue' : ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="section-title mb-3">{user?.department || 'Department'} in the timetable</h2>
            {!stats ? <p className="text-sm text-slate-400">Loading…</p> : !myDept ? (
              <p className="text-sm text-slate-400">No timetable has been uploaded for {user?.department || 'your department'} yet. Loaded: {stats.departments.map((d) => d.department).join(', ')}.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[['Classes per week', myDept.classes_per_week], ['Sections', myDept.sections],
                  ['Faculty teaching', myDept.teaching_faculty], ['Students registered here', myDept.registered_students]].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <dt className="text-[11px] text-slate-500">{k}</dt><dd className="text-xl font-bold text-white">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
