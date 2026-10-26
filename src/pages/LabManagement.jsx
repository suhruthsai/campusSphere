// Labs: MVSR's laboratories from the room list, with what is running in each right now and its
// weekly schedule — both from the official timetable (India time).
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FlaskConical, MapPin, Users } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import { DashboardHeading } from './StudentDashboard.jsx';
import { classroomsApi, timetableApi } from '../utils/api.js';
import { istNow, toMinutes } from '../components/three/twinExtras.js';
import { BUILDING_NAMES, DAY_SHORT as DAYS, floorName } from '../utils/campus.js';


export default function LabManagement() {
  const [labs, setLabs] = useState(null);
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([classroomsApi.list(), timetableApi.list()])
      .then(([rooms, tt]) => {
        setLabs(rooms.filter((r) => r.location_type === 'LABORATORY' || /lab/i.test(r.type || '')));
        setEntries(tt);
      })
      .catch((e) => setError(e.message));
  }, []);

  const now = istNow();
  const view = useMemo(() => (labs || []).map((lab) => {
    const mine = entries.filter((e) => e.classroom_id === lab.id);
    const todays = mine.filter((e) => e.day_of_week === now.dow).sort((a, b) => a.period_number - b.period_number);
    const current = todays.find((e) => now.minutes >= toMinutes(e.start_time) && now.minutes < toMinutes(e.end_time));
    const next = todays.find((e) => toMinutes(e.start_time) > now.minutes);
    const slots = new Set(mine.map((e) => `${e.day_of_week}-${e.period_number}`)).size;
    return { ...lab, mine, current, next, slots };
  }).sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || b.slots - a.slots), [labs, entries, now.dow, now.minutes]);

  const shown = view.filter((l) => filter === 'all' || (filter === 'busy' ? l.current : !l.current));
  const inUse = view.filter((l) => l.current).length;

  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Laboratories" title="Every lab, and what's running in it now." />
      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      {!labs ? <p className="text-sm text-slate-400">Loading…</p> : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            {[['all', `All ${view.length}`], ['busy', `In use now ${inUse}`], ['free', `Free now ${view.length - inUse}`]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`rounded-lg px-3 py-1.5 font-semibold ${filter === k ? 'bg-cyan-400 text-slate-900' : 'border border-white/10 text-slate-300 hover:bg-white/5'}`}>{l}</button>
            ))}
            <span className="ml-auto text-xs text-slate-500">Status by the timetable at {String(Math.floor(now.minutes / 60)).padStart(2, '0')}:{String(now.minutes % 60).padStart(2, '0')} IST, {DAYS[now.dow]}</span>
          </div>
          <div className="space-y-2.5">
            {shown.map((l) => (
              <article key={l.id} className={`rounded-2xl border ${l.current ? 'border-amber-400/40 bg-amber-500/[0.06]' : 'border-white/8 bg-white/[0.03]'}`}>
                <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpen(open === l.id ? null : l.id)}>
                  <FlaskConical size={18} className={l.current ? 'mt-0.5 text-amber-300' : 'mt-0.5 text-cyan-300'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white">{l.name}</p>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><MapPin size={11} /> {BUILDING_NAMES[l.building] || l.building} · {floorName(l.floor)}</span>
                      <span className="flex items-center gap-1"><Users size={11} /> {l.capacity} seats</span>
                      <span>{l.slots} periods a week</span>
                    </p>
                    <p className="mt-1 text-xs">
                      {l.current
                        ? <span className="text-amber-200">In use: {l.current.subject_name} · {l.current.section} · {l.current.faculty_name} (until {l.current.end_time})</span>
                        : l.next ? <span className="text-slate-300">Free now · next at {l.next.start_time}: {l.next.subject_name} ({l.next.section})</span>
                        : <span className="text-emerald-300">Free for the rest of today</span>}
                    </p>
                  </div>
                  {open === l.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>
                {open === l.id && (
                  <div className="border-t border-white/6 px-4 pb-4 pt-3 text-xs">
                    {l.equipment?.length > 0 && <p className="mb-2 text-slate-400">Equipment: <span className="text-slate-200">{l.equipment.join(', ')}</span></p>}
                    {l.mine.length === 0 ? <p className="text-slate-400">Not used in the timetable.</p> : (
                      <table className="w-full text-left">
                        <thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-1">Day</th><th>Time</th><th>Subject</th><th>Section</th><th>Faculty</th></tr></thead>
                        <tbody>
                          {[...l.mine].sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number).map((e) => (
                            <tr key={e.id} className="border-t border-white/5 text-slate-300">
                              <td className="py-1">{DAYS[e.day_of_week]}</td><td>{e.start_time}–{e.end_time}</td><td>{e.subject_name}</td><td>{e.section}</td><td>{e.faculty_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </PageTransition>
  );
}
