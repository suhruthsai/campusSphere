// Register of original certificates the college holds, with every hand-over logged:
// lend temporarily (with a due date), re-deposit, or return for good.
import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { btnGhost, btnPrimary, fmtIst, inputCls } from '../../components/services/requestUi.jsx';
import { joiningApi } from '../../utils/api.js';

const STATUS = {
  held: { label: 'With the college', cls: 'text-emerald-300' },
  out: { label: 'Lent to student', cls: 'text-amber-300' },
  returned: { label: 'Returned', cls: 'text-slate-400' },
};
const ACTION_LABEL = { received: 'Received', lent: 'Lent', redeposited: 'Re-deposited', returned: 'Returned' };

function Row({ r, onChange }) {
  const [mode, setMode] = useState(null);
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const act = async (fn) => {
    setError('');
    try { await fn(); setMode(null); setNote(''); onChange(); } catch (e) { setError(e.message); }
  };
  return (
    <li className={`rounded-xl border px-4 py-3 ${r.overdue ? 'border-rose-400/40 bg-rose-500/5' : 'border-white/5'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-white">{r.label}</p>
          <p className="text-xs text-slate-400">{r.student?.name} · {r.student?.roll_no || 'no roll no. yet'} · {r.ack_no}</p>
          <p className={`text-xs font-semibold ${STATUS[r.status].cls}`}>
            {STATUS[r.status].label}{r.status === 'out' ? ` · due back ${r.due_back}` : ''}{r.overdue ? ' · OVERDUE' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {r.status === 'held' && <button className={btnGhost} onClick={() => setMode('lend')}>Lend</button>}
          {r.status === 'out' && <button className={btnPrimary} onClick={() => setMode('redeposit')}>Re-deposit</button>}
          {r.status !== 'returned' && <button className={btnGhost} onClick={() => setMode('return')}>Return for good</button>}
          <button className="px-2 text-xs text-slate-400 hover:text-white" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'History'}</button>
        </div>
      </div>
      {mode && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {mode === 'lend' && <input type="date" className={`${inputCls} w-44`} value={due} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDue(e.target.value)} />}
          <input className={`${inputCls} flex-1`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)}
            placeholder={mode === 'lend' ? 'Purpose (e.g. passport verification)' : mode === 'return' ? 'Reason (e.g. course completed)' : 'Note (optional)'} />
          <button className={btnPrimary} disabled={mode === 'lend' && !due} onClick={() => act(() => (
            mode === 'lend' ? joiningApi.lend(r.id, due, note) : mode === 'redeposit' ? joiningApi.redeposit(r.id, note) : joiningApi.returnOriginal(r.id, note)))}>
            Confirm
          </button>
          <button className={btnGhost} onClick={() => setMode(null)}>Cancel</button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
      {open && (
        <ol className="mt-2 space-y-1 border-l border-white/10 pl-3 text-xs text-slate-400">
          {r.movements.map((m, i) => (
            <li key={i}><b className="text-slate-200">{ACTION_LABEL[m.action] || m.action}</b> · {fmtIst(m.at)} · {m.by}{m.due_back ? ` · due ${m.due_back}` : ''}{m.note ? ` · ${m.note}` : ''}</li>
          ))}
        </ol>
      )}
    </li>
  );
}

export default function OriginalsRegister() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    joiningApi.originals({ ...(status ? { status } : {}), ...(q.trim() ? { q: q.trim() } : {}) }).then(setRows).catch((e) => setError(e.message));
  }, [status, q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const overdue = (rows || []).filter((r) => r.overdue).length;
  return (
    <PageTransition className="mx-auto min-h-screen max-w-5xl space-y-4 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Admin Office · originals register" title="Every original certificate, accounted for." />
      {error && <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input className={`${inputCls} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, roll no., email or ack. no." />
        </div>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {[['', 'All'], ['held', 'Held'], ['out', 'Lent'], ['returned', 'Returned']].map(([v, l]) => (
            <button key={l} onClick={() => setStatus(v)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${status === v ? 'bg-cyan-400 text-slate-900' : 'text-slate-300 hover:bg-white/5'}`}>{l}</button>
          ))}
        </div>
      </div>
      {overdue > 0 && <p className="text-sm font-semibold text-rose-300">{overdue} lent original{overdue > 1 ? 's are' : ' is'} past the due date.</p>}
      {!rows ? <p className="text-sm text-slate-400">Loading…</p> : rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">No originals found.</div>
      ) : <ul className="space-y-2">{rows.map((r) => <Row key={r.id} r={r} onChange={load} />)}</ul>}
    </PageTransition>
  );
}
