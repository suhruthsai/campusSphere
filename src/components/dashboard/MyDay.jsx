// Today's classes from the real timetable (students: their section; faculty: their own classes), as a timeline.
import { CalendarClock, MapPin, UserRound } from 'lucide-react';
import { istNow, toMinutes } from '../three/twinExtras.js';
import { BUILDING_NAMES } from '../../utils/campus.js';
import Panel, { PanelNote } from '../ui/Panel.jsx';

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
    <Panel title="Today's classes" icon={CalendarClock} iconColor="#38bdf8" delay={0.15} className="h-full"
      badge={<span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{dayName}{data.label ? ` · ${data.label}` : ''}</span>}>
      {data.reason ? (
        <PanelNote>{data.reason}</PanelNote>
      ) : list.length === 0 ? (
        <PanelNote>No classes scheduled today.</PanelNote>
      ) : (
        <ol className="space-y-1">
          {list.map((e, i) => {
            const sub = subFor(e);
            const now = e.state === 'now';
            const done = e.state === 'done';
            return (
              <li key={e.id} className="grid grid-cols-[58px_18px_minmax(0,1fr)] gap-x-3">
                <div className="pt-3.5 text-right leading-tight">
                  <p className="text-[13px] font-bold" style={{ color: done ? 'var(--text-3)' : 'var(--text)' }}>{e.start_time}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{e.end_time}</p>
                </div>
                <div className="relative flex justify-center">
                  {i < list.length - 1 && <span className="absolute left-1/2 top-6 -bottom-1 w-px -translate-x-1/2" style={{ background: 'var(--border-strong)' }} />}
                  <span className="relative z-10 mt-[18px] h-3 w-3 rounded-full border-2"
                    style={{ borderColor: now ? 'var(--brand-1)' : done ? 'var(--border-strong)' : 'var(--brand-2)', background: now ? 'var(--brand-1)' : 'var(--surface-solid)', boxShadow: now ? '0 0 0 5px color-mix(in srgb, var(--brand-1) 25%, transparent)' : 'none' }} />
                </div>
                <article className="mb-2 rounded-2xl border p-3.5 transition"
                  style={{
                    borderColor: now ? 'var(--brand-1)' : 'var(--border)',
                    background: now ? 'color-mix(in srgb, var(--brand-1) 11%, var(--surface-solid))' : 'var(--surface-2)',
                    opacity: done ? 0.62 : 1,
                  }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold tracking-wider" style={{ color: 'var(--brand-text)' }}>PERIOD {e.period_number}</span>
                      <h3 className="mt-0.5 truncate text-[15px] font-bold" style={{ color: 'var(--text)' }}>{e.subject_name}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}><MapPin size={12} className="shrink-0" /> <span className="truncate">{placeOf(e)}</span></p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
                        <UserRound size={12} className="shrink-0" />
                        {sub ? <><s style={{ color: 'var(--text-3)' }}>{e.faculty_name}</s>&nbsp;<span className="font-semibold text-amber-500">{sub.replacement_faculty_name} (substitute)</span></>
                          : showSection ? `${e.section}` : e.faculty_name}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={now ? { background: 'var(--brand-grad)', color: '#fff' } : { background: 'var(--surface-2)', color: done ? 'var(--text-3)' : 'var(--text-2)' }}>
                      {now ? 'In progress' : done ? 'Done' : `in ${fmtIn(e.startsIn)}`}
                    </span>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-3)' }}><CalendarClock size={11} /> From the official timetable, India time.</p>
    </Panel>
  );
}
