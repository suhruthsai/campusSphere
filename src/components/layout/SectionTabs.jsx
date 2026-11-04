// SectionTabs.jsx — joins related pages into one place with tabs: "Find a place" (route finder, campus
// directory, inside a building) and "Rooms" (classrooms, labs, floors). Each tab is still its own page and link.
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export const FIND_TABS = [
  { to: '/navigation',        label: 'Route finder' },
  { to: '/navigation/smart',  label: 'Campus directory' },
  { to: '/navigation/indoor', label: 'Inside a building' },
];

export const ROOM_TABS = [
  { to: '/classrooms',   label: 'Classrooms' },
  { to: '/labs',         label: 'Labs' },
  { to: '/admin/floors', label: 'Floors', roles: ['admin'] },
];

export default function SectionTabs({ title, tabs }) {
  const { user } = useAuth();
  const shown = tabs.filter((t) => !t.roles || t.roles.includes(user?.role));
  return (
    <nav aria-label={title} className="mb-6 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{title}</span>
      <div className="inline-flex flex-wrap rounded-2xl border p-1" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
        {shown.map((t) => (
          <NavLink key={t.to} to={t.to} end
            style={({ isActive }) => (isActive
              ? { background: 'var(--brand-grad)', color: '#fff', boxShadow: '0 6px 18px rgba(99,102,241,0.32)' }
              : { color: 'var(--text-2)' })}
            className="rounded-xl px-3.5 py-1.5 text-sm font-semibold transition">
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
