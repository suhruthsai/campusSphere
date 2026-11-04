// Student home: today's classes from the real timetable, my certificate requests, joining / leaving status.
import { useEffect, useState } from 'react';
import { CalendarClock, CalendarDays, ClipboardCheck, ClipboardList, DoorOpen, FileText, FolderLock, Megaphone, MapPinned, Box } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import MetricCard from '../components/dashboard/MetricCard.jsx';
import MorningBrief from '../components/dashboard/MorningBrief.jsx';
import MyDay, { fmtIn, placeOf, today } from '../components/dashboard/MyDay.jsx';
import { ExploreCard, QuickActions, firstNameOf, greeting } from '../components/dashboard/shared.jsx';
import HeroBanner from '../components/ui/HeroBanner.jsx';
import Panel, { PanelNote } from '../components/ui/Panel.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge, whereNow } from '../components/services/requestUi.jsx';
import { joiningApi, leavingApi, servicesApi, timetableApi } from '../utils/api.js';

export { default as DashboardHeading } from '../components/ui/PageHeading.jsx';

const QUICK = [
  { label: 'Attendance',   icon: ClipboardList,     to: '/attendance', color: '#38bdf8' },
  { label: 'Certificates', icon: FileText,          to: '/services',   color: '#a78bfa' },
  { label: 'Notices',      icon: Megaphone,         to: '/notices',    color: '#fbbf24' },
  { label: 'My documents', icon: FolderLock,        to: '/locker',     color: '#f472b6' },
  { label: 'Find a place', icon: MapPinned,         to: '/navigation', color: '#34d399' },
  { label: '3D campus',    icon: Box,               to: '/',           color: '#fb923c' },
];

export default function StudentDashboard() {
  const { user } = useAuth();
  const [week, setWeek] = useState(null);
  const [requests, setRequests] = useState(null);
  const [joining, setJoining] = useState(undefined);
  const [leaving, setLeaving] = useState(undefined);

  useEffect(() => {
    timetableApi.mine().then(setWeek).catch((e) => setWeek({ entries: [], substitutions_today: [], reason: e.message }));
    servicesApi.myRequests().then(setRequests).catch(() => setRequests([]));
    joiningApi.mine().then(setJoining).catch(() => setJoining(null));
    leavingApi.mine().then(setLeaving).catch(() => setLeaving(null));
  }, []);

  const day = week ? today(week.entries) : null;
  const open = (requests || []).filter((r) => ['awaiting_payment', 'in_review', 'processing'].includes(r.status));
  const ready = (requests || []).filter((r) => r.status === 'approved');

  const status = !day || week.reason ? 'Your timetable, requests and campus, all in one place.'
    : day.current ? `Now: ${day.current.subject_name} · ${placeOf(day.current)}`
    : day.next ? `Next: ${day.next.subject_name} at ${day.next.start_time} · ${placeOf(day.next)}`
    : 'No more classes today. Enjoy the rest of your day.';

  return (
    <PageTransition className="mx-auto min-h-screen max-w-[1400px] px-4 pb-16 pt-24 sm:px-6">
      <HeroBanner
        eyebrow="Student home"
        title={`${greeting()}, ${firstNameOf(user) || 'there'}.`}
        accent="Your day, your campus."
        subtitle={status}
        chips={[
          { label: 'Attendance', to: '/attendance', icon: ClipboardList },
          { label: 'Certificates', to: '/services', icon: FileText },
          { label: '3D campus', to: '/', icon: Box },
        ]}
      />

      <MorningBrief className="mt-5" />

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CalendarClock} label="Classes today"
          value={!day ? '…' : week.reason ? '—' : String(day.list.length)}
          meta={!day ? '' : week.reason ? 'No timetable yet' : day.current ? `Now: ${day.current.subject_name}` : day.next ? `Next in ${fmtIn(day.next.startsIn)}` : 'No more classes today'} />
        <MetricCard icon={FileText} label="Requests in progress" value={requests ? String(open.length) : '…'}
          meta={requests ? `${ready.length} ready to download` : ''} tone="secondary" />
        <MetricCard icon={ClipboardCheck} label="Joining"
          value={joining === undefined ? '…' : !joining ? '—' : joining.status === 'enrolled' ? 'Enrolled' : joining.status.replace('_', ' ')}
          meta={joining ? `${joining.progress.filter((p) => p.done).length}/${joining.progress.length} steps` : 'Not started'} tone="accent"
          progress={joining ? joining.progress.filter((p) => p.done).length / Math.max(1, joining.progress.length) : undefined} />
        <MetricCard icon={DoorOpen} label="No-dues clearance"
          value={leaving === undefined ? '…' : !leaving ? '—' : `${leaving.counts.cleared}/${leaving.items.length}`}
          meta={!leaving ? 'Not started' : leaving.status === 'cleared' ? 'All sections cleared' : `${leaving.counts.dues} with dues`} tone="warm"
          progress={leaving ? leaving.counts.cleared / Math.max(1, leaving.items.length) : undefined} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {week ? <MyDay data={week} /> : <Panel title="Today's classes" icon={CalendarDays}><PanelNote>Loading timetable…</PanelNote></Panel>}

        <div className="space-y-5">
          <Panel title="My certificate requests" icon={FileText} iconColor="#a78bfa" to="/services" action="Open services" delay={0.2}>
            {!requests ? <PanelNote>Loading…</PanelNote>
              : requests.length === 0 ? <PanelNote>No requests yet. Ask for a bonafide, NOC or other document at a service counter.</PanelNote>
              : (
                <ul className="space-y-2">
                  {requests.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{r.doc_name}</p>
                        <p className="truncate text-xs" style={{ color: 'var(--text-2)' }}>{whereNow(r)}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <QuickActions items={QUICK} delay={0.25} />
          <ExploreCard />
        </div>
      </div>
    </PageTransition>
  );
}
