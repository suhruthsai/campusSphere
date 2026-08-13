// Shell.jsx — Role-aware nav with Monitoring dropdown (fixed position)
import {
  Bot, Brain, Building2, CalendarClock, CalendarDays, ChartNoAxesCombined, ChevronDown,
  ClipboardList, Droplets, FlaskConical, GraduationCap, Home,
  Layers, Lightbulb, LogOut, Map, Menu, MessageCircle, Radio, Users, BookOpen, X, Zap, Car, Wind,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import AIAssistant from '../AIAssistant.jsx';
import Button from '../ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { roleColors } from '../../utils/auth.js';

// ── Monitoring submenu items ──────────────────────────────────────────────────
const MONITORING_ITEMS = [
  { to: '/monitoring/library',     label: 'Library',         icon: BookOpen,      color: '#7B61FF' },
  { to: '/monitoring/crowd',       label: 'Crowd',           icon: Users,         color: '#F472B6' },
  { to: '/monitoring/attendance',  label: 'Attendance',      icon: ClipboardList, color: '#818CF8' },
];

// ── AI submenu items ──────────────────────────────────────────────────────────
const AI_ITEMS = [
  { to: '/ai/predictions',     label: 'Predictions',      icon: Brain,         color: '#00E5FF' },
  { to: '/ai/assistant',       label: 'AI Assistant',     icon: MessageCircle, color: '#7B61FF' },
  { to: '/ai/recommendations', label: 'Recommendations',  icon: Lightbulb,     color: '#F59E0B' },
];

// ── Navigation submenu items ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/navigation/smart',   label: 'Smart Navigation',  icon: Map,    color: '#00E5FF' },
  { to: '/navigation/indoor',  label: 'Indoor Navigation', icon: Layers, color: '#7B61FF' },
];

function getNavItems(role) {
  const common = [
    { to: '/',           label: 'Twin',     icon: Home },
  ];
  if (role === 'admin') return [
    ...common,
    { to: '/admin/dashboard', label: 'Dashboard', icon: ChartNoAxesCombined },
    { to: '/admin/users',     label: 'Users',      icon: Users               },
    { to: '/admin/buildings', label: 'Buildings',  icon: Building2           },
    { to: '/admin/floors',     label: 'Floors',     icon: Layers              },
    { to: '/admin/timetable', label: 'Timetable',  icon: CalendarClock       },
    { to: '/classrooms',      label: 'Classrooms', icon: BookOpen            },
    { to: '/labs',            label: 'Labs',       icon: FlaskConical        },
  ];
  if (role === 'faculty') return [
    ...common,
    { to: '/faculty',    label: 'Faculty',    icon: Users               },
    { to: '/analytics',  label: 'Analytics',  icon: ChartNoAxesCombined },
    { to: '/classrooms', label: 'Classrooms', icon: BookOpen            },
    { to: '/labs',       label: 'Labs',       icon: FlaskConical        },
  ];
  if (role === 'student') return [
    ...common,
    { to: '/student',    label: 'Dashboard',  icon: GraduationCap },
    { to: '/classrooms', label: 'Classrooms', icon: BookOpen      },
    { to: '/labs',       label: 'Labs',       icon: FlaskConical  },
  ];
  return common;
}

// ── Monitoring dropdown (self-contained with click-outside) ───────────────────
function MonitoringDropdown({ isActive }) {
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);
  const btnRef            = useRef(null);
  const location          = useLocation();

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" style={{ position: 'relative', zIndex: 60 }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all select-none ${
          isActive || open
            ? 'bg-[rgba(0,229,255,0.12)] text-[#00E5FF]'
            : 'text-slate-400 hover:bg-white/8 hover:text-white'
        }`}
      >
        <Radio size={14} />
        <span>Monitoring</span>
        <ChevronDown size={11} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: 0,
              width: 220,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(4,9,26,0.97)',
              backdropFilter: 'blur(32px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,229,255,0.06) inset',
              padding: 8,
              zIndex: 9999,
            }}
          >
            {MONITORING_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                style={{ display: 'block', textDecoration: 'none' }}
              >
                {({ isActive: ia }) => (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      marginBottom: 2,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      background: ia ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: ia ? '#fff' : '#94a3b8',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!ia) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}}
                    onMouseLeave={(e) => { if (!ia) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}}
                  >
                    <span style={{
                      display: 'grid', placeItems: 'center',
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: item.color + '1a', color: item.color,
                    }}>
                      <item.icon size={13} />
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {ia && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    )}
                  </div>
                )}
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Generic Nav Dropdown (used for AI, etc.) ──────────────────────────────────
function NavDropdown({ label, icon: Icon, items, isActive }) {
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);
  const btnRef            = useRef(null);
  const location          = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" style={{ position: 'relative', zIndex: 60 }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all select-none ${
          isActive || open
            ? 'bg-[rgba(123,97,255,0.12)] text-[#7B61FF]'
            : 'text-slate-400 hover:bg-white/8 hover:text-white'
        }`}
      >
        <Icon size={14} />
        <span>{label}</span>
        <ChevronDown size={11} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: 0,
              width: 220,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(4,9,26,0.97)',
              backdropFilter: 'blur(32px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(123,97,255,0.06) inset',
              padding: 8,
              zIndex: 9999,
            }}
          >
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                style={{ display: 'block', textDecoration: 'none' }}
              >
                {({ isActive: ia }) => (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 10, marginBottom: 2,
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      background: ia ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: ia ? '#fff' : '#94a3b8', transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!ia) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}}
                    onMouseLeave={(e) => { if (!ia) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}}
                  >
                    <span style={{
                      display: 'grid', placeItems: 'center',
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: item.color + '1a', color: item.color,
                    }}>
                      <item.icon size={13} />
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {ia && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    )}
                  </div>
                )}
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Shell ────────────────────────────────────────────────────────────────
export default function Shell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout }            = useAuth();
  const navigate                    = useNavigate();
  const location                    = useLocation();
  const navItems                    = getNavItems(user?.role);
  const rc                          = user ? (roleColors[user.role] ?? roleColors.student) : null;
  const isMonitorActive             = location.pathname.startsWith('/monitoring');
  const isAIActive                   = location.pathname.startsWith('/ai');

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen overflow-hidden text-white"
         style={{ background: 'linear-gradient(160deg,#010408 0%,#04091a 35%,#020812 65%,#010408 100%)' }}>
      {/* Aurora blobs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full opacity-30 animate-aurora"
             style={{ background: 'radial-gradient(circle,rgba(0,229,255,0.28) 0%,transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute top-10 right-0 h-[500px] w-[500px] rounded-full opacity-25"
             style={{ background: 'radial-gradient(circle,rgba(123,97,255,0.32) 0%,transparent 70%)', filter: 'blur(60px)', animation: 'aurora 16s ease-in-out infinite reverse' }} />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle,rgba(0,255,179,0.22) 0%,transparent 70%)', filter: 'blur(60px)', animation: 'aurora 20s ease-in-out infinite' }} />
      </div>
      <ParticleField />

      {/* ── Header ────────────────────────────────────────────────── */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, padding: '16px 24px 0' }}>
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          maxWidth: 1280, margin: '0 auto',
          borderRadius: 16, padding: '10px 16px',
          background: 'linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04) 60%,rgba(0,229,255,0.04))',
          border: '1px solid rgba(255,255,255,0.13)',
          backdropFilter: 'blur(28px) saturate(160%)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
          overflow: 'visible',   /* ← KEY: must not clip dropdown */
        }}>
          {/* Logo */}
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <span style={{
              display: 'grid', placeItems: 'center', width: 40, height: 40,
              borderRadius: 12, background: 'rgba(0,229,255,0.1)',
              border: '1px solid rgba(0,229,255,0.2)', color: '#00E5FF', flexShrink: 0,
            }}>
              <Bot size={20} />
            </span>
            <span className="hidden sm:block">
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>CampusSphere</span>
              <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>Digital Twin Command</span>
            </span>
          </NavLink>

          {/* Desktop nav links */}
          <div className="hidden lg:flex" style={{ alignItems: 'center', gap: 2, flexWrap: 'nowrap' }}>
            {navItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
            {/* Navigation dropdown */}
            <NavDropdown label="Navigation" icon={Map} items={NAV_ITEMS} isActive={location.pathname.startsWith('/navigation')} />
            {/* Monitoring dropdown */}
            <MonitoringDropdown isActive={isMonitorActive} />
            {/* AI dropdown */}
            <NavDropdown label="AI" icon={Brain} items={AI_ITEMS} isActive={isAIActive} />
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Live badge */}
            <span className="hidden md:inline-flex" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10, fontWeight: 600, color: '#00FFB3',
              background: 'rgba(0,255,179,0.08)', border: '1px solid rgba(0,255,179,0.2)',
              borderRadius: 99, padding: '4px 10px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00FFB3', boxShadow: '0 0 6px #00FFB3', animation: 'blink 2s ease-in-out infinite' }} />
              Live
            </span>

            {/* User info */}
            {user && (
              <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', padding: '6px 12px',
                }}>
                  <span style={{
                    display: 'grid', placeItems: 'center', width: 24, height: 24,
                    borderRadius: '50%', fontSize: 11, fontWeight: 700,
                    background: rc?.bg, color: rc?.text,
                  }}>{user.avatar}</span>
                  <div style={{ lineHeight: 1.3 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.name.split(' ')[0]}
                    </p>
                    <p style={{ fontSize: 10, color: rc?.text, margin: 0, textTransform: 'capitalize' }}>{user.role}</p>
                  </div>
                </div>
                <button onClick={handleLogout} title="Logout" style={{
                  display: 'grid', placeItems: 'center', width: 32, height: 32,
                  borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: '#64748b', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                  <LogOut size={14} />
                </button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              style={{
                display: 'grid', placeItems: 'center', width: 36, height: 36,
                borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer',
              }}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* ── Mobile dropdown ─────────────────────────────── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0  }}
              exit={{ opacity: 0, y: -10   }}
              transition={{ duration: 0.2  }}
              style={{
                maxWidth: 1280, margin: '12px auto 0',
                borderRadius: 16, padding: 12,
                background: 'rgba(4,9,26,0.96)',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(28px)',
                maxHeight: '80vh', overflowY: 'auto',
              }}
            >
              {/* Core items */}
              <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
                {navItems.map((item) => (
                  <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />
                ))}
              </div>

              {/* Monitoring section */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 4 }}>
                <p style={{ padding: '4px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', margin: '0 0 4px' }}>
                  Monitoring &amp; IoT
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {MONITORING_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      style={{ textDecoration: 'none' }}
                    >
                      {({ isActive }) => (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                          background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                          color: isActive ? '#fff' : '#94a3b8',
                        }}>
                          <span style={{
                            display: 'grid', placeItems: 'center', width: 20, height: 20,
                            borderRadius: 6, background: item.color + '1a', color: item.color, flexShrink: 0,
                          }}>
                            <item.icon size={11} />
                          </span>
                          {item.label}
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* AI section */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 4 }}>
                <p style={{ padding: '4px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', margin: '0 0 4px' }}>
                  AI Intelligence
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {AI_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      style={{ textDecoration: 'none' }}
                    >
                      {({ isActive }) => (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                          background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                          color: isActive ? '#fff' : '#94a3b8',
                        }}>
                          <span style={{
                            display: 'grid', placeItems: 'center', width: 20, height: 20,
                            borderRadius: 6, background: item.color + '1a', color: item.color, flexShrink: 0,
                          }}>
                            <item.icon size={11} />
                          </span>
                          {item.label}
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* User / logout */}
              {user && (
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8, paddingTop: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'grid', placeItems: 'center', width: 28, height: 28,
                      borderRadius: '50%', fontSize: 11, fontWeight: 700,
                      background: rc?.bg, color: rc?.text,
                    }}>{user.avatar}</span>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: 0 }}>{user.name}</p>
                      <p style={{ fontSize: 10, color: rc?.text, margin: 0, textTransform: 'capitalize' }}>{user.role}</p>
                    </div>
                  </div>
                  <button onClick={handleLogout} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                    color: '#ef4444', cursor: 'pointer',
                  }}>
                    <LogOut size={12} /> Logout
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="relative z-10">{children}</main>
      <AIAssistant />

      <footer className="relative z-10 border-t border-white/[0.07] px-5 py-10 text-center">
        <p className="text-xs text-slate-500 tracking-wider uppercase">
          CampusSphere — Suhruth University · Intelligent campus orchestration
        </p>
      </footer>
    </div>
  );
}

function NavItem({ to, label, icon: Icon, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      style={{ textDecoration: 'none' }}
    >
      {({ isActive }) => (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 500,
          background: isActive ? 'rgba(0,229,255,0.10)' : 'transparent',
          color: isActive ? '#00E5FF' : '#94a3b8',
          cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}
          onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}}
          onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}}
        >
          <Icon size={14} />
          {label}
        </div>
      )}
    </NavLink>
  );
}

function ParticleField() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 opacity-60">
      {Array.from({ length: 48 }).map((_, i) => (
        <span key={i} className="absolute rounded-full" style={{
          width: i % 4 === 0 ? '3px' : '2px', height: i % 4 === 0 ? '3px' : '2px',
          left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 100}%`,
          background: i % 3 === 0 ? '#00E5FF' : i % 3 === 1 ? '#7B61FF' : '#00FFB3',
          boxShadow: i % 3 === 0 ? '0 0 10px rgba(0,229,255,0.8)' : i % 3 === 1 ? '0 0 8px rgba(123,97,255,0.8)' : '0 0 8px rgba(0,255,179,0.8)',
          animation: `float ${5 + (i % 8)}s ease-in-out ${i * 0.11}s infinite`,
          opacity: 0.4 + (i % 4) * 0.15,
        }} />
      ))}
    </div>
  );
}
