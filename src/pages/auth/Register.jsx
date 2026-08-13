// Register.jsx — CampusSphere Registration
import { Bot, Eye, EyeOff, Lock, Mail, User, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const DEPARTMENTS = ['CSE', 'ECE', 'Mech', 'EEE', 'Civil', 'IT', 'S&H', 'Administration', 'Library', 'Canteen'];
const ROLES = [
  { value: 'student', label: 'Student', color: '#00E5FF' },
  { value: 'faculty', label: 'Faculty', color: '#F59E0B' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', role: 'student', department: 'CSE', password: '', confirm: '' });
  const [showPwd, setShowPwd]   = useState(false);
  const [error,   setError]     = useState('');
  const [loading, setLoading]   = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6)       { setError('Password must be at least 6 characters.'); return; }
    setError(''); setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeColor = ROLES.find((r) => r.value === form.role)?.color ?? '#00E5FF';

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background:
          'radial-gradient(ellipse 90% 55% at 8% -8%, rgba(0,229,255,0.2) 0%,transparent 52%),' +
          'radial-gradient(ellipse 75% 45% at 92% 6%, rgba(123,97,255,0.24) 0%,transparent 50%),' +
          'linear-gradient(160deg,#010408 0%,#04091a 35%,#020812 65%,#010408 100%)',
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full opacity-25 animate-aurora"
             style={{ background: 'radial-gradient(circle,rgba(0,229,255,0.28) 0%,transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-3xl border border-white/10 p-8 shadow-2xl"
             style={{ background: 'rgba(4,9,26,0.88)', backdropFilter: 'blur(32px)' }}>

          {/* Logo */}
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#00E5FF]/25 bg-[#00E5FF]/10 text-[#00E5FF]">
              <Bot size={24} />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-white">CampusSphere</p>
              <p className="text-xs text-slate-400">Create your campus account</p>
            </div>
          </div>

          {/* Role selector */}
          <div className="mb-5 flex rounded-2xl border border-white/10 bg-white/5 p-1">
            {ROLES.map((r) => (
              <button key={r.value} type="button" onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                      className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all"
                      style={form.role === r.value ? { background: r.color + '18', color: r.color } : { color: '#64748b' }}>
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <Field icon={<User size={14} />} label="Full name">
              <input type="text" value={form.name} onChange={set('name')} required placeholder="Your full name"
                     className="input-base pl-9" />
            </Field>

            {/* Email */}
            <Field icon={<Mail size={14} />} label="Email">
              <input type="email" value={form.email} onChange={set('email')} required placeholder="you@suhruth.edu"
                     className="input-base pl-9" />
            </Field>

            {/* Department */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Department</label>
              <select value={form.department} onChange={set('department')}
                      className="w-full rounded-xl border border-white/10 bg-[#04091a] py-3 px-4 text-sm text-white outline-none focus:border-[#00E5FF]/40">
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Password */}
            <Field icon={<Lock size={14} />} label="Password">
              <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={set('password')} required
                     placeholder="Min 6 characters" className="input-base pl-9 pr-11" />
              <button type="button" onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </Field>

            {/* Confirm */}
            <Field icon={<Lock size={14} />} label="Confirm password">
              <input type={showPwd ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} required
                     placeholder="Repeat password" className="input-base pl-9" />
            </Field>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
                {error}
              </motion.p>
            )}

            <button type="submit" disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-[#020814] transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
                    style={{ background: `linear-gradient(135deg, ${activeColor}, ${activeColor}cc)`, boxShadow: `0 0 24px ${activeColor}30` }}>
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#020814]/30 border-t-[#020814]" />
                       : <UserPlus size={16} />}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-[#00E5FF] hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>

      <style>{`
        .input-base {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: #fff;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .input-base:focus { border-color: rgba(0,229,255,0.4); background: rgba(255,255,255,0.08); }
        .input-base::placeholder { color: #475569; }
      `}</style>
    </div>
  );
}

function Field({ icon, label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
        {children}
      </div>
    </div>
  );
}
