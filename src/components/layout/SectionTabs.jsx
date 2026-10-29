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
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</span>
      <div className="inline-flex flex-wrap rounded-xl border border-white/10 bg-white/[0.04] p-1">
        {shown.map((t) => (
          <NavLink key={t.to} to={t.to} end
            className={({ isActive }) => `rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${isActive
              ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'}`}>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
