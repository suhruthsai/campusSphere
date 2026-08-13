import { motion } from 'framer-motion';

export default function MetricCard({ label, value, meta, icon: Icon, tone = 'primary' }) {
  const config = {
    primary:   { icon: 'text-primary bg-primary/12 border-primary/20',   glow: 'metric-glow-primary',   bar: 'from-primary to-cyan-400',    ring: 'rgba(0,229,255,0.2)' },
    secondary: { icon: 'text-secondary bg-secondary/12 border-secondary/20', glow: 'metric-glow-secondary', bar: 'from-secondary to-violet-400', ring: 'rgba(123,97,255,0.2)' },
    accent:    { icon: 'text-accent bg-accent/12 border-accent/20',       glow: 'metric-glow-accent',    bar: 'from-accent to-emerald-400',  ring: 'rgba(0,255,179,0.2)' },
  }[tone];

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: [0.4,0,0.2,1] }}
      className={`glass-card rounded-2xl p-5 ${config.glow} relative overflow-hidden`}
    >
      {/* Shimmer sweep */}
      <div className="animate-shimmer pointer-events-none absolute inset-0 rounded-2xl" />

      <div className="relative">
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className={`grid h-12 w-12 place-items-center rounded-xl border ${config.icon} transition-all`}>
            {Icon && <Icon size={20} />}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-400 backdrop-blur">
            {meta}
          </span>
        </div>
        <strong className="block font-display text-3xl font-bold tracking-tight text-white">{value}</strong>
        <span className="mt-1.5 block text-sm text-slate-400">{label}</span>

        {/* Bottom accent line */}
        <div className={`mt-4 h-[2px] w-full rounded-full bg-gradient-to-r ${config.bar} opacity-50`} />
      </div>
    </motion.article>
  );
}
