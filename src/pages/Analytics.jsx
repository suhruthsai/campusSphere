import { Activity, Gauge, MapPinned, RadioTower, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition.jsx';
import MetricCard from '../components/dashboard/MetricCard.jsx';
import BarChart from '../components/dashboard/BarChart.jsx';
import { buildings, departmentStats } from '../data/campus.js';
import { DashboardHeading } from './StudentDashboard.jsx';

export default function Analytics() {
  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Live campus intelligence" title="Occupancy, movement patterns, department signals & operational insights." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={RadioTower} label="Sensors online"        value="1,280" meta="99.98% uptime"    />
        <MetricCard icon={Activity}   label="Student activity"      value="18.4k" meta="Live pings today"  tone="secondary" />
        <MetricCard icon={Gauge}      label="Average occupancy"     value="74%"   meta="Balanced load"     tone="accent" />
        <MetricCard icon={MapPinned}  label="Active route requests" value="312"   meta="Last 15 min"       />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Occupancy chart */}
        <section className="glass rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <TrendingUp size={15} />
            </span>
            <h2 className="section-title">Building Occupancy</h2>
          </div>
          <BarChart data={buildings.map((b) => ({ name: b.name, occupancy: b.occupancy }))} />
        </section>

        {/* Heatmap */}
        <section className="glass rounded-2xl p-6">
          <h2 className="section-title mb-5">Campus Heatmap</h2>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 49 }).map((_, i) => {
              const heat = 15 + ((i * 17) % 82);
              const alpha1 = heat / 130;
              const alpha2 = heat / 110;
              return (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.2, zIndex: 10 }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.012, duration: 0.3 }}
                  className="aspect-square cursor-pointer rounded-lg border border-white/8 transition"
                  style={{
                    background: `linear-gradient(135deg, rgba(0,229,255,${alpha1}), rgba(123,97,255,${alpha2}))`,
                    boxShadow: heat > 70 ? `0 0 14px rgba(0,229,255,${alpha1 * 0.8})` : 'none',
                  }}
                  title={`${heat}% activity`}
                />
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Low activity</span>
            <div className="h-1.5 w-32 rounded-full bg-gradient-to-r from-primary/20 via-secondary/40 to-primary/80" />
            <span>High activity</span>
          </div>
        </section>
      </div>

      {/* Department performance */}
      <section className="glass mt-5 rounded-2xl p-6">
        <h2 className="section-title mb-5">Department-wise Performance</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {departmentStats.map((dept, i) => (
            <motion.article
              key={dept.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card rounded-xl p-5"
            >
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{dept.name}</span>
              <strong className="mt-3 block font-display text-3xl font-bold text-white">{dept.occupancy}%</strong>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${dept.occupancy}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className={`h-full rounded-full bg-gradient-to-r ${
                    i % 3 === 0 ? 'from-primary to-cyan-400' : i % 3 === 1 ? 'from-secondary to-violet-400' : 'from-accent to-emerald-400'
                  }`}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">Learning spaces tuned for demand.</p>
            </motion.article>
          ))}
        </div>
      </section>
    </PageTransition>
  );
}
