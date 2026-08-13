// MonitoringLayout.jsx — Shared wrapper for all monitoring/IoT pages
import { motion } from 'framer-motion';
import PageTransition from '../PageTransition.jsx';

/**
 * @param {string}  title
 * @param {string}  subtitle
 * @param {React.ReactNode} icon
 * @param {string}  accentColor
 * @param {React.ReactNode} children
 * @param {Array}   kpis — [{ label, value, unit, icon, delta }]
 * @param {string}  liveLabel
 */
export default function MonitoringLayout({ title, subtitle, icon, accentColor = '#00E5FF', kpis = [], liveLabel, children }) {
  return (
    <PageTransition className="min-h-screen px-4 pb-20 pt-28 sm:px-6">
      <div className="mx-auto max-w-7xl">

        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
                    className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
              <span style={{ color: accentColor }}>{icon}</span>
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>
          </div>
          {liveLabel && (
            <span className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold"
                  style={{ background: accentColor + '12', borderColor: accentColor + '30', color: accentColor }}>
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: accentColor }} />
              {liveLabel}
            </span>
          )}
        </motion.div>

        {/* KPI strip */}
        {kpis.length > 0 && (
          <div className={`mb-6 grid gap-3 grid-cols-2 sm:grid-cols-${Math.min(kpis.length, 4)} lg:grid-cols-${Math.min(kpis.length, 6)}`}>
            {kpis.map((k, i) => (
              <motion.div key={k.label}
                          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}
                          className="rounded-2xl border border-white/8 p-4"
                          style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-start justify-between mb-1">
                  <span className="text-lg">{k.icon}</span>
                  {k.delta !== undefined && (
                    <span className={`text-[10px] font-semibold ${k.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {k.delta >= 0 ? '▲' : '▼'} {Math.abs(k.delta)}%
                    </span>
                  )}
                </div>
                <p className="font-display text-xl font-extrabold text-white">
                  {k.value}<span className="text-sm font-medium text-slate-400 ml-1">{k.unit}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{k.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {children}
      </div>
    </PageTransition>
  );
}

// ── Shared glass card ────────────────────────────────────────────────────────
export function MCard({ title, className = '', children, accent }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                className={`rounded-2xl border border-white/8 p-5 ${className}`}
                style={{ background: 'rgba(4,9,26,0.75)', backdropFilter: 'blur(16px)' }}>
      {title && (
        <p className="mb-4 text-xs font-bold uppercase tracking-wider"
           style={{ color: accent || '#94a3b8' }}>
          {title}
        </p>
      )}
      {children}
    </motion.div>
  );
}

// ── Horizontal bar ───────────────────────────────────────────────────────────
export function HBar({ label, value, max, color, unit = '' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400 truncate max-w-[55%]">{label}</span>
        <span className="font-semibold text-white">{value.toLocaleString()}{unit} <span className="text-slate-500 font-normal">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full" style={{ background: color }} />
      </div>
    </div>
  );
}

// ── Donut ring ───────────────────────────────────────────────────────────────
export function DonutRing({ value, max, color, label, size = 96 }) {
  const pct   = Math.min(100, (value / max) * 100);
  const r     = (size - 12) / 2;
  const circ  = 2 * Math.PI * r;
  const dash  = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={10} fill="none" />
        <motion.circle cx={size/2} cy={size/2} r={r}
                       stroke={color} strokeWidth={10} fill="none" strokeLinecap="round"
                       strokeDasharray={circ} strokeDashoffset={circ}
                       animate={{ strokeDashoffset: circ - dash }}
                       transition={{ duration: 1, ease: 'easeOut' }} />
      </svg>
      <p className="font-display text-sm font-bold text-white" style={{ marginTop: -size * 0.72 + 'px' }}>
        {Math.round(pct)}%
      </p>
      <p className="text-[10px] text-slate-500 mt-12">{label}</p>
    </div>
  );
}

// ── Alert pill ───────────────────────────────────────────────────────────────
export function AlertPill({ level, message, sub }) {
  const styles = {
    critical: { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.25)', text: '#ef4444', dot: '#ef4444' },
    warning:  { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', text: '#F59E0B', dot: '#F59E0B' },
    info:     { bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.25)', text: '#38BDF8', dot: '#38BDF8' },
    success:  { bg: 'rgba(0,255,179,0.10)', border: 'rgba(0,255,179,0.25)', text: '#00FFB3', dot: '#00FFB3' },
  };
  const s = styles[level] || styles.info;
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3 mb-2"
         style={{ background: s.bg, borderColor: s.border }}>
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: s.dot }} />
      <div>
        <p className="text-xs text-slate-200 leading-relaxed">{message}</p>
        {sub && <p className="text-[10px] mt-0.5 text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}
