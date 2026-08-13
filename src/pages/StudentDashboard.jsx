import { Bell, BookOpenCheck, CalendarClock, ChartSpline, ClipboardCheck, Trophy, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition.jsx';
import MetricCard from '../components/dashboard/MetricCard.jsx';
import BarChart from '../components/dashboard/BarChart.jsx';
import { timetable } from '../data/campus.js';

const assignments = [
  { name: 'Digital Systems Report', due: 'Tonight', status: 'Draft ready', urgent: true },
  { name: 'AI Ethics Reflection', due: 'Jun 12', status: 'Needs review', urgent: false },
  { name: 'Capstone Prototype', due: 'Jun 18', status: 'On track', urgent: false },
];

export default function StudentDashboard() {
  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Student command center" title="Attendance, timetable, assignments & academic momentum." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ClipboardCheck} label="Attendance this term" value="92%"  meta="+4% vs last month" />
        <MetricCard icon={CalendarClock}  label="Classes today"        value="4"     meta="Next in 42 min"    tone="secondary" />
        <MetricCard icon={BookOpenCheck}  label="Assignments open"     value="3"     meta="1 urgent"          tone="accent" />
        <MetricCard icon={Trophy}         label="Performance index"    value="8.7"   meta="Top 12%"           />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Timetable */}
        <section className="glass rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title">Today&rsquo;s Timetable</h2>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Bell size={16} />
            </span>
          </div>
          <div className="space-y-3">
            {timetable.map((item, i) => (
              <motion.article
                key={item.time}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card rounded-xl p-4 cursor-default"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-primary tracking-wider">{item.time}</span>
                    <h3 className="mt-1 font-bold text-white">{item.course}</h3>
                    <p className="text-xs text-slate-400">{item.room}</p>
                  </div>
                  <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    {item.progress}% ready
                  </span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${item.progress}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9 }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Performance */}
        <section className="glass rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent border border-accent/20">
              <ChartSpline size={15} />
            </span>
            <h2 className="section-title">Academic Performance</h2>
          </div>
          <BarChart
            data={[
              { name: 'AI Systems', occupancy: 94 },
              { name: 'Design Lab', occupancy: 88 },
              { name: 'Research', occupancy: 81 },
              { name: 'Participation', occupancy: 76 },
            ]}
          />
          <div className="mt-6 space-y-2.5">
            {assignments.map((item) => (
              <div
                key={item.name}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition hover:border-white/15 ${
                  item.urgent
                    ? 'border-primary/20 bg-primary/5'
                    : 'border-white/8 bg-white/4'
                }`}
              >
                <span className="font-medium text-white">{item.name}</span>
                <span className="text-xs text-slate-400">{item.due} · {item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}

export function DashboardHeading({ eyebrow, title }) {
  return (
    <div className="mb-8">
      <span className="glow-pill mb-4 inline-flex">{eyebrow}</span>
      <h1 className="mt-3 max-w-4xl font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
        {title}
      </h1>
    </div>
  );
}
