// Shared bits for the joining pages: statuses, rupees, Campus Passport stamps, document viewer
// and the test-mode checkout.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { joiningApi } from '../../utils/api.js';
import { btnGhost, btnPrimary } from '../services/requestUi.jsx';

export const ADMISSION_STATUS = {
  draft:         { label: 'Draft',          cls: 'border-slate-400/30 bg-slate-500/10 text-slate-300' },
  submitted:     { label: 'With the office', cls: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300' },
  needs_changes: { label: 'Needs changes',  cls: 'border-amber-400/40 bg-amber-500/10 text-amber-300' },
  verified:      { label: 'Verified',       cls: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' },
  enrolled:      { label: 'Enrolled',       cls: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200' },
};
export const DOC_STATUS = {
  pending:  { label: 'Awaiting review', cls: 'text-slate-400' },
  accepted: { label: 'Accepted',        cls: 'text-emerald-300' },
  rejected: { label: 'Rejected',        cls: 'text-rose-300' },
};

export function AdmissionBadge({ status }) {
  const s = ADMISSION_STATUS[status] || ADMISSION_STATUS.draft;
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}

/** 125000 -> "₹1,25,000" */
export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const PLACE_NAMES = {
  frontgate: 'Main Gate', civilit: 'Admin Office', 'Bank & ATM': 'Bank & ATM',
  cse: 'CSE Block', ece: 'ECE Block', mecheee: 'Mech & EEE Block', sh: 'S&H Block',
  lib: 'Library', exam: 'Examination Department', placement: 'Placement Cell',
  cant: 'Canteen & Sports Block', 'Parking (Buses)': 'Bus parking',
};
const STAMP_ICONS = ['🚪', '📄', '🔍', '🏦', '📜', '🎓'];

/** The six joining steps as passport stamps. */
export function PassportStamps({ progress }) {
  const current = progress.findIndex((p) => !p.done);
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {progress.map((p, i) => {
        const isCurrent = i === current;
        return (
          <li key={p.key} className={`relative rounded-xl border p-2.5 text-center transition ${
            p.done ? 'border-emerald-400/50 bg-emerald-500/10' : isCurrent ? 'border-amber-300/60 bg-amber-400/10' : 'border-white/10 bg-white/[0.02]'}`}>
            <div className={`mx-auto grid h-10 w-10 place-items-center rounded-full text-lg ${p.done ? 'bg-emerald-500/20' : 'bg-white/5'} ${isCurrent ? 'animate-pulse' : ''}`}>
              {STAMP_ICONS[i]}
            </div>
            <p className={`mt-1.5 text-[11px] font-bold leading-tight ${p.done ? 'text-emerald-200' : isCurrent ? 'text-amber-200' : 'text-slate-400'}`}>{p.label}</p>
            <p className="text-[10px] text-slate-500">{PLACE_NAMES[p.place] || p.place}</p>
            {p.done && <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-slate-900"><Check size={12} /></span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Shows an uploaded document (PDF or image) inside the page — no pop-up tab needed. */
export function DocViewer({ doc, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let objectUrl;
    joiningApi.docBlob(doc.id).then((blob) => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch((e) => setError(e.message));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id]);
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141a22]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <p className="text-sm font-semibold text-white">{doc.label} <span className="font-normal text-slate-500">· {doc.original_name}</span></p>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto bg-[#0b1018]">
          {error && <p className="p-4 text-sm text-rose-300">{error}</p>}
          {url && (doc.content_type === 'application/pdf'
            ? <iframe title={doc.label} src={url} className="h-full w-full" />
            : <img alt={doc.label} src={url} className="mx-auto max-h-full" />)}
          {!url && !error && <p className="p-4 text-sm text-slate-400">Loading…</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Stand-in for the payment gateway while PAYMENT_MODE is "test". No card details are asked for. */
/** Simulated checkout. completeFn finishes the payment; defaults to joining fees. */
export function TestCheckout({ payment, onDone, onClose, completeFn = joiningApi.completeTest }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const finish = async (outcome) => {
    setBusy(true);
    setError('');
    try { onDone(await completeFn(payment.id, outcome)); } catch (e) { setError(e.message); setBusy(false); }
  };
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-300/40 bg-[#141a22] p-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-300">Test payment · no real money</p>
        <h2 className="mt-1 text-xl font-bold text-white">Pay {rupees(payment.amount)}</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          {payment.items.map((it, i) => <li key={i} className="flex justify-between"><span>{it.name}</span><span>{rupees(it.amount)}</span></li>)}
        </ul>
        <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          The college's payment gateway isn't connected yet, so this simulates the result. Nothing is charged.
        </p>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button className={btnPrimary} disabled={busy} onClick={() => finish('success')}>Simulate successful payment</button>
          <button className={btnGhost} disabled={busy} onClick={() => finish('failure')}>Simulate failure</button>
          <button className="ml-auto text-sm text-slate-400 hover:text-white" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
