// ForgotPassword.jsx — Password reset flow
import { ArrowLeft, ArrowRight, Mail, MailCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from '../../components/ui/BrandMark.jsx';
import CampusBackdrop from '../../components/ui/CampusBackdrop.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // There is no email service: resets are done by the admin, who gives a temporary password
    setSent(true);
  };

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="absolute inset-0" style={{ filter: 'blur(3px) saturate(1.15)', transform: 'scale(1.04)' }}>
        <CampusBackdrop />
      </div>
      <div className="absolute inset-0" style={{ background: 'color-mix(in srgb, var(--bg) 60%, transparent)' }} />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10">
        <BrandMark size={38} sub="MVSR Engineering College" />
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex items-center justify-center px-4 pb-12 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[440px]"
        >
          <div className="ds-card p-7 sm:p-9" style={{ borderRadius: 28, backdropFilter: 'blur(30px) saturate(160%)' }}>
            <AnimatePresence mode="wait">
              {!sent ? (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight" style={{ color: 'var(--text)' }}>Reset password</h1>
                  <p className="mb-7 mt-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                    Password resets are done by the college admin. Enter your campus email to see what to do.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                      <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                      <input
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                        aria-label="Email address" placeholder="you@suhruth.edu" className="ds-input"
                      />
                    </div>
                    <button type="submit" className="ds-btn w-full !py-3.5 !text-[15px]">
                      Continue <ArrowRight size={18} />
                    </button>
                  </form>

                  <p className="mt-6 text-center text-xs">
                    <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold transition hover:underline" style={{ color: 'var(--brand-text)' }}>
                      <ArrowLeft size={12} /> Back to login
                    </Link>
                  </p>
                </motion.div>
              ) : (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-2 text-center">
                  <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full text-white" style={{ background: 'var(--brand-grad)', boxShadow: '0 10px 30px rgba(99,102,241,0.45)' }}>
                    <MailCheck size={30} />
                  </div>
                  <h2 className="mb-2 font-display text-xl font-bold" style={{ color: 'var(--text)' }}>Ask the admin for a new password</h2>
                  <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    Contact the college admin (Admin Office) and ask them to reset the password for{' '}
                    <strong style={{ color: 'var(--text)' }}>{email}</strong>. They will give you a temporary password;
                    after signing in, change it under <strong style={{ color: 'var(--text)' }}>My account</strong> (click your name in the sidebar).
                  </p>
                  <Link to="/login" className="ds-chip !px-5 !py-2.5 text-sm">
                    <ArrowLeft size={14} /> Back to login
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
