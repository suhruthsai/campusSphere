// ForgotPassword.jsx — Password reset flow
import { Bot, ArrowLeft, Mail, Send, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1400)); // simulate API call
    setSent(true);
    setLoading(false);
  };

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
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-3xl border border-white/10 p-8 shadow-2xl"
             style={{ background: 'rgba(4,9,26,0.88)', backdropFilter: 'blur(32px)' }}>

          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#00E5FF]/25 bg-[#00E5FF]/10 text-[#00E5FF]">
              <Bot size={24} />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-white">CampusSphere</p>
              <p className="text-xs text-slate-400">Password reset</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!sent ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="mb-1 font-display text-2xl font-extrabold text-white">Reset password</h1>
                <p className="mb-6 text-sm text-slate-400">
                  Enter your campus email and we'll send a reset link.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">Email address</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                        placeholder="you@suhruth.edu"
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:border-[#00E5FF]/40 transition"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading}
                          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-[#020814] transition-all"
                          style={{ background: 'linear-gradient(135deg,#00E5FF,#00E5FFcc)', boxShadow: '0 0 24px rgba(0,229,255,0.3)' }}>
                    {loading
                      ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#020814]/30 border-t-[#020814]" />
                      : <Send size={16} />}
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#00FFB3]/12 border border-[#00FFB3]/25">
                  <CheckCircle size={32} className="text-[#00FFB3]" />
                </div>
                <h2 className="mb-2 font-display text-xl font-bold text-white">Check your inbox</h2>
                <p className="mb-6 text-sm text-slate-400">
                  If <strong className="text-white">{email}</strong> is registered,
                  a reset link will arrive within a few minutes.
                </p>
                <Link to="/login"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white hover:bg-white/10 transition">
                  <ArrowLeft size={14} /> Back to login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {!sent && (
            <p className="mt-5 text-center text-xs text-slate-500">
              <Link to="/login" className="inline-flex items-center gap-1 hover:text-[#00E5FF] transition">
                <ArrowLeft size={11} /> Back to login
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
