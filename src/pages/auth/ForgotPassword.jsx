// ForgotPassword.jsx — Password reset: a 6-digit code by email, then a new password.
// Without an email service the server says so, and the page sends people to the Admin Office (as before).
import { ArrowLeft, ArrowRight, KeyRound, Lock, Mail, MailCheck, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from '../../components/ui/BrandMark.jsx';
import CampusBackdrop from '../../components/ui/CampusBackdrop.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';
import { authApi } from '../../utils/api.js';

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

function Field({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      <Icon size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
      <input className="ds-input" {...props} />
    </div>
  );
}

function Notice({ msg }) {
  if (!msg) return null;
  return <p role="alert" className={`text-sm ${msg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{msg.text}</p>;
}

export default function ForgotPassword() {
  // ask → code → done; "office" when email reset isn't set up
  const [step,  setStep]  = useState('ask');
  const [login, setLogin] = useState('');
  const [form,  setForm]  = useState({ code: '', next: '', again: '' });
  const [info,  setInfo]  = useState('');
  const [msg,   setMsg]   = useState(null);
  const [busy,  setBusy]  = useState(false);

  const ask = async (e) => {
    e?.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await authApi.forgotPassword(login.trim());
      setInfo(r.message);
      setStep(r.delivery === 'office' ? 'office' : 'code');
      if (e === undefined) setMsg({ ok: true, text: 'A new code is on its way.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (form.next !== form.again) { setMsg({ ok: false, text: 'The new passwords do not match.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await authApi.resetWithCode(login.trim(), form.code.trim(), form.next);
      setStep('done');
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <p className="mt-6 text-center text-xs">
      <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold transition hover:underline" style={{ color: 'var(--brand-text)' }}>
        <ArrowLeft size={12} /> Back to login
      </Link>
    </p>
  );

  const badge = (Icon) => (
    <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full text-white" style={{ background: 'var(--brand-grad)', boxShadow: '0 10px 30px rgba(99,102,241,0.45)' }}>
      <Icon size={30} />
    </div>
  );

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
              {step === 'ask' && (
                <motion.div key="ask" {...fade}>
                  <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight" style={{ color: 'var(--text)' }}>Reset password</h1>
                  <p className="mb-7 mt-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                    Enter your college email or roll number. We'll email a 6-digit code to the address on your account.
                  </p>
                  <form onSubmit={ask} className="space-y-4">
                    <Field icon={Mail} type="text" value={login} onChange={(e) => setLogin(e.target.value)} required minLength={3}
                      autoComplete="username" aria-label="College email or roll number" placeholder="College email / Roll number" />
                    <Notice msg={msg} />
                    <button type="submit" disabled={busy} className="ds-btn w-full !py-3.5 !text-[15px]">
                      {busy ? 'Sending…' : <>Email me a code <ArrowRight size={18} /></>}
                    </button>
                  </form>
                  {back}
                </motion.div>
              )}

              {step === 'code' && (
                <motion.div key="code" {...fade}>
                  {badge(MailCheck)}
                  <h1 className="text-center font-display text-xl font-bold" style={{ color: 'var(--text)' }}>Check your email</h1>
                  <p className="mb-6 mt-2 text-center text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{info}</p>
                  <form onSubmit={reset} className="space-y-4">
                    <Field icon={KeyRound} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
                      value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
                      aria-label="6-digit code" placeholder="6-digit code" />
                    <Field icon={Lock} type="password" autoComplete="new-password" minLength={8} maxLength={72} required
                      value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })}
                      aria-label="New password" placeholder="New password (at least 8 characters)" />
                    <Field icon={Lock} type="password" autoComplete="new-password" minLength={8} maxLength={72} required
                      value={form.again} onChange={(e) => setForm({ ...form, again: e.target.value })}
                      aria-label="New password again" placeholder="New password again" />
                    <Notice msg={msg} />
                    <button type="submit" disabled={busy} className="ds-btn w-full !py-3.5 !text-[15px]">
                      {busy ? 'Saving…' : <>Set new password <ArrowRight size={18} /></>}
                    </button>
                  </form>
                  <p className="mt-5 text-center text-xs" style={{ color: 'var(--text-3)' }}>
                    No email? Check spam, or{' '}
                    <button type="button" disabled={busy} onClick={() => ask()} className="font-semibold hover:underline" style={{ color: 'var(--brand-text)' }}>
                      send a new code
                    </button>.
                  </p>
                  {back}
                </motion.div>
              )}

              {step === 'done' && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-2 text-center">
                  {badge(ShieldCheck)}
                  <h2 className="mb-2 font-display text-xl font-bold" style={{ color: 'var(--text)' }}>Password changed</h2>
                  <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    Sign in with your new password. Any device that was signed in to your account has been signed out.
                  </p>
                  <Link to="/login" className="ds-btn !px-6 !py-3 text-sm">Sign in <ArrowRight size={16} /></Link>
                </motion.div>
              )}

              {step === 'office' && (
                <motion.div key="office" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-2 text-center">
                  {badge(MailCheck)}
                  <h2 className="mb-2 font-display text-xl font-bold" style={{ color: 'var(--text)' }}>Ask the Admin Office</h2>
                  <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    {info} After signing in, change it under <strong style={{ color: 'var(--text)' }}>My account</strong> (click your name in the sidebar).
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
