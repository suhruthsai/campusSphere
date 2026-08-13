import { CalendarPlus, ClipboardList, PieChart, UsersRound, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition.jsx';
import MetricCard from '../components/dashboard/MetricCard.jsx';
import BarChart from '../components/dashboard/BarChart.jsx';
import { DashboardHeading } from './StudentDashboard.jsx';
import { departmentStats } from '../data/campus.js';
import Button from '../components/ui/Button.jsx';

const sections = ['CS-A Neural Systems', 'ME-B Robotics', 'DS-C Studio'];
const actions = ['Mark', 'Review', 'Notify'];

export default function FacultyDashboard() {
  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Faculty operations" title="Manage attendance, student analytics, department health & events." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ClipboardList} label="Pending attendance"  value="2"    meta="Sections today"       />
        <MetricCard icon={UsersRound}   label="Students monitored"  value="428"  meta="AI risk flags: 14"    tone="secondary" />
        <MetricCard icon={CalendarPlus} label="Events created"       value="7"    meta="This month"           tone="accent" />
        <MetricCard icon={PieChart}     label="Department average"   value="86%"  meta="Learning velocity"    />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Attendance */}
        <section className="glass rounded-2xl p-6">
          <h2 className="section-title mb-5">Attendance Management</h2>
          {sections.map((section, i) => (
            <motion.div
              key={section}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="mb-3 glass-card rounded-xl p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-semibold text-white text-sm">{section}</span>
                <span className="font-bold text-primary">{92 - i * 6}%</span>
              </div>
              <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${92 - i * 6}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9 }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {actions.map((action) => (
                  <Button key={action} variant="ghost" size="sm" className="w-full">
                    {action}
                  </Button>
                ))}
              </div>
            </motion.div>
          ))}
        </section>

        {/* Department stats */}
        <section className="glass rounded-2xl p-6">
          <h2 className="section-title mb-5">Department Statistics</h2>
          <BarChart data={departmentStats} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {departmentStats.map((dept) => (
              <motion.article
                key={dept.name}
                whileHover={{ y: -2 }}
                className="glass-card rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <strong className="block text-sm font-bold text-white">{dept.name}</strong>
                  <CheckCircle2 size={14} className="shrink-0 text-accent mt-0.5" />
                </div>
                <span className="mt-1 block text-xs text-slate-400">{dept.students.toLocaleString()} active students</span>
              </motion.article>
            ))}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
