// RecommendationEngine.jsx — Module 18
import { Lightbulb, BookOpen, Car, Navigation, School, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import MonitoringLayout, { MCard, HBar } from '../../components/monitoring/MonitoringLayout.jsx';
import { recommendations } from '../../data/ai.js';

const TABS = [
  { key: 'study',     label: 'Study Spaces',  icon: '📚' },
  { key: 'parking',   label: 'Parking',        icon: '🅿️' },
  { key: 'routes',    label: 'Routes',          icon: '🗺️' },
  { key: 'classroom', label: 'Classrooms',     icon: '🏫' },
];

export default function RecommendationEngine() {
  const [tab, setTab] = useState('study');

  return (
    <MonitoringLayout
      title="Recommendation Engine"
      subtitle="AI-powered personalized recommendations for campus resources"
      icon={<Lightbulb size={22} />}
      accentColor="#F59E0B"
      liveLabel="AI Recommendations Active"
      kpis={[
        { label: 'Study Spaces Ranked', value: recommendations.studySpaces.length, icon: '📚', unit: '' },
        { label: 'Parking Zones',       value: recommendations.parkingSpots.length, icon: '🅿️', unit: '' },
        { label: 'Route Options',       value: recommendations.routes.length,       icon: '🗺️', unit: '' },
        { label: 'Classrooms Scored',   value: recommendations.classrooms.length,   icon: '🏫', unit: '' },
      ]}
    >
      {/* Tab bar */}
      <div className="mb-5 flex gap-1 rounded-xl border border-white/8 bg-white/3 p-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-semibold transition-all ${
              tab === t.key ? 'bg-[#F59E0B]/12 text-[#F59E0B]' : 'text-slate-400 hover:text-white'
            }`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'study'     && <StudySpaces />}
      {tab === 'parking'   && <ParkingRecs />}
      {tab === 'routes'    && <RouteRecs />}
      {tab === 'classroom' && <ClassroomRecs />}
    </MonitoringLayout>
  );
}

// ── Score badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  const color = score >= 90 ? '#00FFB3' : score >= 75 ? '#F59E0B' : '#ef4444';
  return (
    <div className="flex flex-col items-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl border-2" style={{ borderColor: color, color }}>
        <span className="font-display text-lg font-extrabold">{score}</span>
      </div>
      <p className="text-[9px] text-slate-500 mt-1">AI Score</p>
    </div>
  );
}

// ── Study Spaces ─────────────────────────────────────────────────────────────
function StudySpaces() {
  return (
    <div className="space-y-3">
      {recommendations.studySpaces.map((sp, i) => (
        <motion.div key={sp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <MCard>
            <div className="flex items-start gap-4">
              <ScoreBadge score={sp.score} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-bold text-white">{i === 0 && '⭐ '}{sp.name}</p>
                    <p className="text-[11px] text-slate-400">{sp.location}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    sp.noise === 'Very Low' ? 'bg-green-500/15 text-green-400' :
                    sp.noise === 'Low' ? 'bg-emerald-500/15 text-emerald-400' :
                    'bg-amber-500/15 text-amber-400'
                  }`}>🔇 {sp.noise} Noise</span>
                </div>
                <HBar label="Occupancy" value={sp.occupancy} max={sp.capacity} color={sp.occupancy / sp.capacity > 0.8 ? '#ef4444' : '#00FFB3'} />
                <div className="flex flex-wrap gap-1 mt-2 mb-2">
                  {sp.amenities.map((a) => (
                    <span key={a} className="rounded-full bg-white/5 border border-white/8 px-2 py-0.5 text-[10px] text-slate-400">{a}</span>
                  ))}
                </div>
                <p className="text-[11px] text-amber-400 italic">💡 {sp.reason}</p>
              </div>
            </div>
          </MCard>
        </motion.div>
      ))}
    </div>
  );
}

// ── Parking Recommendations ──────────────────────────────────────────────────
function ParkingRecs() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {recommendations.parkingSpots.map((p, i) => (
        <motion.div key={p.zone} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <MCard>
            <div className="flex items-start gap-3">
              <ScoreBadge score={p.score} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{i === 0 && '⭐ '}{p.label}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/5 p-2 text-center">
                    <p className="font-display text-lg font-extrabold text-white">{p.freeSlots}</p>
                    <p className="text-[10px] text-slate-500">Free Slots</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2 text-center">
                    <p className="font-display text-lg font-extrabold text-white">{p.distance}</p>
                    <p className="text-[10px] text-slate-500">Distance</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-amber-400 italic">💡 {p.reason}</p>
              </div>
            </div>
          </MCard>
        </motion.div>
      ))}
    </div>
  );
}

// ── Route Recommendations ────────────────────────────────────────────────────
function RouteRecs() {
  const CROWD_COLORS = { Low: '#00FFB3', Medium: '#F59E0B', High: '#ef4444' };
  return (
    <div className="space-y-3">
      {recommendations.routes.map((r, i) => (
        <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <MCard>
            <div className="flex items-start gap-4">
              <ScoreBadge score={r.score} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/25 px-2.5 py-0.5 text-[11px] font-semibold text-[#00E5FF]">{r.from}</span>
                  <span className="text-slate-600">→</span>
                  <span className="rounded-full bg-[#7B61FF]/10 border border-[#7B61FF]/25 px-2.5 py-0.5 text-[11px] font-semibold text-[#7B61FF]">{r.to}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs mb-3">
                  <span className="text-slate-400">📏 {r.distance}</span>
                  <span className="text-slate-400">⏱️ {r.time}</span>
                  <span className="text-slate-400">🚶 {r.mode}</span>
                  <span style={{ color: CROWD_COLORS[r.crowdLevel] }} className="font-semibold">👥 {r.crowdLevel} crowd</span>
                </div>
                <div className="rounded-xl bg-white/4 border border-white/6 p-3">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1.5">STEP-BY-STEP</p>
                  {r.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2 mb-1">
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#00E5FF]/15 text-[9px] font-bold text-[#00E5FF] mt-0.5">{j + 1}</span>
                      <p className="text-[11px] text-slate-300">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </MCard>
        </motion.div>
      ))}
    </div>
  );
}

// ── Classroom Recommendations ────────────────────────────────────────────────
function ClassroomRecs() {
  return (
    <div className="space-y-3">
      {recommendations.classrooms.map((cr, i) => (
        <motion.div key={cr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <MCard>
            <div className="flex items-start gap-4">
              <ScoreBadge score={cr.score} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-bold text-white">{i === 0 && '⭐ '}{cr.name}</p>
                    <p className="text-[11px] text-slate-400">Capacity: {cr.capacity} seats</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    cr.currentStatus === 'Available' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                  }`}>{cr.currentStatus}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {cr.equipment.map((eq) => (
                    <span key={eq} className="rounded-full bg-[#00E5FF]/8 border border-[#00E5FF]/20 px-2 py-0.5 text-[10px] text-[#00E5FF]">{eq}</span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs mb-2">
                  <span className="text-slate-400">⏰ Next Slot: <span className="text-white font-medium">{cr.nextSlot}</span></span>
                </div>
                <p className="text-[11px] text-amber-400 italic">💡 {cr.reason}</p>
              </div>
            </div>
          </MCard>
        </motion.div>
      ))}
    </div>
  );
}
