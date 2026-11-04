// TopBar.jsx — page search (jumps to any page in the person's menu), the campus clock, theme switch,
// notices, and — for guests — the Sign in button, always in the top-right corner.
import { Bell, CalendarDays, LogIn, Menu, Search } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import BrandMark from '../ui/BrandMark.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';

const istParts = () => {
  const now = new Date();
  return {
    day: now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' }),
    time: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase(),
  };
};

function CampusClock() {
  const [t, setT] = useState(istParts);
  useEffect(() => { const id = setInterval(() => setT(istParts()), 20000); return () => clearInterval(id); }, []);
  return (
    <span className="hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold md:inline-flex"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }} title="Campus time (India)">
      <CalendarDays size={14} style={{ color: 'var(--brand-text)' }} /> {t.day} · <span style={{ color: 'var(--text)' }}>{t.time}</span>
    </span>
  );
}

/** Search over the pages in the menu (nothing else is searched: it jumps to a page). */
function PageSearch({ items }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const box = useRef(null);

  const flat = useMemo(() => items.flatMap((it) => (it.dropdown ? it.items.map((s) => ({ ...s, group: it.label })) : [{ ...it, group: '' }])), [items]);
  const hits = q.trim() ? flat.filter((it) => `${it.label} ${it.group}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 7) : [];

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const go = (to) => { setQ(''); setOpen(false); navigate(to); };
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && hits[idx]) go(hits[idx].to);
  };

  return (
    <div ref={box} className="relative hidden min-w-0 max-w-md flex-1 sm:block">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        role="combobox" aria-expanded={open && hits.length > 0} aria-label="Search pages"
        placeholder="Search pages and tools…" className="ds-input !rounded-xl !py-2.5 !pl-10 text-sm" />
      {open && q.trim() && (
        <ul className="ds-card absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden p-1.5" style={{ borderRadius: 16, background: 'var(--surface-solid)' }} role="listbox">
          {hits.length === 0 && <li className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-3)' }}>No page matches “{q}”.</li>}
          {hits.map((h, i) => (
            <li key={h.to} role="option" aria-selected={i === idx}>
              <button type="button" onMouseEnter={() => setIdx(i)} onClick={() => go(h.to)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] transition"
                style={{ background: i === idx ? 'var(--surface-hover)' : 'transparent', color: 'var(--text)' }}>
                <h.icon size={15} style={{ color: h.color || 'var(--brand-text)' }} />
                <span className="flex-1 truncate font-medium">{h.label}</span>
                {h.group && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{h.group}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TopBar({ user, navItems, onMenu, onSignIn }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 lg:left-[var(--sw,0px)]" style={{ background: 'var(--topbar-bg)', backdropFilter: 'blur(22px) saturate(160%)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {user && (
          <button type="button" onClick={onMenu} aria-label="Open the menu"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-[var(--text-2)] transition hover:text-[var(--text)] lg:hidden"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <Menu size={18} />
          </button>
        )}
        {!user && (
          <NavLink to="/" aria-label="CampusSphere home" className="mr-auto min-w-0"><BrandMark size={38} sub="MVSR Engineering College" /></NavLink>
        )}
        {user && <PageSearch items={navItems} />}

        <div className="ml-auto flex items-center gap-2.5">
          {user && <CampusClock />}
          <span className="hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold sm:inline-flex"
            style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.10)', color: '#10b981' }}>
            <span className="h-1.5 w-1.5 animate-blink rounded-full bg-emerald-500" style={{ boxShadow: '0 0 6px #10b981' }} /> Live
          </span>
          <ThemeToggle />
          {user && (
            <NavLink to="/notices" aria-label="Notices" title="Notices"
              className="grid h-10 w-10 place-items-center rounded-xl border text-[var(--text-2)] transition hover:text-[var(--text)]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <Bell size={17} />
            </NavLink>
          )}
          {!user && (
            <button type="button" onClick={onSignIn} className="ds-btn !rounded-xl !px-4 !py-2.5 !text-[13px]">
              <LogIn size={15} /> Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
