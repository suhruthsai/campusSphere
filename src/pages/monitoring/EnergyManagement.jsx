// EnergyManagement.jsx
import { Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid } from 'recharts';
import MonitoringLayout, { AlertPill, HBar, MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { energy } from '../../data/monitoring.js';

export default function EnergyManagement() {
  return (
    <MonitoringLayout
      title="Energy Management"
      subtitle="Building-wise power consumption & AI forecast · Suhruth University"
      icon={<Zap size={22} />}
      accentColor="#00FFB3"
      liveLabel="Live · Grid sync"
      kpis={[
        { label: "Today's Usage",   value: energy.totalTodayKwh.toLocaleString(), icon: '⚡', unit: 'kWh', delta: 3  },
        { label: 'Peak Demand',     value: energy.peakDemandKw,                  icon: '📈', unit: 'kW'            },
        { label: 'Solar Generated', value: energy.solarGenKwh,                   icon: '☀️',  unit: 'kWh'           },
        { label: 'Savings',         value: energy.savings,                        icon: '💰', unit: ''              },
        { label: 'AI Forecast (Tomorrow)', value: energy.aiForecastTomorrow.toLocaleString(), icon: '🤖', unit: 'kWh' },
      ]}
    >
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        {/* Building usage bars */}
        <MCard title="Building Power Consumption" accent="#00FFB3">
          {energy.buildingUsage.map((b) => (
            <HBar key={b.building} label={b.building} value={b.kwh}
                  max={energy.buildingUsage[0].kwh} color={b.color} unit=" kWh" />
          ))}
        </MCard>

        {/* Alerts + weekly forecast */}
        <div className="space-y-4">
          <MCard title="High Usage Alerts" accent="#00FFB3">
            {energy.alerts.map((a) => (
              <AlertPill key={a.id} level={a.level} message={a.msg} sub={a.building} />
            ))}
          </MCard>
          <MCard title="AI Forecast — This Week" accent="#00FFB3">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={energy.aiForecastWeek.map((v, i) => ({
                day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], kwh: v,
              }))} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
                <Bar dataKey="kwh" fill="#00FFB3" radius={[4, 4, 0, 0]} name="kWh" />
              </BarChart>
            </ResponsiveContainer>
          </MCard>
        </div>
      </div>

      {/* Hourly & monthly charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MCard title="Today — Hourly Consumption" accent="#00FFB3">
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={energy.hourlyConsumption} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="enGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00FFB3" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00FFB3" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke="#00FFB3" strokeWidth={2} fill="url(#enGrad)" dot={false} name="kW" />
            </AreaChart>
          </ResponsiveContainer>
        </MCard>

        <MCard title="Monthly Consumption" accent="#00FFB3">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={energy.monthlyConsumption} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
              <Line type="monotone" dataKey="kwh" stroke="#00FFB3" strokeWidth={2} dot={{ r: 3, fill: '#00FFB3' }} name="kWh" />
            </LineChart>
          </ResponsiveContainer>
        </MCard>
      </div>
    </MonitoringLayout>
  );
}
