// Student home: today's classes from the real timetable, my certificate requests, joining / leaving status.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardCheck, DoorOpen, FileText } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import MetricCard from '../components/dashboard/MetricCard.jsx';
import MyDay, { fmtIn, placeOf, today } from '../components/dashboard/MyDay.jsx';
import { StatusBadge, whereNow } from '../components/services/requestUi.jsx';
import { joiningApi, leavingApi, servicesApi, timetableApi } from '../utils/api.js';

export default function StudentDashboard() {
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

  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Student home" title="Your day, your requests, your campus." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CalendarClock} label="Classes today"
          value={!day ? '…' : week.reason ? '—' : String(day.list.length)}
          meta={!day ? '' : week.reason ? 'No timetable yet' : day.current ? `Now: ${day.current.subject_name}` : day.next ? `Next in ${fmtIn(day.next.startsIn)}` : 'No more classes today'} />
        <MetricCard icon={FileText} label="Requests in progress" value={requests ? String(open.length) : '…'}
          meta={requests ? `${ready.length} ready to download` : ''} tone="secondary" />
        <MetricCard icon={ClipboardCheck} label="Joining"
          value={joining === undefined ? '…' : !joining ? '—' : joining.status === 'enrolled' ? 'Enrolled' : joining.status.replace('_', ' ')}
          meta={joining ? `${joining.progress.filter((p) => p.done).length}/${joining.progress.length} steps` : 'Not started'} tone="accent" />
        <MetricCard icon={DoorOpen} label="No-dues clearance"
          value={leaving === undefined ? '…' : !leaving ? '—' : `${leaving.counts.cleared}/${leaving.items.length}`}
          meta={!leaving ? 'Not started' : leaving.status === 'cleared' ? 'All sections cleared' : `${leaving.counts.dues} with dues`} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        {week ? <MyDay data={week} /> : <section className="glass rounded-2xl p-6 text-sm text-slate-400">Loading timetable…</section>}

        <section className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">My certificate requests</h2>
            <Link to="/services" className="text-xs font-semibold text-cyan-300 hover:underline">Open services →</Link>
          </div>
          {!requests ? <p className="text-sm text-slate-400">Loading…</p>
            : requests.length === 0 ? <p className="text-sm text-slate-400">No requests yet. Ask for a bonafide, NOC or other document at a service counter.</p>
            : (
              <ul className="space-y-2">
                {requests.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{r.doc_name}</p>
                      <p className="truncate text-xs text-slate-400">{whereNow(r)}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          {day?.next && !week.reason && (
            <p className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-4 py-3 text-xs text-slate-300">
              Next: <b className="text-white">{day.next.subject_name}</b> at {day.next.start_time} in {placeOf(day.next)}.
            </p>
          )}
        </section>
      </div>
    </PageTransition>
  );
}

export function DashboardHeading({ eyebrow, title }) {
  return (
    <div className="mb-8">
      <span className="glow-pill mb-4 inline-flex">{eyebrow}</span>
      <h1 className="mt-3 max-w-4xl font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
        {title}
      </h1>
    </div>
  );
}
