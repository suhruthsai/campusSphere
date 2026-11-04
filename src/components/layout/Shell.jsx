// Shell.jsx — the frame around every page: a left sidebar (the role's menus from navConfig.js, built from
// GET /auth/me/roles) and a top bar. Guests (the open campus at "/") get the slim top bar with Sign in.
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { authApi } from '../../utils/api.js';
import { getNavItems } from './navConfig.js';
import LoginModal from '../auth/LoginModal.jsx';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';

const SIDEBAR_KEY = 'campussphere_sidebar';
const WIDE = '268px';
const SLIM = '76px';

export default function Shell({ children }) {
  const { user, logout }            = useAuth();
  const navigate                    = useNavigate();
  const location                    = useLocation();
  const [roles, setRoles]           = useState(null);   // HOD, Principal, CoE, desks... (null while loading)
  const [collapsed, setCollapsed]   = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'collapsed'; } catch { return false; }
  });
  const [drawer, setDrawer]         = useState(false);  // the sidebar as a drawer on phones
  const [signInOpen, setSignInOpen] = useState(false);  // the sign-in overlay (guests, top-right button)
  // A guest has no menus: just the campus and the Sign in button
  const navItems                    = user ? getNavItems(user.role, roles) : [];

  // What this person holds decides which desks appear; refreshed on each page change (a new desk shows at once)
  useEffect(() => {
    if (!user) { setRoles(null); return; }
    authApi.roles().then(setRoles).catch(() => setRoles(null));
  }, [user?.id, user?.role, location.pathname]);

  useEffect(() => { setDrawer(false); }, [location.pathname]);

  const toggleCollapse = () => setCollapsed((c) => {
    const next = !c;
    try { localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'wide'); } catch { /* not remembered */ }
    return next;
  });

  // Signing out lands back on the open campus, not a login wall
  const handleLogout = () => { logout(); navigate('/'); };

  const sw = user ? (collapsed ? SLIM : WIDE) : '0px';

  return (
    <div className="min-h-screen" style={{ '--sw': sw, color: 'var(--text)' }}>
      {user && (
        <aside className="fixed inset-y-0 left-0 z-50 hidden transition-[width] duration-200 lg:block" style={{ width: 'var(--sw)' }}>
          <Sidebar navItems={navItems} user={user} collapsed={collapsed} onToggleCollapse={toggleCollapse} onLogout={handleLogout} />
        </aside>
      )}

      <AnimatePresence>
        {user && drawer && (
          <>
            <motion.div key="scrim" className="fixed inset-0 z-[60] backdrop-blur-sm lg:hidden" style={{ background: 'color-mix(in srgb, var(--bg) 60%, transparent)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside key="drawer" className="fixed inset-y-0 left-0 z-[70] w-[284px] max-w-[86vw] lg:hidden"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
              <Sidebar mobile navItems={navItems} user={user} collapsed={false} onNavigate={() => setDrawer(false)} onLogout={handleLogout} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <TopBar user={user} navItems={navItems} onMenu={() => setDrawer(true)} onSignIn={() => setSignInOpen(true)} />

      <div className="transition-[padding] duration-200 lg:pl-[var(--sw)]">
        {/* No z-index here: popups opened inside a page must be able to rise above the sidebar and top bar */}
        <main className="relative">{children}</main>

        <footer className="relative z-10 border-t px-5 py-8 text-center" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            CampusSphere — MVSR Engineering College
          </p>
        </footer>
      </div>

      <LoginModal open={signInOpen && !user} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
