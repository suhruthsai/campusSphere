import { Building2, Compass, Layers3, LocateFixed, Search, Navigation2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition.jsx';
import { buildings, locations } from '../data/campus.js';
import Button from '../components/ui/Button.jsx';

export default function Navigation() {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('Main Gate');
  const results = useMemo(
    () => locations.filter((l) => l.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <div className="mb-8">
        <span className="glow-pill mb-4 inline-flex">
          <Navigation2 size={11} />
          Smart route finder
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Search, route & explore every campus destination.
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Search panel */}
        <section className="glass rounded-2xl p-6">
          <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-slate-400">
            Find classroom, lab, library, canteen, or office
          </label>

          {/* Search input */}
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/6 px-4 py-3 transition focus-within:border-primary/40 focus-within:bg-white/8">
            <Search className="shrink-0 text-primary" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try AI Lab 402…"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          {/* Results */}
          <div className="mt-3 grid gap-1.5">
            {(query ? results : locations).slice(0, 7).map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full justify-between"
                  onClick={() => {}}
                >
                  <span>{item}</span>
                  <LocateFixed size={14} className="text-accent opacity-70" />
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Route controls */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-primary/30 transition backdrop-blur"
            >
              <option>Main Gate</option>
              <option>Student Parking</option>
              <option>Metro Bridge</option>
            </select>
            <Button variant="primary" size="md" className="w-full sm:w-auto">
              Generate route
            </Button>
          </div>
        </section>

        {/* Map panel */}
        <section className="scene-grid glass relative min-h-[34rem] overflow-hidden rounded-2xl p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/12 pointer-events-none" />

          <div className="relative grid h-full gap-3 sm:grid-cols-2">
            {buildings.map((building, i) => (
              <motion.article
                key={building.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="glass-dark cursor-pointer rounded-xl p-4 transition hover:border-primary/35"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/18">
                    <Building2 size={16} />
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    building.occupancy > 75 ? 'bg-accent/12 text-accent' : 'bg-primary/12 text-primary'
                  }`}>
                    {building.occupancy}% live
                  </span>
                </div>
                <h2 className="font-bold text-white text-sm">{building.name}</h2>
                <p className="mt-0.5 text-xs text-slate-400 truncate">{building.departments.join(' / ')}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${building.occupancy}%` }}
                  />
                </div>
              </motion.article>
            ))}
          </div>

          {/* Route badge */}
          <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3.5 py-2 text-sm text-slate-300 backdrop-blur">
            <Compass className="text-primary" size={15} />
            {from} → destination: <span className="font-bold text-white">4 min indoor</span>
          </div>

          {/* Layers btn */}
          <div className="absolute right-5 top-5">
            <Button variant="icon" size="md" aria-label="Map layers">
              <Layers3 size={16} />
            </Button>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
