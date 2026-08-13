// WaterManagement.jsx
import { Droplets } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import MonitoringLayout, { AlertPill, DonutRing, HBar, MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { water } from '../../data/monitoring.js';

export default function WaterManagement() {
  return (
    <MonitoringLayout
      title="Water Management"
      subtitle="Tank levels, leak detection & consumption analytics"
      icon={<Droplets size={22} />}
      accentColor="#38BDF8"
      liveLabel="Live · IoT Sensors"
      kpis={[
        { label: "Today's Usage",    value: water.totalTodayLitres.toLocaleString(), icon: '💧', unit: 'L', delta: -2 },
        { label: 'Tanks Online',     value: water.tanks.length,                      icon: '🏗️',  unit: ''           },
        { label: 'Leak Alerts',      value: water.leaks.filter(l=>l.status!=='resolved').length, icon: '⚠️', unit: '' },
        { label: 'Forecast Tomorrow',value: water.aiPrediction.tomorrow.toLocaleString(), icon: '🤖', unit: 'L'       },
      ]}
    >
      {/* Tank levels */}
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        {water.tanks.map((tank) => (
          <MCard key={tank.id} accent="#38BDF8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-white">{tank.label}</p>
              <DonutRing value={tank.current} max={tank.capacity} color={tank.color} label="" size={60} />
            </div>
            <HBar label="Current Level" value={tank.current} max={tank.capacity} color={tank.color} unit=" L" />
            <p className="text-[10px] text-slate-500 text-right">{tank.capacity.toLocaleString()} L capacity</p>
          </MCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        {/* Leak detection */}
        <MCard title="Leak Detection" accent="#38BDF8">
          {water.leaks.map((leak) => (
            <AlertPill
              key={leak.id}
              level={leak.status === 'resolved' ? 'success' : leak.severity === 'medium' ? 'warning' : 'info'}
              message={leak.location}
              sub={`Detected ${leak.detected} · ${leak.status}`}
            />
          ))}
          <div className="mt-3 rounded-xl bg-blue-500/8 border border-blue-500/20 p-3">
            <p className="text-[10px] font-semibold text-sky-400">🤖 AI Prediction</p>
            <p className="text-xs text-slate-300 mt-1">{water.aiPrediction.status}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Next week: ~{water.aiPrediction.nextWeek.toLocaleString()} L</p>
          </div>
        </MCard>

        {/* Building usage */}
        <MCard title="Consumption by Area" accent="#38BDF8">
          {water.buildingUsage.map((b) => (
            <HBar key={b.building} label={b.building} value={b.litres}
                  max={water.buildingUsage[0].litres} color="#38BDF8" unit=" L" />
          ))}
        </MCard>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MCard title="Hourly Usage Today" accent="#38BDF8">
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={water.hourlyUsage} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38BDF8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke="#38BDF8" strokeWidth={2} fill="url(#waterGrad)" dot={false} name="Litres" />
            </AreaChart>
          </ResponsiveContainer>
        </MCard>
        <MCard title="Weekly Usage" accent="#38BDF8">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={water.weeklyUsage} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
              <Bar dataKey="litres" fill="#38BDF8" radius={[4, 4, 0, 0]} name="Litres" />
            </BarChart>
          </ResponsiveContainer>
        </MCard>
      </div>
    </MonitoringLayout>
  );
}
