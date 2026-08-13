// LibraryAnalytics.jsx
import { BookOpen } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import MonitoringLayout, { AlertPill, DonutRing, HBar, MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { library } from '../../data/monitoring.js';

const SEAT_COLORS = { occupied: '#ef4444', booked: '#F59E0B', available: '#00FFB3' };

export default function LibraryAnalytics() {
  const totalPct = Math.round((library.occupiedSeats / library.totalSeats) * 100);

  return (
    <MonitoringLayout
      title="Library Analytics"
      subtitle="Live seat occupancy & AI insights · Suhruth University Library"
      icon={<BookOpen size={22} />}
      accentColor="#7B61FF"
      liveLabel="Live · Refreshed every 30s"
      kpis={[
        { label: 'Total Seats',    value: library.totalSeats,    icon: '💺', unit: '' },
        { label: 'Occupied',       value: library.occupiedSeats, icon: '🔴', unit: '', delta: 5  },
        { label: 'Booked',         value: library.bookedSeats,   icon: '🟡', unit: '' },
        { label: 'Available',      value: library.availableSeats,icon: '🟢', unit: '' },
        { label: 'Occupancy',      value: totalPct,              icon: '📊', unit: '%' },
      ]}
    >
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        {/* Donut + sections */}
        <MCard title="Live Seat Status" accent="#7B61FF" className="flex flex-col items-center gap-4">
          <DonutRing value={library.occupiedSeats} max={library.totalSeats} color="#7B61FF" label="Occupied" size={110} />
          <div className="w-full space-y-2">
            {[
              { label: 'Occupied', value: library.occupiedSeats, color: '#ef4444' },
              { label: 'Booked',   value: library.bookedSeats,   color: '#F59E0B' },
              { label: 'Free',     value: library.availableSeats,color: '#00FFB3' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-bold text-white">{s.value}</span>
              </div>
            ))}
          </div>
        </MCard>

        {/* Section breakdown */}
        <MCard title="Section Breakdown" accent="#7B61FF">
          {library.sections.map((sec) => (
            <div key={sec.name} className="mb-4">
              <p className="text-xs font-semibold text-white mb-2">{sec.name}</p>
              <HBar label="Occupied" value={sec.occupied} max={sec.total} color="#ef4444" />
              <HBar label="Booked"   value={sec.booked}   max={sec.total} color="#F59E0B" />
            </div>
          ))}
          <div className="mt-2 rounded-xl bg-purple-500/10 border border-purple-500/20 p-3">
            <p className="text-[10px] font-semibold text-purple-400 mb-1">⏰ Peak Hours Today</p>
            {library.peakHours.map((h) => (
              <span key={h} className="mr-2 text-xs text-white">{h}</span>
            ))}
          </div>
        </MCard>

        {/* AI Prediction */}
        <MCard title="AI Occupancy Prediction" accent="#7B61FF">
          <div className="mb-4 rounded-xl border border-purple-500/20 bg-purple-500/8 p-4 text-center">
            <p className="text-3xl font-extrabold font-display text-white">{library.aiPrediction.tomorrow}</p>
            <p className="text-xs text-slate-400 mt-1">Predicted seats occupied tomorrow</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Week Peak</span>
              <span className="text-purple-400 font-medium">{library.aiPrediction.weekPeak}</span>
            </div>
          </div>
          <AlertPill level="info" message={library.aiPrediction.suggestion} />

          {/* Seat map mini */}
          <p className="mt-4 mb-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">Seat Map Preview</p>
          <div className="flex flex-wrap gap-1">
            {library.seatMap.slice(0, 80).map((s) => (
              <span key={s.id} className="h-3 w-3 rounded-sm"
                    style={{ background: SEAT_COLORS[s.status] + '90' }} />
            ))}
          </div>
          <div className="mt-2 flex gap-3">
            {Object.entries(SEAT_COLORS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-slate-400 capitalize">
                <span className="h-2 w-2 rounded-sm" style={{ background: v }} />{k}
              </span>
            ))}
          </div>
        </MCard>
      </div>

      {/* Hourly visitors */}
      <MCard title="Hourly Visitor Trend" accent="#7B61FF" className="mb-4">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={library.hourlyVisitors} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="libGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#7B61FF" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#7B61FF" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} interval={3} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
            <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
            <Area type="monotone" dataKey="value" stroke="#7B61FF" strokeWidth={2} fill="url(#libGrad)" dot={false} name="Visitors" />
          </AreaChart>
        </ResponsiveContainer>
      </MCard>

      {/* Weekly bar */}
      <MCard title="Weekly Visitor Pattern" accent="#7B61FF">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={library.weeklyVisitors} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
            <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
            <Bar dataKey="visitors" fill="#7B61FF" radius={[4, 4, 0, 0]} name="Visitors" />
          </BarChart>
        </ResponsiveContainer>
      </MCard>
    </MonitoringLayout>
  );
}
