// Pieces the three dashboards share: the campus-clock greeting, the quick-actions grid and the "Explore in 3D" card.
import { ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import CampusBackdrop from '../ui/CampusBackdrop.jsx';
import Panel from '../ui/Panel.jsx';

/** Morning / afternoon / evening by the campus clock (IST). */
export function greeting() {
  const h = Number(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const firstNameOf = (user) => (user?.name || '').replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').split(' ')[0];

/** items: [{ label, icon, to, color }] */
export function QuickActions({ items, delay = 0.3, className = '' }) {
  return (
    <Panel title="Quick actions" icon={Zap} iconColor="#fb923c" delay={delay} className={className}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((qa) => (
          <Link key={qa.label} to={qa.to} className="ds-card-hover flex items-center gap-3 rounded-2xl border p-3.5 transition"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${qa.color} 18%, transparent)`, color: qa.color }}>
              <qa.icon size={18} />
            </span>
            <span className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>{qa.label}</span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export function ExploreCard({ className = '' }) {
  return (
    <Link to="/" className={`ds-card ds-card-hover group relative block min-h-[200px] overflow-hidden ${className}`} aria-label="Explore the campus in 3D">
      <CampusBackdrop position="center 60%" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, color-mix(in srgb, var(--bg) 92%, transparent) 0%, color-mix(in srgb, var(--bg) 25%, transparent) 70%, transparent 100%)' }} />
      <div className="relative flex h-full min-h-[200px] items-end justify-between gap-4 p-5">
        <div>
          <p className="font-display text-xl font-extrabold" style={{ color: 'var(--text)' }}>Explore in 3D</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-2)' }}>Walk the interactive campus model and its facilities.</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition group-hover:translate-x-1" style={{ background: 'var(--brand-grad)', boxShadow: '0 8px 24px rgba(99,102,241,0.45)' }}>
          <ArrowRight size={19} />
        </span>
      </div>
    </Link>
  );
}
