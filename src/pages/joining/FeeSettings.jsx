// Admin: the college fees collected at joining (special fee, CRT fee, university fee, bus fee...)
// and the fees for documents (TC, MOI, PC, CMM, transcripts...).
import { useCallback, useEffect, useState } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { rupees } from '../../components/joining/joiningUi.jsx';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';
import { joiningApi, leavingApi } from '../../utils/api.js';

const EMPTY = { name: '', description: '', amount: '', optional: false, active: true, sort_order: 0 };

function FeeForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    try { await onSave({ ...f, amount: Number(f.amount), sort_order: Number(f.sort_order) || 0 }); } catch (x) { setError(x.message); }
  };
  return (
    <form onSubmit={save} className="grid gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-4 sm:grid-cols-6">
      <div className="sm:col-span-3"><label className={labelCls}>Name</label><input className={inputCls} value={f.name} onChange={set('name')} required minLength={2} maxLength={60} /></div>
      <div className="sm:col-span-2"><label className={labelCls}>Amount (₹)</label><input className={inputCls} type="number" min={0} value={f.amount} onChange={set('amount')} required /></div>
      <div><label className={labelCls}>Order</label><input className={inputCls} type="number" value={f.sort_order} onChange={set('sort_order')} /></div>
      <div className="sm:col-span-6"><label className={labelCls}>Description</label><input className={inputCls} value={f.description || ''} onChange={set('description')} maxLength={200} /></div>
      <label className="flex items-center gap-2 text-sm text-slate-200 sm:col-span-3"><input type="checkbox" checked={f.optional} onChange={set('optional')} /> Optional (student opts in, e.g. bus fee)</label>
      <label className="flex items-center gap-2 text-sm text-slate-200 sm:col-span-3"><input type="checkbox" checked={f.active} onChange={set('active')} /> Active (collected from new joinees)</label>
      {error && <p className="text-sm text-rose-300 sm:col-span-6">{error}</p>}
      <div className="flex gap-2 sm:col-span-6"><button className={btnPrimary} type="submit">Save</button><button type="button" className={btnGhost} onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function DocumentFeeRow({ r, onSaved }) {
  const [amount, setAmount] = useState(String(r.amount));
  const [msg, setMsg] = useState('');
  const dirty = Number(amount) !== r.amount;
  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    try { await leavingApi.setDocumentFee(r.doc_type, Number(amount)); setMsg('Saved'); onSaved(); } catch (x) { setMsg(x.message); }
  };
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 px-4 py-2.5">
      <p className="text-sm text-white">{r.name} {r.per_copy && <span className="text-xs text-slate-400">· per copy</span>}
        {r.is_default && r.amount > 0 && <span className="ml-1 text-xs text-amber-300">· default amount</span>}</p>
      <form onSubmit={save} className="flex items-center gap-2">
        {msg && <span className={`text-xs ${msg === 'Saved' ? 'text-emerald-300' : 'text-rose-300'}`}>{msg}</span>}
        <span className="text-sm text-slate-400">₹</span>
        <input className={`${inputCls} w-24`} type="number" min={0} max={100000} required value={amount}
          onChange={(e) => { setAmount(e.target.value); setMsg(''); }} aria-label={`${r.name} fee`} />
        <button className={btnGhost} disabled={!dirty}>Save</button>
      </form>
    </li>
  );
}

function DocumentFees() {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => leavingApi.documentFees().then(setRows), []);
  useEffect(() => { load(); }, [load]);
  return (
    <section className="space-y-3 pt-6">
      <h2 className="section-title">Document fees</h2>
      <p className="text-sm text-slate-400">
        Charged online when a student requests the document (₹0 = free). Bonafide and NOC are free for current students.
        These start as placeholder amounts; set the college's actual fees.
      </p>
      {!rows ? <p className="text-sm text-slate-400">Loading…</p>
        : <ul className="space-y-2">{rows.map((r) => <DocumentFeeRow key={r.doc_type} r={r} onSaved={load} />)}</ul>}
    </section>
  );
}

export default function FeeSettings() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null); // id | 'new'
  const load = useCallback(() => joiningApi.feeHeads().then(setRows), []);
  useEffect(() => { load(); }, [load]);
  const required = (rows || []).filter((r) => r.active && !r.optional).reduce((n, r) => n + r.amount, 0);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-4xl space-y-4 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Services · fee settings" title="College fees and document fees." />
      <h2 className="section-title">Joining fees</h2>
      <p className="text-sm text-slate-400">
        Tuition is paid on the TGEAPCET counselling portal; these are the college's own fees. Every new joinee pays the active
        required fees (currently <b className="text-white">{rupees(required)}</b>) plus any optional ones they choose.
      </p>
      {rows?.some((r) => /demo amount/i.test(r.description || '')) && (
        <p className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">Some fees still have demo amounts. Replace them with the college's actual fees before students pay.</p>
      )}
      {editing === 'new'
        ? <FeeForm initial={EMPTY} onCancel={() => setEditing(null)} onSave={async (d) => { await joiningApi.addFeeHead(d); setEditing(null); load(); }} />
        : <button className={btnPrimary} onClick={() => setEditing('new')}>Add a fee</button>}
      {!rows ? <p className="text-sm text-slate-400">Loading…</p> : (
        <ul className="space-y-2">
          {rows.map((r) => editing === r.id ? (
            <li key={r.id}><FeeForm initial={r} onCancel={() => setEditing(null)} onSave={async (d) => { await joiningApi.saveFeeHead(r.id, d); setEditing(null); load(); }} /></li>
          ) : (
            <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 px-4 py-3 ${r.active ? '' : 'opacity-50'}`}>
              <div>
                <p className="font-semibold text-white">{r.name} {r.optional && <span className="text-xs font-normal text-slate-400">· optional</span>} {!r.active && <span className="text-xs font-normal text-slate-500">· inactive</span>}</p>
                {r.description && <p className="text-xs text-slate-400">{r.description}</p>}
              </div>
              <div className="flex items-center gap-3"><span className="font-semibold text-white">{rupees(r.amount)}</span><button className={btnGhost} onClick={() => setEditing(r.id)}>Edit</button></div>
            </li>
          ))}
        </ul>
      )}
      <DocumentFees />
    </PageTransition>
  );
}
