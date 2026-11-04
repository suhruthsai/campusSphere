// Sidebar.jsx — the left navigation for signed-in people. The entries come from navConfig.js (built from
// the person's role); dropdown groups become collapsible sections. Collapses to icons on desktop.
import { Bot, ChevronDown, ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { roleColors } from '../../utils/auth.js';
import BrandMark from '../ui/BrandMark.jsx';

const isHere = (path, to) => path === to;

function SideLink({ item, collapsed, nested = false, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end onClick={onNavigate} title={item.label} aria-label={item.label}
      className={`group flex items-center gap-3 rounded-xl text-[13.5px] font-medium transition ${collapsed ? 'justify-center px-0 py-2.5' : nested ? 'px-3 py-2' : 'px-3 py-2.5'}`}
      style={({ isActive }) => (isActive
        ? { background: 'var(--brand-grad)', color: '#fff', boxShadow: '0 8px 24px rgba(99,102,241,0.32)' }
        : { color: 'var(--text-2)' })}>
      {({ isActive }) => (
        <>
          <Icon size={nested ? 15 : 17} className="shrink-0" style={!isActive && item.color ? { color: item.color } : undefined} />
          {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
          {!collapsed && isActive && <ChevronRight size={15} className="shrink-0 opacity-90" />}
        </>
      )}
    </NavLink>
  );
}

function Group({ group, collapsed, path, onNavigate }) {
  const active = group.items.some((it) => isHere(path, it.to));
  const [open, setOpen] = useState(active);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  const Icon = group.icon;

  if (collapsed) {
    return <div className="space-y-1">{group.items.map((it) => <SideLink key={it.to} item={it} collapsed onNavigate={onNavigate} />)}</div>;
  }
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition hover:bg-[var(--surface-hover)]"
        style={{ color: active ? 'var(--text)' : 'var(--text-2)' }}>
        <Icon size={17} className="shrink-0" />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l pl-2" style={{ borderColor: 'var(--border)' }}>
          {group.items.map((it) => <SideLink key={it.to} item={it} nested collapsed={false} onNavigate={onNavigate} />)}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ navItems, user, collapsed, onToggleCollapse, onNavigate, onLogout, mobile = false }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const rc = roleColors[user?.role] ?? roleColors.student;
  const slim = collapsed && !mobile;

  const askMitra = () => { onNavigate?.(); navigate('/', { state: { openMitra: true } }); };

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--sidebar-bg)', backdropFilter: 'blur(26px) saturate(160%)', borderRight: '1px solid var(--border)' }}>
      {/* Brand + collapse */}
      <div className={`flex items-center ${slim ? 'justify-center px-2' : 'justify-between px-5'} pb-3 pt-5`}>
        <NavLink to="/" onClick={onNavigate} aria-label="CampusSphere home"><BrandMark size={38} wordmark={!slim} /></NavLink>
        {!mobile && !slim && (
          <button type="button" onClick={onToggleCollapse} aria-label="Collapse the sidebar" title="Collapse"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-3)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>
      {slim && (
        <button type="button" onClick={onToggleCollapse} aria-label="Expand the sidebar" title="Expand"
          className="mx-auto mb-1 grid h-8 w-8 place-items-center rounded-lg text-[var(--text-3)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
          <PanelLeftOpen size={17} />
        </button>
      )}

      {/* Navigation */}
      <nav className={`no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto ${slim ? 'px-2' : 'px-3'} py-3`} aria-label="Main">
        {navItems.map((item) => (item.dropdown
          ? <Group key={item.label} group={item} collapsed={slim} path={pathname} onNavigate={onNavigate} />
          : <SideLink key={item.to} item={item} collapsed={slim} onNavigate={onNavigate} />))}
      </nav>

      {/* Mitra */}
      {!slim && (
        <div className="px-3 pb-3">
          <div className="relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: 'var(--border-strong)', background: 'linear-gradient(150deg, color-mix(in srgb, var(--brand-1) 14%, transparent), color-mix(in srgb, var(--brand-2) 16%, transparent))' }}>
            <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-60 blur-2xl" style={{ background: 'var(--brand-grad)' }} />
            <div className="relative flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: 'var(--brand-grad)', boxShadow: '0 6px 20px rgba(99,102,241,0.45)' }}>
                <Bot size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Mitra</p>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--text-2)' }}>Ask anything about the campus</p>
              </div>
            </div>
            <button type="button" onClick={askMitra} className="ds-btn relative mt-3 w-full !py-2 !text-xs">
              <Sparkles size={13} /> Ask Mitra
            </button>
          </div>
        </div>
      )}

      {/* Me */}
      <div className={`border-t ${slim ? 'p-2' : 'p-3'}`} style={{ borderColor: 'var(--border)' }}>
        {slim ? (
          <div className="flex flex-col items-center gap-2">
            <NavLink to="/account" title="My account" onClick={onNavigate} className="grid h-9 w-9 place-items-center rounded-full text-xs font-bold" style={{ background: rc.bg, color: rc.text }}>{user.avatar}</NavLink>
            <button type="button" onClick={onLogout} title="Sign out" aria-label="Sign out" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-3)] transition hover:bg-red-500/10 hover:text-red-500"><LogOut size={15} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <NavLink to="/account" onClick={onNavigate} title="My account · change password"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 transition hover:bg-[var(--surface-hover)]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}>{user.avatar}</span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{user.name}</span>
                <span className="block text-[11px] capitalize" style={{ color: rc.text }}>{user.role}</span>
              </span>
              <ChevronRight size={15} className="ml-auto shrink-0" style={{ color: 'var(--text-3)' }} />
            </NavLink>
            <button type="button" onClick={onLogout} title="Sign out" aria-label="Sign out"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-[var(--text-3)] transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500"
              style={{ borderColor: 'var(--border)' }}>
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
