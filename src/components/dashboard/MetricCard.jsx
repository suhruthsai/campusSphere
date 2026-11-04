// MetricCard — a KPI tile: tinted glass, icon chip, big value, label, small status pill.
// `progress` (0..1) adds a thin bar for tiles that are a real ratio. Tones: primary (blue), secondary (violet), accent (green), warm (amber).
import { motion } from 'framer-motion';

const TONES = {
  primary:   { a: '#38bdf8', b: '#3b82f6' },
  secondary: { a: '#a78bfa', b: '#8b5cf6' },
  accent:    { a: '#34d399', b: '#10b981' },
  warm:      { a: '#fbbf24', b: '#f59e0b' },
};

export default function MetricCard({ label, value, meta, icon: Icon, tone = 'primary', progress }) {
  const t = TONES[tone] || TONES.primary;
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="ds-card ds-card-hover relative overflow-hidden p-5"
      style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${t.a} 17%, var(--surface-solid)) 0%, var(--surface) 70%)`, borderColor: `color-mix(in srgb, ${t.a} 28%, var(--border))` }}
    >
      <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-40 blur-2xl" style={{ background: t.a }} />
      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl text-white"
            style={{ background: `linear-gradient(135deg, ${t.a}, ${t.b})`, boxShadow: `0 8px 22px color-mix(in srgb, ${t.b} 45%, transparent)` }}>
            {Icon && <Icon size={21} />}
          </span>
          {meta ? (
            <span className="max-w-[62%] rounded-2xl border px-3 py-1 text-right text-[11px] font-semibold leading-snug"
              style={{ borderColor: `color-mix(in srgb, ${t.a} 35%, var(--border))`, background: `color-mix(in srgb, ${t.a} 12%, transparent)`, color: 'var(--text-2)' }} title={meta}>
              {meta}
            </span>
          ) : null}
        </div>
        <strong className="block font-display text-[32px] font-extrabold leading-none tracking-tight" style={{ color: 'var(--text)' }}>{value}</strong>
        <span className="mt-2 block text-sm font-medium" style={{ color: 'var(--text-2)' }}>{label}</span>
        {typeof progress === 'number' && (
          <span className="mt-4 block h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
            <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, background: `linear-gradient(90deg, ${t.a}, ${t.b})` }} />
          </span>
        )}
      </div>
    </motion.article>
  );
}
