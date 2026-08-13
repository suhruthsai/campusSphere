// SmartParking.jsx
import { Car, Clock, MapPin, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import MonitoringLayout, { AlertPill, DonutRing, HBar, MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { parking } from '../../data/monitoring.js';

const SLOT_COLORS = { A: '#ef4444', B: '#F59E0B', C: '#00FFB3', D: '#7B61FF' };

export default function SmartParking() {
  const pct = Math.round((parking.occupiedSlots / parking.totalSlots) * 100);

  return (
    <MonitoringLayout
      title="Smart Parking"
      subtitle="Real-time vehicle tracking · Suhruth University"
      icon={<Car size={22} />}
      accentColor="#F59E0B"
      liveLabel="Live · Updated now"
      kpis={[
        { label: 'Total Slots',    value: parking.totalSlots,   icon: '🅿️',  unit: '' },
        { label: 'Occupied',       value: parking.occupiedSlots, icon: '🚗',  unit: '', delta: 4   },
        { label: 'Available',      value: parking.totalSlots - parking.occupiedSlots, icon: '✅', unit: '' },
        { label: 'Vehicles In',    value: parking.vehiclesIn,   icon: '↗️',  unit: '' },
        { label: 'Vehicles Out',   value: parking.vehiclesOut,  icon: '↙️',  unit: '' },
        { label: 'Occupancy',      value: pct,                  icon: '📊',  unit: '%', delta: 6 },
      ]}
    >
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        {/* Zone donut rings */}
        <MCard title="Zone Occupancy" accent="#F59E0B" className="flex items-center justify-around flex-wrap gap-4">
          {parking.zones.map((z) => (
            <DonutRing key={z.id} value={z.occupied} max={z.total} color={z.color} label={`Zone ${z.id}`} size={88} />
          ))}
        </MCard>

        {/* Zone breakdown bars */}
        <MCard title="Zone Breakdown" accent="#F59E0B" className="lg:col-span-2">
          {parking.zones.map((z) => (
            <HBar key={z.id} label={z.label} value={z.occupied} max={z.total} color={z.color} unit=" vehicles" />
          ))}
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3">
            <p className="text-[11px] font-semibold text-amber-400">🤖 AI Prediction — Next 3 Hours</p>
            <div className="mt-2 flex gap-3">
              {parking.predictionNext3h.map((v, i) => (
                <div key={i} className="flex-1 text-center rounded-xl bg-white/5 py-2">
                  <p className="font-bold text-white text-sm">{v}%</p>
                  <p className="text-[10px] text-slate-500">+{i + 1}h</p>
                </div>
              ))}
            </div>
          </div>
        </MCard>
      </div>

      {/* Hourly chart */}
      <MCard title="Hourly Occupancy Trend" accent="#F59E0B" className="mb-4">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={parking.hourlyOccupancy} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="parkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} interval={3} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
            <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
            <Area type="monotone" dataKey="value" stroke="#F59E0B" strokeWidth={2} fill="url(#parkGrad)" dot={false} name="Vehicles" />
          </AreaChart>
        </ResponsiveContainer>
      </MCard>

      {/* Entry/Exit log */}
      <MCard title="Vehicle Entry / Exit Logs" accent="#F59E0B">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/8">
                {['Time', 'Vehicle No.', 'Type', 'Zone', 'Action', 'Driver'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parking.entryExitLogs.map((log) => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/3 transition">
                  <td className="px-3 py-2 text-slate-400">{log.time}</td>
                  <td className="px-3 py-2 font-mono text-white">{log.vehicle}</td>
                  <td className="px-3 py-2 text-slate-400">{log.type}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: SLOT_COLORS[log.zone] + '18', color: SLOT_COLORS[log.zone] }}>
                      Zone {log.zone}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-semibold ${log.action === 'entry' ? 'text-green-400' : 'text-red-400'}`}>
                      {log.action === 'entry' ? '▲ Entry' : '▼ Exit'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{log.driver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MCard>
    </MonitoringLayout>
  );
}
