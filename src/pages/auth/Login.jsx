// Login.jsx — CampusSphere Authentication
import { Bot, Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { DEMO_CREDENTIALS } from '../../data/users.js';

const ROLES = [
  { value: 'student', label: 'Student',    color: '#00E5FF' },
  { value: 'faculty', label: 'Faculty',    color: '#F59E0B' },
  { value: 'admin',   label: 'Admin',      color: '#ef4444' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [selectedRole, setSelectedRole] = useState('student');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // Auto-fill demo credentials when role changes
  const fillDemo = (role) => {
    const cred = DEMO_CREDENTIALS.find((c) => c.role === role);
    if (cred) { setEmail(cred.email); setPassword(cred.password); }
    setSelectedRole(role);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeRole = ROLES.find((r) => r.value === selectedRole);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background:
          'radial-gradient(ellipse 90% 55% at 8% -8%, rgba(0,229,255,0.2) 0%,transparent 52%),' +
          'radial-gradient(ellipse 75% 45% at 92% 6%, rgba(123,97,255,0.24) 0%,transparent 50%),' +
          'radial-gradient(ellipse 55% 45% at 50% 105%, rgba(0,255,179,0.1) 0%,transparent 58%),' +
          'linear-gradient(160deg,#010408 0%,#04091a 35%,#020812 65%,#010408 100%)',
      }}
    >
      {/* Floating blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full opacity-25 animate-aurora"
             style={{ background: 'radial-gradient(circle,rgba(0,229,255,0.28) 0%,transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute top-10 right-0 h-[400px] w-[400px] rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle,rgba(123,97,255,0.32) 0%,transparent 70%)', filter: 'blur(60px)', animation: 'aurora 16s ease-in-out infinite reverse' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-3xl border border-white/10 p-8 shadow-2xl"
             style={{ background: 'rgba(4,9,26,0.88)', backdropFilter: 'blur(32px)' }}>

          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#00E5FF]/25 bg-[#00E5FF]/10 text-[#00E5FF]">
              <Bot size={24} />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-white">CampusSphere</p>
              <p className="text-xs text-slate-400">Suhruth University · Digital Twin</p>
            </div>
          </div>

          <h1 className="mb-1 font-display text-2xl font-extrabold text-white">Welcome back</h1>
          <p className="mb-6 text-sm text-slate-400">Sign in to your campus account</p>

          {/* Role selector */}
          <div className="mb-6 flex rounded-2xl border border-white/10 bg-white/5 p-1">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => fillDemo(r.value)}
                className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all"
                style={
                  selectedRole === r.value
                    ? { background: r.color + '18', color: r.color, boxShadow: `0 0 12px ${r.color}22` }
                    : { color: '#64748b' }
                }
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@suhruth.edu"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-4 text-sm text-white placeholder-slate-600 outline-none transition focus:border-[#00E5FF]/40 focus:bg-white/8"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-11 text-sm text-white placeholder-slate-600 outline-none transition focus:border-[#00E5FF]/40 focus:bg-white/8"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-400"
              >
                {error}
              </motion.p>
            )}

            {/* Forgot password */}
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-[#00E5FF] transition">
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-[#020814] transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: loading ? '#005566' : `linear-gradient(135deg, ${activeRole.color}, ${activeRole.color}cc)`,
                boxShadow: `0 0 24px ${activeRole.color}30`,
              }}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#020814]/30 border-t-[#020814]" />
              ) : (
                <LogIn size={16} />
              )}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-5 rounded-xl border border-white/8 bg-white/4 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Demo credentials auto-filled</p>
            <p className="text-xs text-slate-400">
              <span style={{ color: activeRole.color }}>{activeRole.label}:</span>{' '}
              {DEMO_CREDENTIALS.find((c) => c.role === selectedRole)?.email}
            </p>
          </div>

          {/* Register link */}
          <p className="mt-5 text-center text-xs text-slate-500">
            New to CampusSphere?{' '}
            <Link to="/register" className="font-medium text-[#00E5FF] hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
