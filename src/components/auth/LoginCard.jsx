// LoginCard.jsx — the sign-in form, shared by the /login page and the overlay on the campus (LoginModal)
import { ArrowRight, Eye, EyeOff, Lock, Mail, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import BrandMark from '../ui/BrandMark.jsx';

/**
 * @param {() => void} onSuccess — called once the person is signed in
 * @param {() => void} [onClose] — set when shown over the campus: adds a close button and "keep exploring"
 * @param {string} [notice] — a line shown above the form (e.g. "sign in to continue")
 */
export default function LoginCard({ onSuccess, onClose, notice }) {
  const { login } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [capsOn,   setCapsOn]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="ds-card relative p-7 sm:p-9" style={{ borderRadius: 28, background: 'var(--surface)', backdropFilter: 'blur(30px) saturate(160%)' }}>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close sign in"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-[var(--text-3)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
          <X size={16} />
        </button>
      )}

      <div className="mb-8 flex justify-center">
        <BrandMark size={44} />
      </div>

      <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight" style={{ color: 'var(--text)' }}>Welcome Back</h1>
      <p className="mb-7 mt-1.5 text-sm" style={{ color: 'var(--text-2)' }}>Login to continue to your campus dashboard</p>

      {notice && (
        <p className="mb-5 rounded-xl border px-4 py-2.5 text-xs"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)', color: 'var(--brand-text)' }}>
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            type="text"
            aria-label="College email, username or roll number"
            autoComplete="username"
            autoFocus={Boolean(onClose)}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="College Email / Roll number"
            className="ds-input"
          />
        </div>

        <div>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input
              type={showPwd ? 'text' : 'password'}
              aria-label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') || false)}
              required
              placeholder="Password"
              className="ds-input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] transition hover:text-[var(--text)]"
            >
              {showPwd ? <Eye size={17} /> : <EyeOff size={17} />}
            </button>
          </div>
          {capsOn && <p className="mt-1.5 text-[11px] font-medium text-amber-500">Caps Lock is on</p>}
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-500"
          >
            {error}
          </motion.p>
        )}

        <div className="text-right">
          <Link to="/forgot-password" className="text-xs font-semibold transition hover:underline" style={{ color: 'var(--brand-text)' }}>
            Forgot Password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className="ds-btn w-full !py-3.5 !text-[15px]">
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : null}
          {loading ? 'Signing in…' : <>Sign In <ArrowRight size={18} /></>}
        </button>
      </form>

      {/* Divider, then the way in that needs no account */}
      <div className="my-6 flex items-center gap-3 text-[11px] font-semibold tracking-widest" style={{ color: 'var(--text-3)' }}>
        <span className="h-px flex-1" style={{ background: 'var(--border)' }} />OR<span className="h-px flex-1" style={{ background: 'var(--border)' }} />
      </div>

      {onClose ? (
        <button type="button" onClick={onClose} className="ds-chip w-full justify-center !py-3 text-sm">
          Keep exploring the campus
        </button>
      ) : (
        <Link to="/" className="ds-chip w-full justify-center !py-3 text-sm">
          Explore the campus as a guest
        </Link>
      )}

      <p className="mt-5 text-center text-[11px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
        No login yet? Students get a login slip from their class in-charge; staff, from the Admin Office.
      </p>
    </div>
  );
}
