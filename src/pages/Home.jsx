// Home.jsx — the MVSR digital twin, with a strip of the real campus buildings below it
// (from the database). Clicking a building flies the 3D camera to it.
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import SuhruthDigitalTwin from '../components/three/SuhruthDigitalTwin.jsx';
import PageTransition from '../components/PageTransition.jsx';
import LinkButton from '../components/ui/LinkButton.jsx';
import { buildingsApi, classroomsApi, timetableApi } from '../utils/api.js';
import { istNow, liveSessionsByBuilding } from '../components/three/twinExtras.js';
import { useCampusStore } from '../store/useCampusStore.js';

export default function Home() {
  const [buildings, setBuildings] = useState([]);
  const [live, setLive] = useState({});
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    buildingsApi.list().then(setBuildings).catch(() => setBuildings([]));
    Promise.all([timetableApi.list(), classroomsApi.list()])
      .then(([entries, rooms]) => setLive(liveSessionsByBuilding(entries, rooms, istNow())))
      .catch(() => setLive({}));
  }, []);

  const flyTo = (b) => {
    setSelected(b.id);
    useCampusStore.getState().setAIFlyTarget(b.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
              <span className="ml-2 text-sm font-normal text-slate-400">— click to fly there</span>
            </h2>
            <LinkButton to="/navigation" variant="ghost" size="sm">
              Route finder <ChevronRight size={14} />
            </LinkButton>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {buildings.map((b, i) => (
              <BuildingCard key={b.id} building={b} classesNow={live[b.id]?.length || 0}
                active={selected === b.id} onClick={() => flyTo(b)} delay={i * 0.03} />
            ))}
          </div>
        </div>
      </section>
    </PageTransition>
  );
}

function BuildingCard({ building, classesNow, active, onClick, delay }) {
  const color = building.color || '#00E5FF';
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-xl border p-3 text-left transition-all"
      style={{ background: active ? color + '14' : 'rgba(255,255,255,0.04)', borderColor: active ? color + '55' : 'rgba(255,255,255,0.1)' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {classesNow > 0 && (
          <span className="text-[10px] font-medium" style={{ color }}>{classesNow} class{classesNow === 1 ? '' : 'es'} now</span>
        )}
      </div>
      <p className="text-xs font-bold text-white leading-tight">{building.name}</p>
      <p className="mt-0.5 text-[10px] text-slate-500 truncate">
        {building.type} · {building.floors} floor{building.floors === 1 ? '' : 's'}
      </p>
    </motion.button>
  );
}
