// Today's classes from the real timetable (students: their section; faculty: their own classes).
import { CalendarClock, MapPin, UserRound } from 'lucide-react';
import { istNow, toMinutes } from '../three/twinExtras.js';
import { BUILDING_NAMES } from '../../utils/campus.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Today's entries with their state relative to the IST clock, and the next class. */
export function today(entries, now = istNow()) {
  const list = entries.filter((e) => e.day_of_week === now.dow).sort((a, b) => a.period_number - b.period_number)
    .map((e) => {
      const start = toMinutes(e.start_time), end = toMinutes(e.end_time);
      return { ...e, state: now.minutes >= end ? 'done' : now.minutes >= start ? 'now' : 'later', startsIn: start - now.minutes };
    });
  return { list, now, next: list.find((e) => e.state === 'later'), current: list.find((e) => e.state === 'now'), dayName: DAYS[now.dow] };
}

export const fmtIn = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`.trim());

export function placeOf(e) {
  if (!e.room) return e.classroom_id;
  return `${e.room.name || e.classroom_id} · ${BUILDING_NAMES[e.room.building] || e.room.building}${e.room.floor != null ? `, floor ${e.room.floor}` : ''}`;
}

export default function MyDay({ data, showSection = false }) {
  const { list, dayName } = today(data.entries);
  const subFor = (e) => data.substitutions_today.find((s) => s.period_number === e.period_number && s.section === e.section);
  return (
    <section className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-title">Today&rsquo;s classes</h2>
        <span className="text-xs text-slate-400">{dayName}{data.label ? ` · ${data.label}` : ''}</span>
      </div>
      {data.reason ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">{data.reason}</p>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">No classes scheduled today.</p>
      ) : (
        <div className="space-y-2.5">
          {list.map((e) => {
            const sub = subFor(e);
            return (
              <article key={e.id} className={`rounded-xl border p-4 ${e.state === 'now' ? 'border-cyan-400/50 bg-cyan-500/10'
                : e.state === 'done' ? 'border-white/5 bg-white/[0.02] opacity-60' : 'border-white/10 bg-white/[0.04]'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold tracking-wider text-cyan-300">P{e.period_number} · {e.start_time}–{e.end_time}</span>
                    <h3 className="mt-0.5 font-bold text-white">{e.subject_name}</h3>
                    <p className="flex items-center gap-1 text-xs text-slate-400"><MapPin size={11} /> {placeOf(e)}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      <UserRound size={11} />
                      {sub ? <><s className="text-slate-500">{e.faculty_name}</s>&nbsp;<span className="text-amber-300">{sub.replacement_faculty_name} (substitute)</span></>
                        : showSection ? `${e.section}` : e.faculty_name}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${e.state === 'now' ? 'bg-cyan-400/20 text-cyan-200'
                    : e.state === 'done' ? 'text-slate-500' : 'bg-white/5 text-slate-300'}`}>
                    {e.state === 'now' ? 'In progress' : e.state === 'done' ? 'Done' : `in ${fmtIn(e.startsIn)}`}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="mt-3 flex items-center gap-1 text-[11px] text-slate-500"><CalendarClock size={11} /> From the official timetable, India time.</p>
    </section>
  );
}
