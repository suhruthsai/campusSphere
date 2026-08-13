// EnvironmentalMonitoring.jsx
import { Wind } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import MonitoringLayout, { AlertPill, MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { environment } from '../../data/monitoring.js';

// AQI color
function aqiColor(v) {
  if (v <= 50)  return '#00FFB3';
  if (v <= 100) return '#F59E0B';
  if (v <= 150) return '#ef4444';
  return '#7B61FF';
}

// Sensor metric card
function MetricCard({ label, value, unit, emoji, color }) {
  return (
    <div className="rounded-2xl border border-white/8 p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <p className="text-2xl mb-1">{emoji}</p>
      <p className="font-display text-xl font-extrabold text-white">{value}<span className="text-sm font-medium text-slate-400 ml-1">{unit}</span></p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function EnvironmentalMonitoring() {
  const cur = environment.current;

  return (
    <MonitoringLayout
      title="Environmental Monitoring"
      subtitle="Live campus air quality, weather & noise levels"
      icon={<Wind size={22} />}
      accentColor="#34D399"
      liveLabel="Live · 5 sensors active"
    >
      {/* Live metrics grid */}
      <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9">
        <MetricCard label="Temperature"  value={cur.temperature} unit="°C"   emoji="🌡️"  color="#F59E0B" />
        <MetricCard label="Humidity"     value={cur.humidity}    unit="%"    emoji="💧"  color="#38BDF8" />
        <MetricCard label="AQI"          value={cur.aqi}         unit=""     emoji="🌫️"  color={aqiColor(cur.aqi)} />
        <MetricCard label="CO₂"          value={cur.co2}         unit="ppm"  emoji="🏭"  color="#7B61FF" />
        <MetricCard label="Noise"        value={cur.noise}       unit="dB"   emoji="🔊"  color="#F472B6" />
        <MetricCard label="Rainfall"     value={cur.rainfall}    unit="mm"   emoji="🌧️"  color="#38BDF8" />
        <MetricCard label="Wind Speed"   value={cur.windSpeed}   unit="km/h" emoji="🌬️"  color="#34D399" />
        <MetricCard label="UV Index"     value={cur.uvIndex}     unit=""     emoji="☀️"   color="#F59E0B" />
        <MetricCard label="Wind Dir"     value={cur.windDir}     unit=""     emoji="🧭"  color="#94a3b8" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        {/* Sensor map table */}
        <MCard title="Campus Sensor Readings" accent="#34D399">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8">
                  {['Location', 'Temp', 'Humidity', 'AQI', 'Noise'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {environment.sensors.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/3 transition">
                    <td className="px-3 py-2 text-slate-300">{s.location}</td>
                    <td className="px-3 py-2 text-white">{s.temp}°C</td>
                    <td className="px-3 py-2 text-white">{s.humidity}%</td>
                    <td className="px-3 py-2">
                      <span className="font-bold" style={{ color: aqiColor(s.aqi) }}>{s.aqi}</span>
                    </td>
                    <td className="px-3 py-2 text-white">{s.noise} dB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MCard>

        {/* Weather forecast */}
        <MCard title="5-Day Weather Forecast" accent="#34D399">
          <div className="grid grid-cols-5 gap-2">
            {environment.forecast.map((f) => (
              <div key={f.day} className="rounded-xl border border-white/8 bg-white/4 p-2 text-center">
                <p className="text-xs font-semibold text-slate-400 mb-1">{f.day}</p>
                <p className="text-2xl mb-1">{f.icon}</p>
                <p className="text-xs font-bold text-white">{f.high}°</p>
                <p className="text-[10px] text-slate-500">{f.low}°</p>
                <p className="text-[10px] mt-1 text-sky-400">{f.rain}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3">
            <p className="text-[10px] font-semibold text-emerald-400">AQI Status</p>
            <p className="text-xs text-white mt-0.5">{environment.aqiCategory} — AQI {cur.aqi}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Sensitive groups should limit outdoor activity</p>
          </div>
        </MCard>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: 'Temperature (°C)',  data: environment.hourlyTemp,     color: '#F59E0B', key: 'tempGrad'  },
          { title: 'AQI Index',        data: environment.hourlyAQI,      color: '#34D399', key: 'aqiGrad'   },
        ].map(({ title, data, color, key }) => (
          <MCard key={title} title={title} accent={color}>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id={key} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} interval={3} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${key})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </MCard>
        ))}
      </div>
    </MonitoringLayout>
  );
}
