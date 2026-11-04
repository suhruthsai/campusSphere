// Panel — a titled dashboard card: title (with icon) on the left, an optional "see all" link on the right
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Panel({ title, icon: Icon, iconColor, action, to, badge, children, className = '', delay = 0, bodyClass = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`ds-card flex flex-col p-5 ${className}`}
    >
      <header className="mb-4 flex items-center gap-2.5">
        {Icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${iconColor || 'var(--brand-1)'} 16%, transparent)`, color: iconColor || 'var(--brand-text)' }}>
            <Icon size={16} />
          </span>
        )}
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold" style={{ color: 'var(--text)' }}>{title}</h2>
        {badge}
        {to && (
          <Link to={to} className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold transition hover:underline" style={{ color: 'var(--brand-text)' }}>
            {action || 'View all'} <ChevronRight size={14} />
          </Link>
        )}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </motion.section>
  );
}

/** A quiet one-line message inside a Panel (loading, empty). */
export function PanelNote({ children }) {
  return <p className="rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>{children}</p>;
}
