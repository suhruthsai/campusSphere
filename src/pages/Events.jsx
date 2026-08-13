import { CalendarDays, Camera, Clock3, Ticket, ArrowRight, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition.jsx';
import MetricCard from '../components/dashboard/MetricCard.jsx';
import { events } from '../data/campus.js';
import { DashboardHeading } from './StudentDashboard.jsx';
import Button from '../components/ui/Button.jsx';

const galleryItems = [
  { label: 'Tech Expo', color: 'from-primary/30 to-secondary/30' },
  { label: 'Sprint',    color: 'from-secondary/30 to-accent/20' },
  { label: 'Fireside',  color: 'from-accent/20 to-primary/25' },
  { label: 'Hackday',   color: 'from-primary/20 to-secondary/35' },
];

export default function Events() {
  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Campus events" title="Discover, register, track engagement & analyze every campus experience." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CalendarDays} label="Upcoming events"   value="24"    meta="Next 30 days"  />
        <MetricCard icon={Ticket}       label="Registrations"     value="1,881" meta="+18% weekly"   tone="secondary" />
        <MetricCard icon={Clock3}       label="Next event starts" value="04:12" meta="Countdown"     tone="accent" />
        <MetricCard icon={Camera}       label="Gallery assets"    value="9.4k"  meta="Tagged by AI"  />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Events list */}
        <section className="glass rounded-2xl p-6">
          <h2 className="section-title mb-5">Upcoming Events</h2>
          <div className="grid gap-3">
            {events.map((event, i) => (
              <motion.article
                key={event.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ x: 4 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card rounded-xl p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-primary tracking-wider uppercase">
                      {event.date} &middot; {event.venue}
                    </span>
                    <h3 className="mt-1.5 font-bold text-white">{event.title}</h3>
                  </div>
                  <Button variant="primary" size="sm">
                    Register <ArrowRight size={11} />
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Users size={11} />
                    {event.registrations} registered
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 font-medium ${
                    event.status === 'Open' ? 'bg-accent/12 text-accent border border-accent/20' : 'bg-secondary/12 text-secondary border border-secondary/20'
                  }`}>
                    {event.status}
                  </span>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Gallery + attendance */}
        <section className="glass rounded-2xl p-6">
          <h2 className="section-title mb-5">Event Gallery</h2>
          <div className="grid grid-cols-2 gap-3">
            {galleryItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.04 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`flex aspect-[4/3] cursor-pointer items-end rounded-xl border border-white/10 bg-gradient-to-br p-3 ${item.color}`}
                style={{ backdropFilter: 'blur(8px)' }}
              >
                <span className="rounded-lg bg-black/40 px-2 py-1 text-xs font-bold text-white backdrop-blur">
                  {item.label}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Attendance projection */}
          <div className="mt-5 glass-card rounded-xl p-5">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Projected attendance</span>
            <strong className="mt-2 block font-display text-3xl font-bold text-white">3,420</strong>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: '78%' }}
                viewport={{ once: true }}
                transition={{ duration: 1.2 }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                style={{ boxShadow: '0 0 14px rgba(0,229,255,0.5)' }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>0</span>
              <span>78% capacity</span>
              <span>4,400</span>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
