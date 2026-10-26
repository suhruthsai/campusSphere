// AdminDashboard.jsx — KPI + Live stats + Weather + Alerts
import {
  Activity, AlertTriangle, Bell, BookOpen, Building2, CalendarDays, ChevronRight, Cloud, GraduationCap, TrendingUp, Users, Zap, UserCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  authApi, buildingsApi, announcementsApi, classroomsApi, servicesApi, substitutionsApi, timetableApi,
} from '../../utils/api.js';
import { istNow, liveSessionsByBuilding } from '../../components/three/twinExtras.js';
import { StatusBadge, fmtIst, whereNow } from '../../components/services/requestUi.jsx';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
});

const kpisInitial = [
  { label: 'Total Students', value: '...', change: 'Loading', icon: GraduationCap, color: '#00E5FF' },
  { label: 'Total Faculty',  value: '...', change: 'Loading', icon: Users,         color: '#F59E0B' },
  { label: 'Total Staff',    value: '...', change: 'Loading', icon: Users,         color: '#F472B6' },
  { label: 'Active Buildings',value: '...', change: 'Loading', icon: Building2,     color: '#7B61FF' },
];


const quickActions = [
  { label: 'Add User',           icon: Users,       href: '/admin/users',         color: '#00E5FF' },
  { label: 'Manage Buildings',   icon: Building2,   href: '/admin/buildings',      color: '#F59E0B' },
  { label: 'View Floors',        icon: Activity,    href: '/admin/floors',         color: '#00FFB3' },
  { label: 'Classrooms',         icon: BookOpen,    href: '/classrooms',           color: '#7B61FF' },
  { label: 'Labs',               icon: Zap,         href: '/labs',                 color: '#F472B6' },
  { label: 'Schedule Changes',   icon: CalendarDays,href: '/admin/substitutions',  color: '#F59E0B' },
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

/** Morning / afternoon / evening by the campus clock (IST). */
function greeting() {
  const h = Number(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
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
          const timetabled = new Set(entries.map((e) => e.classroom_id));
          const roomCount = {};
          rooms.filter((r) => timetabled.has(r.id)).forEach((r) => { roomCount[r.building] = (roomCount[r.building] || 0) + 1; });
          setInSession({ live: liveSessionsByBuilding(entries, rooms, istNow()), rooms: roomCount });
        }).catch(() => setInSession({ live: {}, rooms: {} }));
        setStats(statsData);
        setBuildingList(bldgsData);
        setAlerts(annsData.map((a, i) => ({
          id: a.id,
          type: a.priority === 'high' ? 'error' : a.priority === 'medium' ? 'warning' : 'info',
          msg: a.title + ' - ' + a.content,
          time: new Date(a.created_at).toLocaleDateString()
        })));
        setTodaySubs(subsData || []);
      } catch (err) {
        console.error("Error loading dashboard data", err);
      }
    }
    loadDashboardData();
  }, []);

  const kpis = [
    { label: 'Total Students', value: stats?.students || '...', change: 'Live DB', icon: GraduationCap, color: '#00E5FF' },
    { label: 'Total Faculty',  value: stats?.faculty || '...',  change: 'Live DB', icon: Users,         color: '#F59E0B' },
    { label: 'Total Staff',    value: stats?.staff || '...',    change: 'Live DB', icon: Users,         color: '#F472B6' },
    { label: 'Active Buildings',value: buildingList.length || '...', change: 'Live DB', icon: Building2, color: '#7B61FF' },
  ];

  return (
    <PageTransition className="min-h-screen px-4 pb-20 pt-28 sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* Welcome banner */}
        <motion.div {...fadeUp(0.05)} className="mb-8">
          <div className="rounded-2xl border border-white/10 p-6"
               style={{ background: 'linear-gradient(135deg,rgba(0,229,255,0.08),rgba(123,97,255,0.06))', backdropFilter: 'blur(16px)' }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-slate-400">{greeting()},</p>
                <h1 className="font-display text-2xl font-extrabold text-white">{user?.name} 👋</h1>
                <p className="mt-1 text-sm text-slate-400">
                  MVSR Engineering College · Admin Dashboard ·{' '}
                  <span className="text-[#00E5FF]">
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </p>
              </div>
              <span className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400">
                ADMINISTRATOR
              </span>
            </div>
          </div>
        </motion.div>

        {/* KPI cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} {...fadeUp(0.1 + i * 0.06)}
                        className="rounded-2xl border border-white/8 p-5"
                        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)' }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl"
                      style={{ background: kpi.color + '18', color: kpi.color }}>
                  <kpi.icon size={18} />
                </span>
                <TrendingUp size={13} className="text-slate-600" />
              </div>
              <p className="font-display text-2xl font-extrabold text-white">{kpi.value}</p>
              <p className="mt-0.5 text-xs text-slate-400">{kpi.label}</p>
              <p className="mt-1 text-[10px]" style={{ color: kpi.color }}>{kpi.change}</p>
            </motion.div>
          ))}
        </div>

        {/* Middle row */}
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          {/* Weather widget */}
          <motion.div {...fadeUp(0.28)} className="glass-card rounded-2xl p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-white text-sm">
              <Cloud size={15} className="text-[#38BDF8]" /> Campus Weather
            </h2>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl">{weather ? weather.icon : '🌡️'}</span>
              <div>
                <p className="font-display text-4xl font-extrabold text-white">{weather ? weather.temp : weather === null ? '…' : '—'}</p>
                <p className="text-xs text-slate-400">{weather ? weather.condition : weather === null ? 'Loading' : 'Weather unavailable (offline?)'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Humidity', value: weather ? weather.humidity : '—', icon: '💧' },
                { label: 'Wind',     value: weather ? weather.wind : '—',     icon: '🌬️' },
              ].map((w) => (
                <div key={w.label} className="rounded-xl border border-white/8 bg-white/4 p-3 text-center">
                  <p className="text-lg">{w.icon}</p>
                  <p className="font-bold text-white text-sm">{w.value}</p>
                  <p className="text-[10px] text-slate-500">{w.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-600 text-center">Nadergul, Hyderabad{weather ? ` · reading at ${weather.at} IST (Open-Meteo)` : ''}</p>
          </motion.div>

          {/* Alerts */}
          <motion.div {...fadeUp(0.32)} className="glass-card rounded-2xl p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-white text-sm">
              <Bell size={15} className="text-[#F59E0B]" /> System Alerts
              <span className="ml-auto rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                {alerts.length}
              </span>
            </h2>
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-start gap-2 rounded-xl border border-white/6 bg-white/4 p-3">
                  <AlertTriangle size={13} className={a.type === 'error' ? 'text-red-400 mt-0.5' : a.type === 'warning' ? 'text-amber-400 mt-0.5' : 'text-blue-400 mt-0.5'} />
                  <div>
                    <p className="text-xs text-slate-300 leading-relaxed">{a.msg}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions + Activity */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Quick actions */}
          <motion.div {...fadeUp(0.38)} className="glass-card rounded-2xl p-5">
            <h2 className="mb-4 font-bold text-white text-sm">⚡ Quick Actions</h2>
            <div className="grid grid-cols-3 gap-2">
              {quickActions.map((qa) => (
                <a key={qa.label} href={qa.href}
                   className="flex flex-col items-center gap-2 rounded-xl border border-white/8 bg-white/4 p-3 text-center transition hover:border-white/20 hover:bg-white/8 active:scale-95">
                  <span className="grid h-9 w-9 place-items-center rounded-xl"
                        style={{ background: qa.color + '18', color: qa.color }}>
                    <qa.icon size={16} />
                  </span>
                  <span className="text-[10px] font-medium text-slate-300 leading-tight">{qa.label}</span>
                </a>
              ))}
            </div>
          </motion.div>

          {/* Activity feed */}
          <motion.div {...fadeUp(0.42)} className="glass-card rounded-2xl p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-white text-sm">
              <Activity size={15} className="text-[#00FFB3]" /> Recent Activity
            </h2>
            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {activity === null && <p className="text-xs text-slate-500">Loading…</p>}
              {activity?.length === 0 && <p className="text-xs text-slate-500">No certificate requests yet.</p>}
              {activity?.map((r) => (
                <a key={r.id} href="/services/setup" className="flex items-start gap-3 py-2 border-b border-white/5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/8 text-[10px] font-bold text-slate-300">
                    {(r.student?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-300">
                      <strong className="text-white">{r.student?.name}</strong>{' '}
                      <span className="text-slate-400">requested {r.doc_name}</span>
                    </p>
                    <p className="truncate text-[10px] text-slate-500">{whereNow(r)} · {fmtIst(r.created_at)}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </a>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Building occupancy summary */}
        <motion.div {...fadeUp(0.48)} className="mt-4 glass-card rounded-2xl p-5">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-white text-sm">
            <Building2 size={15} className="text-[#7B61FF]" /> Classes in session now
            <span className="ml-auto text-[10px] font-normal text-slate-500">from the timetable</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {buildingList.map((b) => {
              const live = inSession?.live[b.id]?.length || 0;
              const rooms = inSession?.rooms[b.id] || 0;
              return (
                <div key={b.id} className="rounded-xl border border-white/6 bg-white/4 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                    <span className="text-[10px]" style={{ color: b.color }}>{inSession === null ? '…' : rooms ? `${live}/${rooms} rooms` : '—'}</span>
                  </div>
                  <p className="text-xs font-semibold text-white truncate">{b.name}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{inSession === null ? 'Loading' : rooms ? `${live} class${live === 1 ? '' : 'es'} running` : 'No timetable yet'}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${rooms ? (live / rooms) * 100 : 0}%`, background: b.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Today's Faculty Substitutions widget */}
        <motion.div {...fadeUp(0.54)} className="mt-4 glass-card rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-white text-sm">
              <UserCheck size={15} className="text-[#F59E0B]" /> Today's Faculty Substitutions
              {todaySubs.length > 0 && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  {todaySubs.length} active
                </span>
              )}
            </h2>
            <a href="/admin/substitutions"
               className="text-xs text-[#00E5FF] hover:underline font-semibold flex items-center gap-1">
              Manage <ChevronRight size={12} />
            </a>
          </div>
          {todaySubs.length === 0 ? (
            <div className="rounded-xl border border-white/6 bg-white/4 p-4 text-center">
              <p className="text-xs text-slate-400">✅ No substitutions today — all faculty available per official timetable.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todaySubs.slice(0, 3).map((sub) => (
                <div key={sub.id}
                     className="flex items-center gap-3 rounded-xl border p-3"
                     style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
                  <span className="text-base">🟡</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white">
                      P{sub.period_number} · {sub.classroom_id} · {sub.section}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      <span className="text-red-400">{sub.original_faculty_name || 'N/A'}</span>
                      {' → '}
                      <span className="text-green-400">{sub.replacement_faculty_name}</span>
                      {' · '}{sub.reason}
                    </p>
                  </div>
                  <span className="text-[10px] text-amber-400 font-bold shrink-0">
                    {sub.start_time}–{sub.end_time}
                  </span>
                </div>
              ))}
              {todaySubs.length > 3 && (
                <p className="text-center text-[10px] text-slate-500 pt-1">
                  +{todaySubs.length - 3} more —{' '}
                  <a href="/admin/substitutions" className="text-[#00E5FF] hover:underline">view all</a>
                </p>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </PageTransition>
  );
}
