// HeroBanner — the big headline card at the top of each dashboard: the campus picture (CampusBackdrop),
// a headline with one gradient phrase, a line of text, quick-link chips, and an optional card on the right.
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import CampusBackdrop from './CampusBackdrop.jsx';

export default function HeroBanner({ eyebrow, title, accent, subtitle, chips = [], aside, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[28px] border"
      style={{ borderColor: 'var(--border-strong)', boxShadow: 'var(--shadow)', minHeight: 300 }}
    >
      <CampusBackdrop position="center 40%" />
      <div className="hero-scrim absolute inset-0" />

      <div className="relative grid gap-6 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="max-w-2xl">
          {eyebrow && <p className="ds-eyebrow mb-3">{eyebrow}</p>}
          <h1 className="font-display text-[34px] font-extrabold leading-[1.08] tracking-tight sm:text-5xl" style={{ color: 'var(--text)' }}>
            {title}
            {accent && <><br /><span className="brand-text">{accent}</span></>}
          </h1>
          {subtitle && <p className="mt-4 max-w-lg text-[15px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{subtitle}</p>}
          {chips.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2.5">
              {chips.map((c) => (
                <Link key={c.label} to={c.to} className="ds-chip">
                  {c.icon && <c.icon size={15} style={{ color: 'var(--brand-text)' }} />} {c.label}
                </Link>
              ))}
            </div>
          )}
          {children}
        </div>
        {aside && <div className="lg:justify-self-end">{aside}</div>}
      </div>
    </motion.section>
  );
}
