// CrowdAnalytics.jsx
import { Users } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import MonitoringLayout, { AlertPill, MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { crowd } from '../../data/monitoring.js';

const DENSITY_STYLE = {
  High:   { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444',  border: 'rgba(239,68,68,0.25)'  },
  Medium: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B',  border: 'rgba(245,158,11,0.25)' },
  Low:    { bg: 'rgba(0,255,179,0.12)',  text: '#00FFB3',  border: 'rgba(0,255,179,0.25)'  },
};

export default function CrowdAnalytics() {
  return (
    <MonitoringLayout
      title="Crowd Analytics"
      subtitle="Real-time crowd density, heatmaps & AI predictions"
      icon={<Users size={22} />}
      accentColor="#F472B6"
      liveLabel="Live · Camera feeds"
      kpis={[
        { label: 'On Campus Now',   value: crowd.totalOnCampus.toLocaleString(), icon: '👥', unit: '', delta: 8 },
        { label: 'Zones Monitored', value: crowd.zones.length,                   icon: '📍', unit: ''           },
        { label: 'High Density',    value: crowd.zones.filter(z=>z.density==='High').length,   icon: '🔴', unit: '' },
        { label: 'Medium Density',  value: crowd.zones.filter(z=>z.density==='Medium').length, icon: '🟡', unit: '' },
        { label: 'Predicted Next Hr',value: crowd.aiPrediction.nextHour.toLocaleString(),      icon: '🤖', unit: '' },
      ]}
    >
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        {/* Zone heatmap grid */}
        <MCard title="Zone Density Heatmap" accent="#F472B6" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {crowd.zones.map((z) => {
              const ds = DENSITY_STYLE[z.density];
              const pct = Math.round((z.count / z.capacity) * 100);
              return (
                <motion.div key={z.id} whileHover={{ scale: 1.02 }}
                            className="rounded-xl border p-3" style={{ background: ds.bg, borderColor: ds.border }}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-semibold text-white leading-tight">{z.name}</p>
                    <span className="text-[10px] font-bold" style={{ color: ds.text }}>{z.density}</span>
                  </div>
                  <p className="font-display text-lg font-extrabold text-white">{z.count}</p>
                  <p className="text-[10px] text-slate-500">of {z.capacity} capacity</p>
                  <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                                className="h-full rounded-full" style={{ background: ds.text }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </MCard>

        {/* AI Prediction */}
        <MCard title="AI Crowd Prediction" accent="#F472B6">
          <div className="mb-4 rounded-xl border border-pink-500/20 bg-pink-500/8 p-4 text-center">
            <p className="text-3xl font-extrabold font-display text-white">{crowd.aiPrediction.nextHour.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">Expected next hour</p>
          </div>
          <div className="space-y-2 mb-3">
            <div className="text-xs">
              <p className="text-slate-500">Today's Peak Estimate</p>
              <p className="text-white font-medium">{crowd.aiPrediction.peakToday}</p>
            </div>
          </div>
          <AlertPill level="warning" message={crowd.aiPrediction.alert} />
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Peak Time Windows</p>
            {crowd.peakTimes.map((t) => (
              <span key={t} className="mr-2 inline-block rounded-full bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 text-[10px] text-pink-400 mb-1">{t}</span>
            ))}
          </div>
        </MCard>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MCard title="Hourly Crowd Count" accent="#F472B6">
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={crowd.hourlyCount} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="crowdGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F472B6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F472B6" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke="#F472B6" strokeWidth={2} fill="url(#crowdGrad)" dot={false} name="People" />
            </AreaChart>
          </ResponsiveContainer>
        </MCard>
        <MCard title="Weekly Pattern" accent="#F472B6">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={crowd.weeklyPattern} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
              <Bar dataKey="count" fill="#F472B6" radius={[4, 4, 0, 0]} name="People" />
            </BarChart>
          </ResponsiveContainer>
        </MCard>
      </div>
    </MonitoringLayout>
  );
}
