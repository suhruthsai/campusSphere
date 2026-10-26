// Leaving the college: start the exit, get every unit's no-dues clearance (paying any dues
// online), download the No-Dues Certificate, then request the TC and other leaving documents.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, Clock3, CreditCard, Download, MapPin, Receipt } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import ServiceCounter from '../../components/services/ServiceCounter.jsx';
import { PLACE_NAMES, TestCheckout, rupees } from '../../components/joining/joiningUi.jsx';
import { btnGhost, btnPrimary, fmtIst, inputCls, labelCls } from '../../components/services/requestUi.jsx';
import { leavingApi, servicesApi } from '../../utils/api.js';
import { fmtDay } from '../../utils/campus.js';

export const UNIT_STATUS = {
  pending: { label: 'Waiting', icon: Clock3, card: 'border-amber-400/30 bg-amber-500/[0.06]', text: 'text-amber-300' },
  dues:    { label: 'Dues',    icon: AlertTriangle, card: 'border-rose-400/40 bg-rose-500/[0.08]', text: 'text-rose-300' },
  cleared: { label: 'Cleared', icon: Check, card: 'border-emerald-400/30 bg-emerald-500/[0.06]', text: 'text-emerald-300' },
};
const ORIGINAL_STATUS = { held: 'With the college', out: 'Lent to you', returned: 'Returned to you' };

function StartExit({ config, profile, onStarted }) {
  const finalYear = profile.year === 4;
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try { onStarted(await leavingApi.start({ reason, leaving_date: date })); } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="glass max-w-2xl space-y-4 rounded-2xl p-5">
      <h2 className="section-title">Start your no-dues clearance</h2>
      <p className="text-sm text-slate-300">
        Each of these sections checks that you owe nothing: {config.units.map((u) => u.label).join(', ')}.
        You'll see each one turn green here and on the campus map. Any dues can be paid online.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Reason for leaving</label>
          <select className={inputCls} required value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select</option>
            {config.reasons.map((r) => {
              // Only final-year students complete the course; others discontinue or transfer
              const locked = r === 'Course completed' && !finalYear;
              return <option key={r} value={r} disabled={locked}>{r}{locked ? ' (IV year only)' : ''}</option>;
            })}
          </select>
        </div>
        <div>
          <label className={labelCls}>Leaving date</label>
          <input type="date" className={inputCls} required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>I understand that once every section clears me, I'm treated as having left: bonafide certificates and NOCs are only for current students.</span>
      </label>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <button className={btnPrimary} disabled={busy || !agree}>{busy ? 'Starting…' : 'Start clearance'}</button>
    </form>
  );
}

function UnitCard({ item, busy, onPay, onReceipt }) {
  const st = UNIT_STATUS[item.status];
  const Icon = st.icon;
  return (
    <div className={`rounded-xl border p-4 ${st.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-white">{item.label}</p>
          <p className="flex items-center gap-1 text-xs text-slate-400"><MapPin size={11} /> {PLACE_NAMES[item.place] || item.place}</p>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-bold ${st.text}`}><Icon size={13} /> {st.label}</span>
      </div>
      {item.status === 'dues' && (
        <p className="mt-2 text-sm text-rose-100"><b>{rupees(item.dues_amount)}</b> · {item.remarks}</p>
      )}
      {item.status === 'cleared' && (
        <p className="mt-2 text-xs text-slate-400">
          {item.acted_by} · {fmtIst(item.acted_at)}
          {item.remarks && <span className="block text-slate-500">{item.remarks}</span>}
        </p>
      )}
      {item.status === 'pending' && <p className="mt-2 text-xs text-slate-500">Waiting for the section to check its records.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.status === 'dues' && (
          <button className={btnPrimary} disabled={busy} onClick={() => onPay(item)}><CreditCard size={14} /> Pay {rupees(item.dues_amount)}</button>
        )}
        {item.receipt && (
          <button className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline" disabled={busy} onClick={() => onReceipt(item.receipt)}>
            <Receipt size={12} /> Receipt {item.receipt.receipt_no}
          </button>
        )}
      </div>
    </div>
  );
}

export default function LeavingJourney() {
  const [config, setConfig] = useState(null);
  const [exitRec, setExitRec] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [payment, setPayment] = useState(null);
  const [counter, setCounter] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => leavingApi.mine().then(setExitRec).catch((e) => setError(e.message)), []);
  useEffect(() => {
    leavingApi.config().then(setConfig).catch((e) => setError(e.message));
    servicesApi.myProfile().then(setProfile).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const pay = (item) => run(async () => setPayment(await leavingApi.payDues(item.id)));
  const afterPayment = (p) => {
    setPayment(null);
    if (p.status !== 'paid') {
      setError('The payment did not go through. You can try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });   // the message is at the top
    }
    load();
  };

  const counts = exitRec?.counts;
  const total = exitRec ? exitRec.items.length : 0;
  const cleared = exitRec?.status === 'cleared';

  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Leaving the college" title="Clear your dues. Collect your documents." />
      {error && <p className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      {exitRec === undefined || !config || !profile ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : !exitRec && !profile.complete ? (
        <div className="glass max-w-2xl rounded-2xl p-5 text-sm text-slate-300">
          First complete your academic details on the <Link to="/services" className="font-semibold text-cyan-300 hover:underline">Services page</Link>; they go on your TC and No-Dues Certificate.
        </div>
      ) : !exitRec ? (
        <StartExit config={config} profile={profile} onStarted={setExitRec} />
      ) : (
        <div className="space-y-5">
          <section className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">{exitRec.reason} · leaving {fmtDay(exitRec.leaving_date)}</p>
                <h2 className="mt-1 text-2xl font-bold text-white">
                  {cleared ? 'All sections have cleared you' : `${counts.cleared} of ${total} sections cleared`}
                </h2>
                {!cleared && counts.dues > 0 && (
                  <p className="mt-1 text-sm text-rose-300">{counts.dues} {counts.dues === 1 ? 'section has' : 'sections have'} recorded dues. Pay online or settle at the counter.</p>
                )}
                {cleared && <p className="mt-1 text-sm text-emerald-300">Cleared on {fmtIst(exitRec.cleared_at)}</p>}
              </div>
              {cleared && (
                <button className={btnPrimary} disabled={busy} onClick={() => run(leavingApi.noDuesCertificate)}>
                  <Download size={15} /> No-Dues Certificate
                </button>
              )}
            </div>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/10">
              <span className="bg-emerald-400" style={{ width: `${(counts.cleared / total) * 100}%` }} />
              <span className="bg-rose-400" style={{ width: `${(counts.dues / total) * 100}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Each section shows on the <Link to="/" className="text-cyan-300 hover:underline">campus map</Link> as a marker: amber waiting, red dues, green cleared.
            </p>
          </section>

          <section>
            <h2 className="section-title mb-3">No-dues clearance</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {exitRec.items.map((it) => (
                <UnitCard key={it.id} item={it} busy={busy} onPay={pay}
                  onReceipt={(r) => run(() => leavingApi.receipt(r.id, r.receipt_no))} />
              ))}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={`glass rounded-2xl p-5 ${cleared ? '' : 'opacity-70'}`}>
              <h2 className="section-title mb-2">Leaving documents</h2>
              <p className="mb-3 text-sm text-slate-400">
                {cleared ? 'You can now request your Transfer Certificate and the other leaving documents.'
                  : 'The Transfer Certificate unlocks once every section has cleared you. Exam Cell documents can be requested any time.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button className={btnGhost} onClick={() => setCounter('civilit')}>Admin Office · TC, conduct, course completion <ArrowRight size={14} /></button>
                <button className={btnGhost} onClick={() => setCounter('exam')}>Exam Cell · PC, CMM, transcripts <ArrowRight size={14} /></button>
              </div>
              <Link to="/services" className="mt-3 inline-block text-xs font-semibold text-cyan-300 hover:underline">Track my requests →</Link>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="section-title mb-2">Your original certificates</h2>
              {exitRec.originals.length === 0 ? (
                <p className="text-sm text-slate-400">The college has no originals of yours on record.</p>
              ) : (
                <>
                  <ul className="divide-y divide-white/5 text-sm">
                    {exitRec.originals.map((o) => (
                      <li key={o.id} className="flex justify-between py-2">
                        <span className="text-slate-200">{o.label}</span>
                        <span className={o.status === 'returned' ? 'text-emerald-300' : 'text-amber-300'}>{ORIGINAL_STATUS[o.status]}</span>
                      </li>
                    ))}
                  </ul>
                  {exitRec.originals.some((o) => o.status !== 'returned') && (
                    <p className="mt-2 text-xs text-slate-500">
                      {cleared ? 'Collect them at the Admin Office with your No-Dues Certificate.' : 'They are handed back at the Admin Office after your clearance.'}
                    </p>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      )}

      {payment && <TestCheckout payment={payment} completeFn={leavingApi.completeTest} onDone={afterPayment} onClose={() => setPayment(null)} />}
      {counter && <ServiceCounter counterId={counter} onClose={() => setCounter(null)} />}
    </PageTransition>
  );
}
