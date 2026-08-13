// Home.jsx — CampusSphere Command Centre with Suhruth Digital Twin
import { ArrowRight, Building2, ChevronRight, MapPin, Route, Users, Wifi, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import SuhruthDigitalTwin from '../components/three/SuhruthDigitalTwin.jsx';
import PageTransition from '../components/PageTransition.jsx';
import { buildings, stats } from '../data/campus.js';
import { useCounter } from '../hooks/useCounter.js';
import LinkButton from '../components/ui/LinkButton.jsx';

const statIcons = [Building2, Wifi, Users, Zap];

export default function Home() {
  const [selected, setSelected] = useState(buildings[0]);

  return (
    <PageTransition className="relative min-h-screen">
      {/* ── Full 3D Digital Twin Hero Section ──────────────────────────────── */}
      <section className="pt-[76px] px-4 sm:px-6">
        <SuhruthDigitalTwin />
      </section>

      {/* ── Building Selector Strip ────────────────────────────────────────── */}
      <section className="px-4 pb-20 pt-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">
              Campus Buildings
              <span className="ml-2 text-sm font-normal text-slate-400">
                — click to explore data
              </span>
            </h2>
            <LinkButton to="/navigation" variant="ghost" size="sm">
              View Navigation <ChevronRight size={14} />
            </LinkButton>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {buildings.slice(0, 10).map((b, i) => (
              <BuildingCard
                key={b.id}
                building={b}
                active={selected.id === b.id}
                onClick={() => setSelected(b)}
                delay={i * 0.04}
              />
            ))}
          </div>
        </div>
      </section>
    </PageTransition>
  );
}

function BuildingCard({ building, active, onClick, delay }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-xl border p-3 text-left transition-all"
      style={{
        background: active ? (building.color || '#00E5FF') + '14' : 'rgba(255,255,255,0.04)',
        borderColor: active ? (building.color || '#00E5FF') + '55' : 'rgba(255,255,255,0.1)',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: building.color || '#00E5FF' }}
        />
        <span className="text-[10px] font-medium" style={{ color: building.color || '#00E5FF' }}>
          {building.occupancy}%
        </span>
      </div>

      <p className="text-xs font-bold text-white leading-tight">{building.name}</p>
      <p className="mt-0.5 text-[10px] text-slate-500 truncate">{building.type}</p>

      <div className="mt-2 h-0.5 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${building.occupancy}%`, background: building.color || '#00E5FF' }}
        />
      </div>
    </motion.button>
  );
}
