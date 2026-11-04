// AdminDashboard.jsx — hero + KPI tiles, the day's class load, classes in session by building, alerts,
// substitutions, recent requests and quick actions. All numbers come from the API (nothing is made up).
import {
  Activity, AlertTriangle, Bell, BookOpen, Building2, CalendarDays, Box, GraduationCap, ShieldCheck,
  Users, UserCheck, Zap, BarChart3, Droplets, Wind, Layers,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageTransition from '../../components/PageTransition.jsx';
import MetricCard from '../../components/dashboard/MetricCard.jsx';
import { ExploreCard, QuickActions, greeting } from '../../components/dashboard/shared.jsx';
import HeroBanner from '../../components/ui/HeroBanner.jsx';
import Panel, { PanelNote } from '../../components/ui/Panel.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  authApi, buildingsApi, announcementsApi, classroomsApi, servicesApi, substitutionsApi, timetableApi,
} from '../../utils/api.js';
import { istNow, liveSessionsByBuilding } from '../../components/three/twinExtras.js';
import { StatusBadge, fmtIst, whereNow } from '../../components/services/requestUi.jsx';

const quickActions = [
  { label: 'Add User',         icon: Users,        to: '/admin/users',         color: '#38bdf8' },
  { label: 'Buildings',        icon: Building2,    to: '/admin/buildings',     color: '#fbbf24' },
  { label: 'Floors',           icon: Layers,       to: '/admin/floors',        color: '#34d399' },
  { label: 'Classrooms',       icon: BookOpen,     to: '/classrooms',          color: '#a78bfa' },
  { label: 'Labs',             icon: Zap,          to: '/labs',                color: '#f472b6' },
  { label: 'Schedule Changes', icon: CalendarDays, to: '/admin/substitutions', color: '#fb923c' },
];

// MVSR Engineering College, Nadergul
const CAMPUS = { lat: 17.2814, lon: 78.5396 };
const WEATHER_TEXT = (code) => (
  code === 0 ? ['☀️', 'Clear sky'] : code <= 2 ? ['🌤️', 'Partly cloudy'] : code === 3 ? ['☁️', 'Overcast']
    : [45, 48].includes(code) ? ['🌫️', 'Fog'] : code >= 95 ? ['⛈️', 'Thunderstorm']
    : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? ['🌧️', 'Rain'] : ['🌥️', 'Cloudy']
);

/** Current weather at the campus (Open-Meteo, no key needed). */
async function fetchCampusWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${CAMPUS.lat}&longitude=${CAMPUS.lon}`
    + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=Asia%2FKolkata';
  const d = await (await fetch(url)).json();
  const c = d.current;
  const [icon, condition] = WEATHER_TEXT(c.weather_code);
  return {
    icon, condition, temp: `${Math.round(c.temperature_2m)}°C`, humidity: `${Math.round(c.relative_humidity_2m)}%`,
    wind: `${Math.round(c.wind_speed_10m)} km/h`, at: c.time.slice(11, 16),
  };
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [buildingList, setBuildingList] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [todaySubs, setTodaySubs] = useState([]);
  const [activity, setActivity] = useState(null);   // latest certificate requests
  const [weather, setWeather] = useState(null);     // null = loading, false = unavailable
  const [inSession, setInSession] = useState(null); // { live: {buildingId: [sessions]}, rooms: {buildingId: count} }
  const [load, setLoad] = useState(null);           // classes per period today, from the timetable

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [statsData, bldgsData, annsData, subsData] = await Promise.all([
          authApi.stats(),
          buildingsApi.list(),
          announcementsApi.list(),
          substitutionsApi.today().catch(() => []),
        ]);
        servicesApi.allRequests().then((rows) => setActivity(rows.slice(0, 8))).catch(() => setActivity([]));
        fetchCampusWeather().then(setWeather).catch(() => setWeather(false));
        // Classes running right now, from the timetable (rooms are mapped to buildings)
        Promise.all([timetableApi.list(), classroomsApi.list()]).then(([entries, rooms]) => {
          const now = istNow();
          const timetabled = new Set(entries.map((e) => e.classroom_id));
          const roomCount = {};
          rooms.filter((r) => timetabled.has(r.id)).forEach((r) => { roomCount[r.building] = (roomCount[r.building] || 0) + 1; });
          setInSession({ live: liveSessionsByBuilding(entries, rooms, now), rooms: roomCount });
          // Today's load: how many classes run in each period
          const byPeriod = {};
          entries.filter((e) => e.day_of_week === now.dow).forEach((e) => {
            const p = (byPeriod[e.period_number] ||= { period: e.period_number, label: `P${e.period_number}`, start: e.start_time, classes: 0 });
            p.classes += 1;
          });
          setLoad(Object.values(byPeriod).sort((a, b) => a.period - b.period));
        }).catch(() => { setInSession({ live: {}, rooms: {} }); setLoad([]); });
        setStats(statsData);
        setBuildingList(bldgsData);
        setAlerts(annsData.map((a) => ({
          id: a.id,
          type: a.priority === 'urgent' ? 'error' : a.priority === 'info' ? 'info' : 'warning',
          msg: `${a.title} — ${a.body} (${a.for})`,
          time: new Date(a.created_at).toLocaleDateString()
        })));
        setTodaySubs(subsData || []);
      } catch (err) {
        console.error("Error loading dashboard data", err);
      }
    }
    loadDashboardData();
  }, []);

  const peak = load?.length ? load.reduce((m, p) => (p.classes > m.classes ? p : m), load[0]) : null;

  return (
    <PageTransition className="mx-auto min-h-screen max-w-[1400px] px-4 pb-16 pt-24 sm:px-6">
      <HeroBanner
        eyebrow="CampusSphere · Admin"
        title={`${greeting()}, ${user?.name || 'Admin'}.`}
        accent="Your campus at a glance."
        subtitle="Live figures from the college database, the timetable and the service desks. Real-time, in one place."
        chips={[
          { label: '3D Digital Twin', to: '/', icon: Box },
          { label: 'Timetable', to: '/admin/timetable', icon: CalendarDays },
          { label: 'Accreditation', to: '/accreditation', icon: ShieldCheck },
        ]}
        aside={<WeatherCard weather={weather} />}
      />

      {/* KPI tiles */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={GraduationCap} label="Total Students" value={stats ? stats.students : '…'} meta="Live" tone="primary" />
        <MetricCard icon={Users} label="Total Faculty" value={stats ? stats.faculty : '…'} meta="Live" tone="warm" />
        <MetricCard icon={UserCheck} label="Total Staff" value={stats ? stats.staff : '…'} meta="Live" tone="secondary" />
        <MetricCard icon={Building2} label="Campus Buildings" value={buildingList.length || '…'} meta="Live" tone="accent" />
      </div>

      {/* Class load + buildings in session */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Class load today" icon={BarChart3} iconColor="#38bdf8" delay={0.1}
          badge={peak ? <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>Peak {peak.label} · {peak.classes} classes</span> : null}>
          {load === null ? <PanelNote>Loading the timetable…</PanelNote>
            : load.length === 0 ? <PanelNote>No classes are scheduled today.</PanelNote>
            : (
              <>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={load} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="loadFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ stroke: 'var(--border-strong)' }}
                        contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', borderRadius: 12, color: 'var(--text)', fontSize: 12 }}
                        labelFormatter={(l, p) => `${l}${p?.[0]?.payload?.start ? ` · from ${p[0].payload.start}` : ''}`}
                        formatter={(v) => [v, 'Classes running']} />
                      <Area type="monotone" dataKey="classes" stroke="#818cf8" strokeWidth={2.5} fill="url(#loadFill)" dot={{ r: 3.5, fill: '#38bdf8', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[11px]" style={{ color: 'var(--text-3)' }}>Classes running in each period, from the official timetable.</p>
              </>
            )}
        </Panel>

        <Panel title="Classes in session now" icon={Building2} iconColor="#a78bfa" delay={0.15} bodyClass="max-h-[330px] space-y-3.5 overflow-y-auto pr-1 no-scrollbar">
          {buildingList.length === 0 && <PanelNote>Loading buildings…</PanelNote>}
          {buildingList.map((b) => {
            const live = inSession?.live[b.id]?.length || 0;
            const rooms = inSession?.rooms[b.id] || 0;
            return (
              <div key={b.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2 font-semibold" style={{ color: 'var(--text)' }}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} />
                    <span className="truncate">{b.name}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold" style={{ color: b.color }}>
                    {inSession === null ? '…' : rooms ? `${live}/${rooms}` : '—'}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${rooms ? (live / rooms) * 100 : 0}%`, background: `linear-gradient(90deg, ${b.color}, color-mix(in srgb, ${b.color} 55%, #8b5cf6))` }} />
                </div>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                  {inSession === null ? 'Loading' : rooms ? `${live} class${live === 1 ? '' : 'es'} running` : 'No timetable yet'}
                </p>
              </div>
            );
          })}
        </Panel>
      </div>

      {/* Substitutions, requests, alerts */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Today's substitutions" icon={UserCheck} iconColor="#fbbf24" to="/admin/substitutions" action="Manage" delay={0.2}
          badge={todaySubs.length > 0 ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-500">{todaySubs.length} active</span> : null}>
          {todaySubs.length === 0 ? (
            <PanelNote>✅ No substitutions today. All faculty are available per the official timetable.</PanelNote>
          ) : (
            <ol className="relative space-y-4 border-l pl-5" style={{ borderColor: 'var(--border-strong)' }}>
              {todaySubs.slice(0, 4).map((sub) => (
                <li key={sub.id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2" style={{ borderColor: '#fbbf24', background: 'var(--surface-solid)' }} />
                  <p className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>P{sub.period_number} · {sub.classroom_id} · {sub.section}
                    <span className="ml-2 text-[11px] font-semibold text-amber-500">{sub.start_time}–{sub.end_time}</span></p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--text-2)' }}>
                    <span className="text-red-500">{sub.original_faculty_name || 'N/A'}</span> → <span className="font-semibold text-emerald-500">{sub.replacement_faculty_name}</span> · {sub.reason}
                  </p>
                </li>
              ))}
              {todaySubs.length > 4 && <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>+{todaySubs.length - 4} more</p>}
            </ol>
          )}
        </Panel>

        <Panel title="Recent requests" icon={Activity} iconColor="#34d399" to="/services/setup" action="Open" delay={0.25} bodyClass="max-h-[300px] overflow-y-auto no-scrollbar">
          {activity === null && <PanelNote>Loading…</PanelNote>}
          {activity?.length === 0 && <PanelNote>No certificate requests yet.</PanelNote>}
          <ul className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
            {activity?.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: 'var(--brand-grad)' }}>
                  {(r.student?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]" style={{ color: 'var(--text)' }}><b>{r.student?.name}</b> <span style={{ color: 'var(--text-2)' }}>requested {r.doc_name}</span></p>
                  <p className="truncate text-[11px]" style={{ color: 'var(--text-3)' }}>{whereNow(r)} · {fmtIst(r.created_at)}</p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Alerts & notices" icon={Bell} iconColor="#f472b6" to="/notices" delay={0.3} className="lg:col-span-2 xl:col-span-1" bodyClass="max-h-[300px] space-y-2.5 overflow-y-auto no-scrollbar"
          badge={<span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-500">{alerts.length}</span>}>
          {alerts.length === 0 && <PanelNote>No active notices.</PanelNote>}
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-2.5 rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${a.type === 'error' ? 'text-red-500' : a.type === 'warning' ? 'text-amber-500' : 'text-sky-500'}`} />
              <div className="min-w-0">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>{a.msg}</p>
                <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-3)' }}>{a.time}</p>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      {/* Quick actions + 3D */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <QuickActions items={quickActions} delay={0.35} />
        <ExploreCard />
      </div>
    </PageTransition>
  );
}

/** Weather at the campus, shown on the hero (Open-Meteo, fetched above). */
function WeatherCard({ weather }) {
  return (
    <motion.div initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
      className="ds-card w-full p-4 sm:w-[270px]" style={{ background: 'color-mix(in srgb, var(--surface-solid) 78%, transparent)' }}>
      <div className="flex items-center gap-3">
        <span className="text-4xl leading-none">{weather ? weather.icon : '🌡️'}</span>
        <div className="min-w-0">
          <p className="font-display text-3xl font-extrabold leading-none" style={{ color: 'var(--text)' }}>{weather ? weather.temp : weather === null ? '…' : '—'}</p>
          <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-2)' }}>{weather ? weather.condition : weather === null ? 'Loading' : 'Weather unavailable'}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}><Droplets size={13} className="text-sky-500" /> {weather ? weather.humidity : '—'}</span>
        <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}><Wind size={13} className="text-emerald-500" /> {weather ? weather.wind : '—'}</span>
      </div>
      <p className="mt-2.5 text-[10px]" style={{ color: 'var(--text-3)' }}>Nadergul, Hyderabad{weather ? ` · ${weather.at} IST` : ''}</p>
    </motion.div>
  );
}
