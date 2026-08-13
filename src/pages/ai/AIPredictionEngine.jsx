// AIPredictionEngine.jsx — Module 16
import { Brain, RefreshCw, TrendingUp, History, Cpu, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { useState } from 'react';
import MonitoringLayout, { AlertPill, MCard, HBar } from '../../components/monitoring/MonitoringLayout.jsx';
import { predictions } from '../../data/ai.js';

const MODULE_COLORS = {
  parking: '#F59E0B', library: '#7B61FF', classroom: '#38BDF8',
  energy: '#00FFB3', water: '#38BDF8', crowd: '#F472B6', equipment: '#ef4444',
};

const TABS = ['Live Forecasts', 'Models', 'History', 'Training'];

export default function AIPredictionEngine() {
  const [tab, setTab] = useState('Live Forecasts');

  return (
    <MonitoringLayout
      title="AI Prediction Engine"
      subtitle="Machine learning models powering campus intelligence"
      icon={<Brain size={22} />}
      accentColor="#00E5FF"
      liveLabel="7 Models Active"
      kpis={[
        { label: 'Active Models',  value: predictions.models.filter(m => m.status === 'active').length, icon: '🤖', unit: '' },
        { label: 'Avg Accuracy',   value: (predictions.models.reduce((a, m) => a + m.accuracy, 0) / predictions.models.length).toFixed(1), icon: '🎯', unit: '%' },
        { label: 'Total Data Points', value: (predictions.models.reduce((a, m) => a + m.dataPoints, 0) / 1000).toFixed(0) + 'K', icon: '📊', unit: '' },
        { label: 'Predictions Today', value: 342, icon: '⚡', unit: '', delta: 12 },
        { label: 'Retraining',     value: predictions.models.filter(m => m.status === 'retraining').length, icon: '🔄', unit: '' },
      ]}
    >
      {/* Tab bar */}
      <div className="mb-5 flex gap-1 rounded-xl border border-white/8 bg-white/3 p-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              tab === t ? 'bg-[#00E5FF]/12 text-[#00E5FF]' : 'text-slate-400 hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Live Forecasts' && <LiveForecasts />}
      {tab === 'Models' && <ModelRegistry />}
      {tab === 'History' && <PredictionHistory />}
      {tab === 'Training' && <TrainingLogs />}
    </MonitoringLayout>
  );
}

function LiveForecasts() {
  const f = predictions.liveForecasts;
  const modules = [
    { key: 'parking',   label: 'Parking Occupancy',   unit: 'slots', icon: '🅿️' },
    { key: 'library',   label: 'Library Seats',        unit: 'seats', icon: '📚' },
    { key: 'classroom', label: 'Classrooms Available',  unit: 'rooms', icon: '🏫' },
    { key: 'energy',    label: 'Energy Demand',         unit: 'kW',    icon: '⚡' },
    { key: 'water',     label: 'Water Usage',           unit: 'L/hr',  icon: '💧' },
    { key: 'crowd',     label: 'Crowd Count',           unit: 'people',icon: '👥' },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        {modules.map(({ key, label, unit, icon }) => {
          const data = f[key];
          const trendColor = data.trend === 'rising' ? '#F59E0B' : data.trend === 'falling' ? '#00FFB3' : '#38BDF8';
          return (
            <MCard key={key} accent={MODULE_COLORS[key]}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-lg mb-1">{icon}</p>
                  <p className="text-xs font-semibold text-white">{label}</p>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                      style={{ background: trendColor + '18', color: trendColor }}>
                  {data.trend} ↗
                </span>
              </div>
              <p className="font-display text-2xl font-extrabold text-white mb-1">
                {data.next1h}<span className="text-sm text-slate-400 ml-1">{unit}</span>
              </p>
              <p className="text-[10px] text-slate-500 mb-3">Predicted next hour · {(data.confidence * 100).toFixed(0)}% confidence</p>

              {/* 3-hour mini chart */}
              <div className="flex items-end gap-1 h-10">
                {data.next3h.map((v, i) => {
                  const max = Math.max(...data.next3h);
                  return (
                    <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${(v / max) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                      className="flex-1 rounded-t-md" style={{ background: MODULE_COLORS[key] + '60', minHeight: 4 }}>
                    </motion.div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-slate-600">
                <span>+1h</span><span>+2h</span><span>+3h</span>
              </div>

              {data.alert && (
                <div className="mt-3 rounded-lg border p-2 text-[10px]"
                     style={{ background: MODULE_COLORS[key] + '08', borderColor: MODULE_COLORS[key] + '25', color: MODULE_COLORS[key] }}>
                  ⚠️ {data.alert}
                </div>
              )}
            </MCard>
          );
        })}
      </div>

      {/* Equipment failure prediction */}
      <MCard title="⚙️ Equipment Failure Prediction" accent="#ef4444">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs text-slate-400 mb-1">Predicted Failures</p>
            <p className="font-display text-2xl font-bold text-red-400">{f.equipment.failures}</p>
          </div>
          <div className="flex-1 min-w-[250px]">
            <AlertPill level="warning" message={f.equipment.nextLikely} sub={`Confidence: ${(f.equipment.confidence * 100).toFixed(0)}%`} />
          </div>
        </div>
      </MCard>
    </>
  );
}

function ModelRegistry() {
  return (
    <MCard title="Registered ML Models" accent="#00E5FF">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/8">
              {['Model Name', 'Algorithm', 'Module', 'Accuracy', 'Features', 'Data Points', 'Last Trained', 'Status'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {predictions.models.map((m) => (
              <tr key={m.id} className="border-b border-white/5 hover:bg-white/3 transition">
                <td className="px-3 py-2.5 font-semibold text-white">{m.name}</td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">{m.algorithm}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                        style={{ background: (MODULE_COLORS[m.module] || '#94a3b8') + '18', color: MODULE_COLORS[m.module] || '#94a3b8' }}>
                    {m.module}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`font-bold ${m.accuracy >= 90 ? 'text-green-400' : m.accuracy >= 85 ? 'text-amber-400' : 'text-red-400'}`}>
                    {m.accuracy}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-400">{m.features}</td>
                <td className="px-3 py-2.5 text-slate-400">{m.dataPoints.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-slate-500">{m.lastTrained}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    m.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                  }`}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MCard>
  );
}

function PredictionHistory() {
  return (
    <MCard title="Prediction History — Predicted vs Actual" accent="#00E5FF">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={predictions.history} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
          <Tooltip contentStyle={{ background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
          <Bar dataKey="predicted" fill="#00E5FF" radius={[4, 4, 0, 0]} name="Predicted" />
          <Bar dataKey="actual" fill="#7B61FF" radius={[4, 4, 0, 0]} name="Actual" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/8">
              {['Date', 'Module', 'Model', 'Predicted', 'Actual', 'Accuracy'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {predictions.history.map((h) => (
              <tr key={h.id} className="border-b border-white/5 hover:bg-white/3 transition">
                <td className="px-3 py-2 text-slate-400">{h.date}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                        style={{ background: (MODULE_COLORS[h.module] || '#94a3b8') + '18', color: MODULE_COLORS[h.module] || '#94a3b8' }}>
                    {h.module}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{h.model}</td>
                <td className="px-3 py-2 text-white font-semibold">{h.predicted.toLocaleString()}</td>
                <td className="px-3 py-2 text-white font-semibold">{h.actual.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={`font-bold ${h.accuracy >= 95 ? 'text-green-400' : 'text-amber-400'}`}>{h.accuracy}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MCard>
  );
}

function TrainingLogs() {
  return (
    <MCard title="Model Training Logs" accent="#00E5FF">
      <div className="space-y-3">
        {predictions.trainingLogs.map((log) => (
          <motion.div key={log.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/8 bg-white/3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-white">{log.model}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                log.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
              }`}>{log.status}</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: 'Date', value: log.date },
                { label: 'Duration', value: log.duration },
                { label: 'Epochs', value: log.epochs },
                { label: 'Loss', value: log.loss },
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-[10px] text-slate-500">{m.label}</p>
                  <p className="text-xs font-bold text-white">{m.value}</p>
                </div>
              ))}
            </div>
            {log.status === 'in-progress' && (
              <div className="mt-3 h-1.5 rounded-full bg-white/8 overflow-hidden">
                <motion.div className="h-full rounded-full bg-amber-400"
                  initial={{ width: 0 }} animate={{ width: '65%' }} transition={{ duration: 1.5, ease: 'easeInOut' }} />
              </div>
            )}
          </motion.div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="flex items-center gap-2 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/25 px-4 py-2 text-xs font-semibold text-[#00E5FF] hover:bg-[#00E5FF]/20 transition">
          <RefreshCw size={13} /> Retrain All Models
        </button>
        <button className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition">
          <Cpu size={13} /> Evaluate Performance
        </button>
      </div>
    </MCard>
  );
}
