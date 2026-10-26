// No-dues desk for clearance officers (library, accounts, department, transport, exam cell,
// placement, sports): clear a leaving student, or record dues they must settle.
import { useCallback, useEffect, useState } from 'react';
import { Check, IndianRupee } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { rupees } from '../../components/joining/joiningUi.jsx';
import { btnGhost, btnPrimary, fmtIst, inputCls } from '../../components/services/requestUi.jsx';
import { leavingApi } from '../../utils/api.js';
import { UNIT_STATUS } from './LeavingJourney.jsx';
import { fmtDay } from '../../utils/campus.js';


function Row({ it, onChange }) {
  const [mode, setMode] = useState(null);   // 'clear' | 'dues'
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const st = UNIT_STATUS[it.status];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'dues') await leavingApi.recordDues(it.id, Number(amount), remarks);
      else await leavingApi.clear(it.id, remarks || null);
      setMode(null);
      setRemarks('');
      setAmount('');
      onChange();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <li className={`rounded-xl border px-4 py-3 ${st.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white">
            {it.student.name} <span className="font-mono text-xs font-normal text-slate-400">{it.student.roll_no || it.student.email}</span>
          </p>
          <p className="text-xs text-slate-400">
            {it.label} · {it.department} · {it.reason} · leaving {fmtDay(it.leaving_date)}
          </p>
          {it.status === 'dues' && <p className="mt-1 text-sm text-rose-200"><b>{rupees(it.dues_amount)}</b> · {it.remarks}</p>}
          {it.status === 'cleared' && <p className="mt-1 text-xs text-slate-500">Cleared by {it.acted_by} · {fmtIst(it.acted_at)}{it.remarks ? ` · ${it.remarks}` : ''}</p>}
        </div>
        {it.status !== 'cleared' && !mode && (
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={() => setMode('clear')}><Check size={14} /> {it.status === 'dues' ? 'Settled at counter' : 'No dues'}</button>
            {it.status === 'pending' && <button className={btnGhost} onClick={() => setMode('dues')}><IndianRupee size={14} /> Record dues</button>}
          </div>
        )}
      </div>
      {mode && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
          {mode === 'dues' && (
            <input type="number" min={1} required className={`${inputCls} w-32`} placeholder="Amount ₹" value={amount} onChange={(e) => setAmount(e.target.value)} />
          )}
          <input className={`${inputCls} min-w-[14rem] flex-1`} maxLength={300}
            required={mode === 'dues' || it.status === 'dues'} minLength={mode === 'dues' || it.status === 'dues' ? 5 : undefined}
            placeholder={mode === 'dues' ? 'What is owed (e.g. Book not returned: Data Structures)'
              : it.status === 'dues' ? 'How it was settled (e.g. cash receipt no.)' : 'Remarks (optional)'}
            value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          <button className={btnPrimary} disabled={busy}>{mode === 'dues' ? 'Record dues' : 'Clear student'}</button>
          <button type="button" className={btnGhost} onClick={() => { setMode(null); setError(''); }}>Cancel</button>
          {error && <p className="w-full text-sm text-rose-300">{error}</p>}
        </form>
      )}
    </li>
  );
}

export default function ClearanceDesk() {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    leavingApi.queue(status).then(setData).catch((e) => setError(e.message));
  }, [status]);
  useEffect(() => { setData(null); load(); }, [load]);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-5xl space-y-4 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="No-dues clearance" title="Clear leaving students in one click." />
      {error && <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
      {data && (
        <p className="text-sm text-slate-400">
          {data.units.length ? <>You clear: <span className="text-slate-200">{data.units.join(', ')}</span></> : 'You are not a clearance officer for any section. Ask the admin to assign you.'}
        </p>
      )}
      <div className="flex w-fit gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {[['pending', 'Waiting'], ['dues', 'With dues'], ['cleared', 'Cleared']].map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${status === v ? 'bg-cyan-400 text-slate-900' : 'text-slate-300 hover:bg-white/5'}`}>{l}</button>
        ))}
      </div>
      {!data ? <p className="text-sm text-slate-400">Loading…</p> : data.items.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">
          {status === 'pending' ? 'Nobody is waiting for your clearance.' : status === 'dues' ? 'No unpaid dues.' : 'No one cleared yet.'}
        </div>
      ) : <ul className="space-y-2">{data.items.map((it) => <Row key={it.id} it={it} onChange={load} />)}</ul>}
    </PageTransition>
  );
}
