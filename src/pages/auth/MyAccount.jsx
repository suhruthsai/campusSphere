// My account: who I'm signed in as, and changing my password (e.g. after the admin gave me a temporary one).
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';
import { authApi } from '../../utils/api.js';

export default function MyAccount() {
  const { user, refreshUser } = useAuth();
  const mustChange = !!user?.must_change_password;
  const [form, setForm] = useState({ current: '', next: '', again: '' });
  const [msg, setMsg] = useState(null);   // { ok, text }
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.next !== form.again) { setMsg({ ok: false, text: 'The new passwords do not match.' }); return; }
    if (form.next === form.current) { setMsg({ ok: false, text: 'Choose a password different from the current one.' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      await authApi.changePassword(form.current, form.next);
      setForm({ current: '', next: '', again: '' });
      setMsg({ ok: true, text: 'Password changed. Use the new password next time you sign in.' });
      if (mustChange) await refreshUser();   // the rest of the app opens up
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageTransition className="mx-auto min-h-screen max-w-3xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="My account" title="Your sign-in details." />
      {mustChange && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Welcome! You signed in with a temporary password. Choose your own password below to continue.
        </p>
      )}
      <section className="glass rounded-2xl p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {[['Name', user?.name], ['Email', user?.email], ['Role', user?.role], ['Department', user?.department]].map(([k, v]) => (
            <div key={k}><dt className="text-[11px] uppercase tracking-wider text-slate-500">{k}</dt><dd className={`text-slate-200 ${k === 'Role' ? 'capitalize' : ''}`}>{v || '—'}</dd></div>
          ))}
        </dl>
      </section>
      <form onSubmit={submit} className="glass max-w-xl space-y-4 rounded-2xl p-5">
        <h2 className="section-title flex items-center gap-2"><KeyRound size={16} className="text-cyan-300" /> Change password</h2>
        <p className="text-xs text-slate-400">If you were given a temporary password, enter it as the current password.</p>
        <div>
          <label className={labelCls}>Current password</label>
          <input type="password" className={inputCls} required autoComplete="current-password" value={form.current} onChange={set('current')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>New password</label>
            <input type="password" className={inputCls} required minLength={8} maxLength={72} autoComplete="new-password" value={form.next} onChange={set('next')} />
          </div>
          <div>
            <label className={labelCls}>New password again</label>
            <input type="password" className={inputCls} required minLength={8} maxLength={72} autoComplete="new-password" value={form.again} onChange={set('again')} />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">At least 8 characters.</p>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</p>}
        <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </form>
    </PageTransition>
  );
}
