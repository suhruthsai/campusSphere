// AdminDashboard.jsx — KPI + Live stats + Weather + Alerts
import {
  Activity, AlertTriangle, Bell, BookOpen, Building2, CalendarDays,
  ChevronRight, Cloud, GraduationCap, TrendingUp, Users, Wifi, Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authApi, buildingsApi, announcementsApi } from '../../utils/api.js';

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

// Activity feed mock (until we build an activity log API)
const activityLogs = [
  { id: 1, userId: 'ux1', action: 'added a new event', resource: 'Main Auditorium', timestamp: new Date().toISOString() },
  { id: 2, userId: 'ux2', action: 'marked attendance', resource: 'CSE Block Room 102', timestamp: new Date(Date.now() - 3600000).toISOString() }
];

const quickActions = [
  { label: 'Add User',       icon: Users,       href: '/admin/users',     color: '#00E5FF' },
  { label: 'Manage Buildings',icon: Building2,  href: '/admin/buildings', color: '#F59E0B' },
  { label: 'View Floors',    icon: Activity,    href: '/admin/floors',    color: '#00FFB3' },
  { label: 'Classrooms',     icon: BookOpen,    href: '/classrooms',      color: '#7B61FF' },
  { label: 'Labs',           icon: Zap,         href: '/labs',            color: '#F472B6' },
];

const weather = { temp: '27°C', condition: 'Partly Cloudy', humidity: '68%', wind: '12 km/h' };

export default function AdminDashboard() {
  const { user } = useAuth();
  
  const [stats, setStats] = useState(null);
  const [buildingList, setBuildingList] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [statsData, bldgsData, annsData] = await Promise.all([
          authApi.stats(),
          buildingsApi.list(),
          announcementsApi.list()
        ]);
        setStats(statsData);
        setBuildingList(bldgsData);
        setAlerts(annsData.map((a, i) => ({
          id: a.id,
          type: a.priority === 'high' ? 'error' : a.priority === 'medium' ? 'warning' : 'info',
          msg: a.title + ' - ' + a.content,
          time: new Date(a.created_at).toLocaleDateString()
        })));
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
                <p className="text-sm text-slate-400">Good morning,</p>
                <h1 className="font-display text-2xl font-extrabold text-white">{user?.name} 👋</h1>
                <p className="mt-1 text-sm text-slate-400">
                  Suhruth University · Admin Dashboard ·{' '}
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
              <span className="text-5xl">⛅</span>
              <div>
                <p className="font-display text-4xl font-extrabold text-white">{weather.temp}</p>
                <p className="text-xs text-slate-400">{weather.condition}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Humidity', value: weather.humidity, icon: '💧' },
                { label: 'Wind',     value: weather.wind,     icon: '🌬️' },
              ].map((w) => (
                <div key={w.label} className="rounded-xl border border-white/8 bg-white/4 p-3 text-center">
                  <p className="text-lg">{w.icon}</p>
                  <p className="font-bold text-white text-sm">{w.value}</p>
                  <p className="text-[10px] text-slate-500">{w.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-600 text-center">Hyderabad, Telangana · Updated just now</p>
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
              {activityLogs.map((log) => {
                const actor = users.find((u) => u.id === log.userId);
                return (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-white/5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/8 text-xs font-bold text-slate-300">
                      {actor?.avatar}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-300">
                        <strong className="text-white">{log.userId}</strong>{' '}
                        <span className="text-slate-400">{log.action}</span>
                      </p>
                      <p className="text-[10px] text-slate-600">{log.resource} · {log.timestamp.slice(11, 16)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Building occupancy summary */}
        <motion.div {...fadeUp(0.48)} className="mt-4 glass-card rounded-2xl p-5">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-white text-sm">
            <Building2 size={15} className="text-[#7B61FF]" /> Campus Occupancy Overview
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {buildingList.slice(0, 10).map((b) => (
              <div key={b.id} className="rounded-xl border border-white/6 bg-white/4 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                  <span className="text-[10px]" style={{ color: b.color }}>{b.occupancy}%</span>
                </div>
                <p className="text-xs font-semibold text-white truncate">{b.name}</p>
                <div className="mt-1.5 h-1 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${b.occupancy}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
