// BrandMark — the CampusSphere logo: a gradient tile with the campus icon, and the wordmark
import { Building2 } from 'lucide-react';

export default function BrandMark({ size = 40, wordmark = true, sub, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className="grid shrink-0 place-items-center rounded-xl text-white"
        style={{ width: size, height: size, background: 'var(--brand-grad)', boxShadow: '0 6px 22px rgba(99,102,241,0.45)' }}>
        <Building2 size={Math.round(size * 0.55)} strokeWidth={2.1} />
      </span>
      {wordmark && (
        <span className="min-w-0 leading-tight">
          <span className="block font-display text-[17px] font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
            Campus<span className="brand-text">Sphere</span>
          </span>
          {sub && <span className="block truncate text-[11px]" style={{ color: 'var(--text-3)' }}>{sub}</span>}
        </span>
      )}
    </span>
  );
}
