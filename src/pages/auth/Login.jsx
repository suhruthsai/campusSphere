// Login.jsx — the full-page sign-in, for links that need an account (e.g. /services) and old bookmarks.
// The front door is the public campus at "/", where the same form opens as an overlay.
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginCard from '../../components/auth/LoginCard.jsx';
import BrandMark from '../../components/ui/BrandMark.jsx';
import CampusBackdrop from '../../components/ui/CampusBackdrop.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const from = location.state?.from?.pathname || '/';
  const notice = location.state?.notice;

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* The campus, softly out of focus behind everything */}
      <div className="absolute inset-0" style={{ filter: 'blur(3px) saturate(1.15)', transform: 'scale(1.04)' }}>
        <CampusBackdrop />
      </div>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, color-mix(in srgb, var(--bg) 88%, transparent) 0%, color-mix(in srgb, var(--bg) 55%, transparent) 55%, color-mix(in srgb, var(--bg) 30%, transparent) 100%)' }} />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10">
        <span className="hidden lg:inline-flex"><BrandMark size={38} sub="MVSR Engineering College" /></span>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs sm:block" style={{ color: 'var(--text-2)' }}>
            New here? Students: ask your class in-charge · Staff: the Admin Office
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-5 pb-12 pt-4 sm:px-10 lg:min-h-[calc(100vh-96px)] lg:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block"
        >
          <p className="ds-eyebrow mb-4">MVSR Engineering College · Digital Twin</p>
          <h2 className="max-w-xl font-display text-5xl font-extrabold leading-[1.08] tracking-tight xl:text-6xl" style={{ color: 'var(--text)' }}>
            A smarter campus for a <span className="brand-text">brighter tomorrow.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed" style={{ color: 'var(--text-2)' }}>
            Your timetable, requests and campus map in one place. Real-time and always up to date.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[440px]"
        >
          <LoginCard notice={notice} onSuccess={() => navigate(from, { replace: true })} />
        </motion.div>
      </main>
    </div>
  );
}
