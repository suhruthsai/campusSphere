// Campus directory: every building (with its departments) and every room in the database,
// each with a one-click walking route.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, DoorOpen, FlaskConical, Navigation2, Search } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { buildingsApi, classroomsApi } from '../../utils/api.js';
import { floorName } from '../../utils/campus.js';

const TABS = [['buildings', 'Buildings', Building2], ['classrooms', 'Classrooms', DoorOpen], ['labs', 'Labs', FlaskConical], ['offices', 'Offices', DoorOpen]];
const kind = (r) => (r.location_type === 'LABORATORY' ? 'labs' : r.location_type === 'CLASSROOM' ? 'classrooms' : 'offices');

export default function SmartNavigation() {
  const [buildings, setBuildings] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [tab, setTab] = useState('buildings');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([buildingsApi.list(), classroomsApi.list()]).then(([b, r]) => { setBuildings(b); setRooms(r); }).catch((e) => setError(e.message));
  }, []);

  const nameOf = (id) => buildings?.find((b) => b.id === id)?.name || id;
  const roomCount = useMemo(() => rooms.reduce((m, r) => ({ ...m, [r.building]: (m[r.building] || 0) + 1 }), {}), [rooms]);
  const needle = q.trim().toLowerCase();
  const list = tab === 'buildings'
    ? (buildings || []).filter((b) => !needle || `${b.name} ${b.type} ${(b.departments || []).join(' ')}`.toLowerCase().includes(needle))
    : rooms.filter((r) => kind(r) === tab && (!needle || `${r.name} ${r.id} ${r.type}`.toLowerCase().includes(needle)));

  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Campus directory" title="Every building and room, one click from a route." />
      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map(([k, label, Icon]) => {
          const n = k === 'buildings' ? buildings?.length : rooms.filter((r) => kind(r) === k).length;
          return (
            <button key={k} onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === k ? 'bg-cyan-400 text-slate-900' : 'border border-white/10 text-slate-300 hover:bg-white/5'}`}>
              <Icon size={14} /> {label} <span className="opacity-60">{n ?? ''}</span>
            </button>
          );
        })}
        <div className="ml-auto flex min-w-[14rem] items-center gap-2 rounded-lg border border-white/10 bg-[#0f1620] px-3">
          <Search size={14} className="text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="w-full bg-transparent py-1.5 text-sm text-white outline-none" />
        </div>
      </div>
      {!buildings ? <p className="text-sm text-slate-400">Loading…</p> : list.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-sm text-slate-400">Nothing here{needle ? ` matching “${q}”` : ''}.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((x) => (
            <article key={x.id} className="glass flex flex-col rounded-2xl p-4">
              <p className="font-bold text-white">{x.name}</p>
              {tab === 'buildings' ? (
                <>
                  <p className="text-xs text-slate-400">{x.type} · {x.floors} floor{x.floors === 1 ? '' : 's'}{roomCount[x.id] ? ` · ${roomCount[x.id]} rooms listed` : ''}</p>
                  {x.departments?.length > 0 && <p className="mt-1 text-xs text-slate-300">{x.departments.join(', ')}</p>}
                </>
              ) : (
                <p className="text-xs text-slate-400">{x.type} · {nameOf(x.building)} · {floorName(x.floor)}{x.capacity ? ` · ${x.capacity} seats` : ''}</p>
              )}
              <Link to={`/navigation?to=${encodeURIComponent(tab === 'buildings' ? x.id : x.building)}`}
                    className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-cyan-300 hover:underline">
                <Navigation2 size={12} /> Route here
              </Link>
            </article>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
