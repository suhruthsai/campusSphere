// A building's service counter: the documents issued there and the request form.
// Opened from the 3D twin (click a building) and from the My Requests page.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Lock, X } from 'lucide-react';
import { leavingApi, servicesApi } from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ProfileForm from './ProfileForm.jsx';
import { TestCheckout, rupees } from '../joining/joiningUi.jsx';
import { RequestTimeline, btnGhost, btnPrimary, inputCls, labelCls, whereNow } from './requestUi.jsx';

export const COUNTER_NAMES = { civilit: 'Admin Office', placement: 'Placement Cell', exam: 'Exam Cell' };

/** A field with show_if is shown (and then required) only when the other answers match. */
const isShown = (f, details) => !f.show_if || Object.entries(f.show_if).every(([k, v]) => details[k] === v);

/** The fee checkout for a request that's waiting for payment. */
export function requestPayment(req) {
  return { id: req.payment_id, amount: req.amount, items: [{ name: req.doc_name, amount: req.amount }] };
}

export default function ServiceCounter({ counterId, onClose, onCreated }) {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const [catalog, setCatalog] = useState(null);
  const [profile, setProfile] = useState(null);
  const [docId, setDocId] = useState(null);
  const [purpose, setPurpose] = useState('');
  const [details, setDetails] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    servicesApi.catalog().then(setCatalog).catch((e) => setError(e.message));
    if (isStudent) servicesApi.myProfile().then(setProfile).catch((e) => setError(e.message));
  }, [isStudent]);

  const docs = useMemo(() => (catalog || []).filter((d) => d.counter === counterId), [catalog, counterId]);
  useEffect(() => {
    const open = docs.filter((d) => !d.unavailable_reason);
    if (docs.length === 1 && open.length === 1) setDocId(open[0].id);
  }, [docs]);
  const doc = docs.find((d) => d.id === docId);
  const needsDates = doc?.dated_purposes?.includes(purpose);
  const copies = doc?.per_copy ? Math.max(1, parseInt(details.copies, 10) || 1) : 1;
  const total = doc ? doc.fee * copies : 0;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !paying) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, paying]);

  const pick = (id) => {
    setDocId(id);
    setPurpose('');
    setDetails({});
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      // Only send the fields that are showing
      const sent = Object.fromEntries(Object.entries(details).filter(([k]) => {
        const f = doc.fields.find((x) => x.key === k);
        return !f || isShown(f, details);
      }));
      const req = await servicesApi.createRequest({ doc_type: doc.id, purpose, details: sent });
      setCreated(req);
      onCreated?.(req);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const afterPayment = async (pay) => {
    if (pay.status !== 'paid') {
      setError('The payment did not go through. You can try again.');
      setPaying(false);
      return;
    }
    setPaying(false);
    setError('');
    const req = await servicesApi.getRequest(created.id);
    setCreated(req);
    onCreated?.(req);
  };

  const counterName = COUNTER_NAMES[counterId] || 'Service Counter';

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && !paying && onClose()}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141a22] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300">Service counter</p>
            <h2 className="text-xl font-bold text-white">{counterName}</h2>
            <p className="text-xs text-slate-400">Request here · approvals happen online · collect as a signed PDF</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {error && <p className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

          {!isStudent ? (
            <div className="space-y-3 text-sm text-slate-300">
              <p>Documents at this counter: {docs.map((d) => d.name).join(', ') || '—'}.</p>
              <p>Only students and alumni can request documents. Approvers handle requests from their inbox.</p>
              <Link to="/services/approvals" className={btnPrimary} onClick={onClose}>Open approvals inbox <ArrowRight size={15} /></Link>
            </div>
          ) : created ? (
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 ${created.status === 'awaiting_payment' ? 'border-amber-400/30 bg-amber-500/10' : 'border-emerald-400/30 bg-emerald-500/10'}`}>
                <p className={`text-sm font-bold ${created.status === 'awaiting_payment' ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {created.status === 'awaiting_payment' ? 'Request saved · fee due' : 'Request submitted'}
                </p>
                <p className="mt-1 text-sm text-slate-200">{created.doc_name} · {created.purpose}</p>
                <p className="mt-1 font-mono text-xs text-slate-400">Ref. {created.ref_no}</p>
              </div>
              <RequestTimeline req={created} />
              {created.status === 'awaiting_payment' ? (
                <>
                  <p className="text-sm text-slate-300">
                    Pay <b>{rupees(created.amount)}</b> and the request goes straight to the <b>{created.steps[0]?.label}</b>. Unpaid requests can be withdrawn from My requests.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setPaying(true)} className={btnPrimary}>Pay {rupees(created.amount)}</button>
                    <Link to="/services" onClick={onClose} className={btnGhost}>Pay later</Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-300">
                    {whereNow(created)}. Watch the glowing document move across the campus map as each approver signs.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={onClose} className={btnPrimary}>Watch it on the campus map</button>
                    <Link to="/services" onClick={onClose} className={btnGhost}>My requests</Link>
                  </div>
                </>
              )}
            </div>
          ) : !profile || !catalog ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : !profile.complete ? (
            <div>
              <h3 className="mb-2 font-bold text-white">First, your academic details</h3>
              <ProfileForm profile={profile} onSaved={setProfile} />
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {docs.length > 1 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {docs.map((d) => {
                    const locked = !!d.unavailable_reason;
                    return (
                      <button type="button" key={d.id} disabled={locked} onClick={() => pick(d.id)}
                        className={`rounded-xl border p-3 text-left transition ${docId === d.id ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 hover:bg-white/5'} ${locked ? 'cursor-not-allowed opacity-55 hover:bg-transparent' : ''}`}>
                        <p className="flex items-center gap-1.5 font-semibold text-white">
                          {locked && <Lock size={13} className="text-slate-400" />}{d.name}
                          <span className="ml-auto text-xs font-normal text-emerald-300">{d.fee ? `${rupees(d.fee)}${d.per_copy ? '/copy' : ''}` : 'Free'}</span>
                        </p>
                        <p className="text-xs text-slate-400">{locked ? d.unavailable_reason : d.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}
              {docs.length === 1 && docs[0].unavailable_reason && (
                <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <Lock size={15} className="mt-0.5 shrink-0 text-slate-400" />{docs[0].name}: {docs[0].unavailable_reason}
                </p>
              )}
              {docs.some((d) => d.unavailable_reason?.includes('no-dues')) && (
                <Link to="/leaving" onClick={onClose} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline">
                  Leaving the college? Start your no-dues clearance <ArrowRight size={12} />
                </Link>
              )}

              {doc && (
                <>
                  <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <FileText className="mt-0.5 h-5 w-5 text-cyan-300" />
                    <div className="text-sm">
                      <p className="font-semibold text-white">{doc.name}</p>
                      <p className="text-slate-400">{doc.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        For {profile.name} · {profile.roll_no} · {profile.department} {['I', 'II', 'III', 'IV'][profile.year - 1]} Year, Section {profile.section}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Purpose</label>
                    <select className={inputCls} value={purpose} required onChange={(e) => {
                      const next = e.target.value;
                      setPurpose(next);
                      // Dates only belong on purposes whose certificate states a period
                      if (!doc.dated_purposes.includes(next)) {
                        setDetails(({ from_date: _f, to_date: _t, ...rest }) => rest);
                      }
                    }}>
                      <option value="">Select the purpose</option>
                      {doc.purposes.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  {purpose === 'Other' && (
                    <div>
                      <label className={labelCls}>Describe the purpose</label>
                      <input className={inputCls} maxLength={200} required value={details.purpose_details || ''}
                        onChange={(e) => setDetails((d) => ({ ...d, purpose_details: e.target.value }))} />
                    </div>
                  )}
                  {doc.fields.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {doc.fields.filter((f) => (f.type !== 'date' || needsDates) && isShown(f, details)).map((f) => {
                        const required = f.required || !!f.show_if || (f.type === 'date' && needsDates);
                        const set = (e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }));
                        return (
                          <div key={f.key} className={f.show_if ? 'sm:col-span-2' : ''}>
                            <label className={labelCls}>{f.label}{required ? '' : ' (optional)'}</label>
                            {f.type === 'select' ? (
                              <select className={inputCls} required={required} value={details[f.key] || ''} onChange={set}>
                                <option value="">Select</option>
                                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : f.type === 'number' ? (
                              <input type="number" className={inputCls} required={required} min={f.min} max={f.max} step={1}
                                value={details[f.key] || ''} onChange={set} />
                            ) : (
                              <input type={f.type || 'text'} className={inputCls} maxLength={200} required={required}
                                value={details[f.key] || ''} onChange={set} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-xl border border-white/10 p-3">
                    <p className={labelCls}>Approval chain</p>
                    <p className="text-xs text-slate-300">
                      {doc.fee > 0 && <span className="text-amber-200">Fee  →  </span>}
                      {doc.chain.map((c) => c.label).join('  →  ')}
                      {doc.fulfilment === 'upload' && '  →  Exam Cell prepares it'}
                      <span className="text-slate-500"> · each has {doc.sla_hours} h</span>
                    </p>
                    {doc.chain[0]?.role === 'mentor' && profile.mentor_name && <p className="mt-1 text-xs text-slate-500">Your mentor: {profile.mentor_name}</p>}
                  </div>

                  {doc.fee > 0 && (
                    <div className="flex items-center justify-between rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm">
                      <span className="text-amber-100">
                        Fee{doc.per_copy ? ` · ${rupees(doc.fee)} × ${copies} ${copies === 1 ? 'copy' : 'copies'}` : ''}
                        <span className="ml-2 text-[11px] text-amber-200/70">test payment, nothing is charged</span>
                      </span>
                      <b className="text-white">{rupees(total)}</b>
                    </div>
                  )}

                  <button type="submit" className={btnPrimary} disabled={submitting || !purpose}>
                    {submitting ? 'Submitting…' : doc.fee > 0 ? `Continue to pay ${rupees(total)}` : 'Submit request'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
      {paying && created && (
        <TestCheckout payment={requestPayment(created)} completeFn={leavingApi.completeTest}
          onDone={afterPayment} onClose={() => setPaying(false)} />
      )}
    </div>,
    document.body,
  );
}
