// Inside a building: its floors and rooms from the room list, and what's running in each room
// now (official timetable, India time).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Navigation2 } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { buildingsApi, classroomsApi, timetableApi } from '../../utils/api.js';
import { istNow, toMinutes } from '../../components/three/twinExtras.js';
import { floorName } from '../../utils/campus.js';


export default function IndoorNavigation() {
  const [rooms, setRooms] = useState(null);
  const [entries, setEntries] = useState([]);
  const [names, setNames] = useState({});
  const [building, setBuilding] = useState(null);
  const [floor, setFloor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([classroomsApi.list(), timetableApi.list(), buildingsApi.list()]).then(([r, tt, bl]) => {
      setRooms(r);
      setEntries(tt);
      setNames(Object.fromEntries(bl.map((b) => [b.id, b.name])));
      const first = r[0]?.building || null;
      setBuilding(first);
      setFloor(r.filter((x) => x.building === first).map((x) => x.floor).sort((a, b) => a - b)[0] ?? null);
    }).catch((e) => setError(e.message));
  }, []);

  const now = istNow();
  const withRooms = useMemo(() => [...new Set((rooms || []).map((r) => r.building))], [rooms]);
  const floors = useMemo(() => [...new Set((rooms || []).filter((r) => r.building === building).map((r) => r.floor))].sort((a, b) => a - b), [rooms, building]);
  const onFloor = (rooms || []).filter((r) => r.building === building && r.floor === floor);
  const sessionIn = (id) => entries.find((e) => e.classroom_id === id && e.day_of_week === now.dow
    && now.minutes >= toMinutes(e.start_time) && now.minutes < toMinutes(e.end_time));
  const sel = onFloor.find((r) => r.id === selected);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Indoor navigation" title="Find a room inside a building." />
      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      {!rooms ? <p className="text-sm text-slate-400">Loading…</p> : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {withRooms.map((b) => (
              <button key={b} onClick={() => { setBuilding(b); setFloor(rooms.filter((x) => x.building === b).map((x) => x.floor).sort((x, y) => x - y)[0]); setSelected(null); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${building === b ? 'bg-cyan-400 text-slate-900' : 'border border-white/10 text-slate-300 hover:bg-white/5'}`}>{names[b] || b}</button>
            ))}
          </div>
          {withRooms.length === 1 && <p className="mb-4 text-xs text-slate-500">Room lists exist for the {names[withRooms[0]] || withRooms[0]} so far. Other blocks appear here once their rooms are added under Classrooms.</p>}
          <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              {floors.map((f) => (
                <button key={f} onClick={() => { setFloor(f); setSelected(null); }}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${floor === f ? 'border-cyan-400/50 bg-cyan-500/10 text-white' : 'border-white/8 text-slate-300 hover:bg-white/5'}`}>
                  <span className="flex items-center gap-2"><Layers size={14} /> {floorName(f)}</span>
                  <span className="text-xs text-slate-500">{rooms.filter((r) => r.building === building && r.floor === f).length} rooms</span>
                </button>
              ))}
            </div>
            <div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {onFloor.map((r) => {
                  const s = sessionIn(r.id);
                  return (
                    <button key={r.id} onClick={() => setSelected(r.id)}
                      className={`rounded-xl border p-3 text-left ${selected === r.id ? 'border-cyan-400/60 bg-cyan-500/10' : s ? 'border-amber-400/30 bg-amber-500/[0.06]' : 'border-white/8 bg-white/[0.03] hover:bg-white/5'}`}>
                      <p className="text-sm font-semibold text-white">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.type}{r.capacity ? ` · ${r.capacity} seats` : ''}</p>
                      {s && <p className="mt-1 text-[11px] text-amber-200">Class now: {s.subject_name} ({s.section})</p>}
                    </button>
                  );
                })}
              </div>
              {sel && (
                <div className="glass mt-4 rounded-2xl p-4 text-sm text-slate-300">
                  <p className="font-bold text-white">{sel.name}</p>
                  <p className="mt-1">Go to the <b>{names[building] || building}</b>{sel.floor === 0 ? '; the room is on the ground floor.' : ` and take the stairs to the ${floorName(sel.floor).toLowerCase()}.`}</p>
                  <Link to={`/navigation?to=${encodeURIComponent(building)}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline">
                    <Navigation2 size={12} /> Walking route to the {names[building] || building}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </PageTransition>
  );
}
