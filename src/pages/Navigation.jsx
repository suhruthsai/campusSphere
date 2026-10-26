// Route finder: real buildings and rooms, walking distance and time from the campus path network,
// and "show on the campus map" which draws the same route in the 3D twin.
import { Building2, DoorOpen, Map, MapPin, Navigation2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageTransition from '../components/PageTransition.jsx';
import { btnPrimary, inputCls, labelCls } from '../components/services/requestUi.jsx';
import { buildingsApi, classroomsApi } from '../utils/api.js';
import { useCampusStore } from '../store/useCampusStore.js';
import { floorName } from '../utils/campus.js';

// Places on the path network that aren't buildings in the database
const EXTRA_PLACES = [
  { id: 'frontgate', name: 'Main Gate' }, { id: 'backgate', name: 'Back Gate' }, { id: 'aud', name: 'Auditorium' },
];
const WALK_SPEED = 1.4;   // metres per second, an average walking pace

export default function Navigation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [places, setPlaces] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [from, setFrom] = useState('frontgate');
  const [to, setTo] = useState(params.get('to') || '');
  const [query, setQuery] = useState('');
  const [route, setRoute] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([buildingsApi.list(), classroomsApi.list()]).then(([bl, rl]) => {
      setPlaces([...EXTRA_PLACES, ...bl.map((b) => ({ id: b.id, name: b.name, departments: b.departments || [] }))]
        .sort((a, b) => a.name.localeCompare(b.name)));
      setRooms(rl);
    }).catch((e) => setError(e.message));
  }, []);

  const nameOf = (id) => places.find((p) => p.id === id)?.name || id;
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    const bl = places.filter((p) => p.name.toLowerCase().includes(q) || p.departments?.some((d) => d.toLowerCase().includes(q)))
      .map((p) => ({ key: `b-${p.id}`, building: p.id, title: p.name, sub: p.departments?.join(', ') || 'Campus location', icon: Building2 }));
    const rl = rooms.filter((r) => `${r.name} ${r.id} ${r.type}`.toLowerCase().includes(q))
      .map((r) => ({ key: `r-${r.id}`, building: r.building, title: r.name, sub: `${r.type} · ${nameOf(r.building)}, ${floorName(r.floor, true)}`, icon: DoorOpen, room: r }));
    return [...bl, ...rl].slice(0, 12);
  }, [q, places, rooms]);   // eslint-disable-line react-hooks/exhaustive-deps

  const findRoute = async (toId = to, fromId = from, room = null) => {
    setError('');
    setRoute(null);
    if (!toId || !fromId) return;
    if (toId === fromId) { setError('Start and destination are the same place.'); return; }
    try {
      const r = await buildingsApi.route(fromId, toId, 'walk');
      setRoute({ from: fromId, to: toId, meters: Math.round(r.distance), minutes: Math.max(1, Math.round(r.distance / WALK_SPEED / 60)), room });
    } catch (e) {
      setError(e.message || 'No walking route found');
    }
  };

  useEffect(() => { if (params.get('to') && places.length) findRoute(params.get('to')); }, [places.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (r) => { setTo(r.building); setQuery(''); findRoute(r.building, from, r.room || null); };
  const showOnMap = () => { useCampusStore.getState().setRouteRequest(route.from, route.to); navigate('/'); };

  return (
    <PageTransition className="mx-auto min-h-screen max-w-5xl px-4 pb-20 pt-28 sm:px-6">
      <div className="mb-8">
        <span className="glow-pill mb-4 inline-flex"><Navigation2 size={11} /> Route finder</span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Find any building or room and walk there.</h1>
      </div>
      {error && <p className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="glass space-y-4 rounded-2xl p-6">
          <div>
            <label className={labelCls}>Search a building, department or room</label>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0f1620] px-3">
              <Search size={15} className="text-cyan-300" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Library, IoT Lab, CE-IT-201, Exam"
                     className="w-full bg-transparent py-2 text-sm text-white outline-none placeholder:text-slate-500" />
            </div>
            {q && (
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {results.length === 0 && <li className="px-2 py-2 text-sm text-slate-500">Nothing matches “{query}”.</li>}
                {results.map((r) => (
                  <li key={r.key}>
                    <button onClick={() => pick(r)} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/5">
                      <r.icon size={15} className="mt-0.5 text-cyan-300" />
                      <span><span className="block text-sm font-semibold text-white">{r.title}</span><span className="text-xs text-slate-400">{r.sub}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>From</label>
              <select className={inputCls} value={from} onChange={(e) => { setFrom(e.target.value); setRoute(null); }}>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>To</label>
              <select className={inputCls} value={to} onChange={(e) => { setTo(e.target.value); setRoute(null); }}>
                <option value="">Select</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <button className={btnPrimary} disabled={!to} onClick={() => findRoute()}><Navigation2 size={15} /> Find walking route</button>
        </section>

        <section className="glass rounded-2xl p-6">
          {!route ? (
            <div className="grid h-full min-h-[12rem] place-items-center text-center text-sm text-slate-400">
              <div><MapPin className="mx-auto mb-2 text-slate-600" size={28} />Choose a destination to see the walking route.</div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Walking route</p>
              <h2 className="text-xl font-bold text-white">{nameOf(route.from)} → {nameOf(route.to)}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-2xl font-bold text-white">{route.meters} m</p><p className="text-xs text-slate-400">along campus paths</p></div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-2xl font-bold text-white">~{route.minutes} min</p><p className="text-xs text-slate-400">at a normal walking pace</p></div>
              </div>
              {route.room && (
                <p className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-2 text-sm text-slate-200">
                  Inside {nameOf(route.to)}: <b>{route.room.name}</b> is on the {floorName(route.room.floor, true)}.
                </p>
              )}
              <button className={btnPrimary} onClick={showOnMap}><Map size={15} /> Show on the campus map</button>
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
