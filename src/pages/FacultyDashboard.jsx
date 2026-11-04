// Faculty home: my classes today (timetable), what's waiting for me (approvals, no-dues),
// today's substitutions and department figures — all from the database.
import { useEffect, useState } from 'react';
import { Box, CalendarClock, ClipboardList, FileCheck, FlaskConical, FolderLock, LayoutGrid, ListChecks, Megaphone, Repeat, Building2 } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import MetricCard from '../components/dashboard/MetricCard.jsx';
import MorningBrief from '../components/dashboard/MorningBrief.jsx';
import MyDay, { fmtIn, placeOf, today } from '../components/dashboard/MyDay.jsx';
import { ExploreCard, QuickActions, firstNameOf, greeting } from '../components/dashboard/shared.jsx';
import HeroBanner from '../components/ui/HeroBanner.jsx';
import Panel, { PanelNote } from '../components/ui/Panel.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { leavingApi, servicesApi, substitutionsApi, timetableApi } from '../utils/api.js';

const QUICK = [
  { label: 'Attendance',   icon: ClipboardList, to: '/attendance',  color: '#38bdf8' },
  { label: 'Rooms now',    icon: LayoutGrid,    to: '/classrooms',  color: '#34d399' },
  { label: 'Notices',      icon: Megaphone,     to: '/notices',     color: '#fbbf24' },
  { label: 'My research',  icon: FlaskConical,  to: '/my-research', color: '#f472b6' },
  { label: 'My documents', icon: FolderLock,    to: '/locker',      color: '#a78bfa' },
  { label: '3D campus',    icon: Box,           to: '/',            color: '#fb923c' },
];

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

  const status = !day || week.reason ? 'Your classes, approvals and department in one place.'
    : day.current ? `Now teaching: ${day.current.section} · ${placeOf(day.current)}`
    : day.next ? `Next: ${day.next.section} at ${day.next.start_time} · ${placeOf(day.next)}`
    : 'No more classes today.';

  return (
    <PageTransition className="mx-auto min-h-screen max-w-[1400px] px-4 pb-16 pt-24 sm:px-6">
      <HeroBanner
        eyebrow="Faculty home"
        title={`${greeting()}, ${firstNameOf(user) || 'there'}.`}
        accent="Your classes and what's waiting."
        subtitle={status}
        chips={[
          { label: 'Approvals', to: '/services/approvals', icon: FileCheck },
          { label: 'Attendance', to: '/attendance', icon: ClipboardList },
          { label: '3D campus', to: '/', icon: Box },
        ]}
      />

      <MorningBrief className="mt-5" />

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CalendarClock} label="My classes today"
          value={!day ? '…' : week.reason ? '—' : String(day.list.length)}
          meta={!day ? '' : week.reason ? 'Not linked to the timetable' : day.current ? `Now: ${day.current.section}` : day.next ? `Next in ${fmtIn(day.next.startsIn)}` : 'No more classes today'} />
        <MetricCard icon={FileCheck} label="Approvals waiting" value={inbox ? String(inbox.length) : '…'}
          meta={inbox?.some((r) => r.overdue) ? `${inbox.filter((r) => r.overdue).length} overdue` : 'Certificates to sign'} tone="secondary" />
        <MetricCard icon={ListChecks} label="No-dues to clear" value={clearance ? String(clearance.items.length) : '…'}
          meta={clearance?.units.length ? clearance.units.join(', ') : 'Not a clearance officer'} tone="accent" />
        <MetricCard icon={Repeat} label="Substitutions today" value={subs ? String(subs.length) : '…'} meta="Across the campus" tone="warm" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {week ? <MyDay data={week} showSection /> : <Panel title="Today's classes" icon={CalendarClock}><PanelNote>Loading timetable…</PanelNote></Panel>}

        <div className="space-y-5">
          <Panel title="Waiting for you" icon={FileCheck} iconColor="#a78bfa" to="/services/approvals" action="Approvals" delay={0.2}>
            {!inbox ? <PanelNote>Loading…</PanelNote> : inbox.length === 0 ? (
              <PanelNote>Nothing to sign. All caught up.</PanelNote>
            ) : (
              <ul className="space-y-2">
                {inbox.slice(0, 4).map((r) => (
                  <li key={r.id} className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>{r.doc_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-2)' }}>{r.student?.name} · {r.student?.roll_no}{r.overdue ? <span className="font-semibold text-red-500"> · overdue</span> : ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`${user?.department || 'Department'} in the timetable`} icon={Building2} iconColor="#34d399" delay={0.25}>
            {!stats ? <PanelNote>Loading…</PanelNote> : !myDept ? (
              <PanelNote>No timetable has been uploaded for {user?.department || 'your department'} yet. Loaded: {stats.departments.map((d) => d.department).join(', ')}.</PanelNote>
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                {[['Classes per week', myDept.classes_per_week], ['Sections', myDept.sections],
                  ['Faculty teaching', myDept.teaching_faculty], ['Students registered here', myDept.registered_students]].map(([k, v]) => (
                  <div key={k} className="rounded-2xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <dt className="text-[11px]" style={{ color: 'var(--text-3)' }}>{k}</dt>
                    <dd className="mt-0.5 font-display text-2xl font-extrabold" style={{ color: 'var(--text)' }}>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>

          <QuickActions items={QUICK} delay={0.3} />
          <ExploreCard />
        </div>
      </div>
    </PageTransition>
  );
}
