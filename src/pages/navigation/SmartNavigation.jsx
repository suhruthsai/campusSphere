// SmartNavigation.jsx — Module 19 (Smart Navigation)
// Functions: Find Building, Find Classroom, Find Lab, Shortest Path, Accessible Route, Emergency Route

import {
  Accessibility, AlertTriangle, Building2, Compass, DoorOpen,
  FlaskConical, MapPin, Navigation, Search, ShieldAlert, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import MonitoringLayout, { MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { smartNavigationData } from '../../data/navigation.js';

const TABS = ['Find Building', 'Find Classroom', 'Find Lab', 'Shortest Path', 'Accessible Route', 'Emergency Route'];

export default function SmartNavigation() {
  const [tab, setTab]                       = useState('Find Building');
  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedFrom, setSelectedFrom]     = useState('Main Gate');
  const [selectedTo, setSelectedTo]         = useState('CSE Block');
  const [calculatedRoute, setCalculatedRoute] = useState(smartNavigationData.routes[0]);

  const { buildings, classrooms, labs } = smartNavigationData.destinations;

  const handleRouteSearch = (mode = 'Shortest Path') => {
    setCalculatedRoute({
      id: `r-${Date.now()}`,
      from: selectedFrom,
      to: selectedTo,
      mode: mode,
      distance: mode === 'Accessible Route' ? 220 : 180,
      timeMins: mode === 'Accessible Route' ? 3.5 : 2.5,
      steps: mode === 'Emergency Route'
        ? [
            `EMERGENCY ALARM ACTIVE: Exit ${selectedFrom} immediately via green exit doors`,
            `Follow illuminated emergency arrows down stairwell CS-1`,
            `Proceed past Fire Extinguisher Station 3`,
            `Assemble at Main Field Assembly Area Alpha`
          ]
        : mode === 'Accessible Route'
        ? [
            `Start at ${selectedFrom} Ramp Entrance`,
            `Follow smooth barrier-free concrete walkway (120m)`,
            `Use Elevator A in ${selectedTo} to reach target floor`,
            `Sliding door access to target room`
          ]
        : [
            `Start at ${selectedFrom}`,
            `Walk straight 100m on main central pathway`,
            `Turn right near CAD Lab corridor`,
            `Arrive at ${selectedTo} main entrance`
          ]
    });
  };

  return (
    <MonitoringLayout
      title="Smart Navigation System"
      subtitle="Campus-wide destination finder, accessible routing, & emergency evacuation paths"
      icon={<Compass size={22} />}
      accentColor="#00E5FF"
      liveLabel="GPS GPS Active"
      kpis={[
        { label: 'Campus Buildings',  value: buildings.length,   icon: '🏢', unit: '' },
        { label: 'Classrooms Mapped', value: classrooms.length,  icon: '🏫', unit: '' },
        { label: 'Labs Registered',   value: labs.length,        icon: '🔬', unit: '' },
        { label: 'Ramp Access %',     value: 100,                icon: '♿', unit: '%' },
      ]}
    >
      {/* ── Navigation Tab Bar ───────────────────────────────────────────── */}
      <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === 'Accessible Route') handleRouteSearch('Accessible Route');
              if (t === 'Emergency Route')  handleRouteSearch('Emergency Route');
            }}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition ${
              tab === t ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Search Input for Building/Classroom/Lab ─────────────────────── */}
      {['Find Building', 'Find Classroom', 'Find Lab'].includes(tab) && (
        <div className="mb-6">
          <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white">
            <Search size={18} className="text-[#00E5FF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${tab.toLowerCase()} by name, code, or department...`}
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none"
            />
          </div>
        </div>
      )}

      {/* ── Tab Content Rendering ────────────────────────────────────────── */}
      {tab === 'Find Building' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buildings
            .filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.type.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((b) => (
              <MCard key={b.id} accent="#00E5FF">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-white">{b.name}</p>
                    <p className="text-[11px] text-[#00E5FF] font-mono">{b.type} · {b.zone}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{b.floors} Floors</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/10 pt-2">
                  <span>🚨 Exit: <strong className="text-red-400">{b.emergencyExit}</strong></span>
                  <span className="text-emerald-400">♿ Ramp Access</span>
                </div>
              </MCard>
            ))}
        </div>
      )}

      {tab === 'Find Classroom' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms
            .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.building.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((c) => (
              <MCard key={c.id} accent="#7B61FF">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-white">{c.name}</p>
                    <p className="text-[11px] text-slate-400">{c.building} · Floor {c.floor}</p>
                  </div>
                  <span className="rounded-full bg-purple-500/15 text-purple-400 px-2 py-0.5 text-[10px] font-semibold">{c.capacity} Seats</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.equipment.map((eq) => (
                    <span key={eq} className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">{eq}</span>
                  ))}
                </div>
              </MCard>
            ))}
        </div>
      )}

      {tab === 'Find Lab' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {labs
            .filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.building.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((l) => (
              <MCard key={l.id} accent="#00FFB3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-white">{l.name}</p>
                    <p className="text-[11px] text-slate-400">{l.building} · Room {l.room}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">Floor {l.floor}</span>
                </div>
                <p className="mt-2 text-xs font-mono text-[#00FFB3]">💻 {l.GPUs || l.PCs || l.Oscilloscopes || l.Lathes || l['3DPrinters']}</p>
              </MCard>
            ))}
        </div>
      )}

      {['Shortest Path', 'Accessible Route', 'Emergency Route'].includes(tab) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Route Configuration Box */}
          <MCard title="Route Selector" accent={tab === 'Emergency Route' ? '#ef4444' : tab === 'Accessible Route' ? '#00FFB3' : '#00E5FF'}>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Starting Point</label>
                <select
                  value={selectedFrom}
                  onChange={(e) => setSelectedFrom(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#141a22] px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="Main Gate">Main Gate</option>
                  <option value="Canteen">Canteen</option>
                  <option value="CSE Block">CSE Block</option>
                  <option value="Library">Library</option>
                  <option value="Sports Ground">Sports Ground</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destination</label>
                <select
                  value={selectedTo}
                  onChange={(e) => setSelectedTo(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#141a22] px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="CSE Block">CSE Block</option>
                  <option value="ECE Block">ECE Block</option>
                  <option value="Library">Library</option>
                  <option value="Auditorium">Auditorium</option>
                  <option value="R&D Block">R&D Block</option>
                </select>
              </div>

              <button
                onClick={() => handleRouteSearch(tab)}
                className={`w-full rounded-xl py-2.5 text-xs font-bold text-slate-950 transition ${
                  tab === 'Emergency Route'
                    ? 'bg-red-500 hover:bg-red-400 text-white'
                    : tab === 'Accessible Route'
                    ? 'bg-emerald-400 hover:bg-emerald-300'
                    : 'bg-[#00E5FF] hover:bg-[#00cce6]'
                }`}
              >
                Calculate {tab}
              </button>
            </div>
          </MCard>

          {/* Route Steps Display */}
          <div className="lg:col-span-2">
            <MCard title={`${calculatedRoute.mode}: ${calculatedRoute.from} → ${calculatedRoute.to}`} accent={tab === 'Emergency Route' ? '#ef4444' : '#00E5FF'}>
              <div className="flex gap-4 text-xs mb-4 border-b border-white/10 pb-3">
                <span className="text-slate-400">📏 Distance: <strong className="text-white">{calculatedRoute.distance} meters</strong></span>
                <span className="text-slate-400">⏱️ Est. Time: <strong className="text-white">{calculatedRoute.timeMins} mins</strong></span>
              </div>

              <div className="space-y-2">
                {calculatedRoute.steps.map((step, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/4 p-3 text-xs text-slate-200"
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      tab === 'Emergency Route' ? 'bg-red-500/20 text-red-400' : 'bg-[#00E5FF]/20 text-[#00E5FF]'
                    }`}>{idx + 1}</span>
                    <p className="leading-relaxed">{step}</p>
                  </motion.div>
                ))}
              </div>
            </MCard>
          </div>
        </div>
      )}
    </MonitoringLayout>
  );
}
