// New student's joining journey after TGEAPCET counselling: details -> documents -> office
// verification -> college fees -> original TC -> enrolment (the six Campus Passport stamps).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, FileUp, Trash2 } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import {
  AdmissionBadge, DOC_STATUS, DocViewer, PassportStamps, TestCheckout, rupees,
} from '../../components/joining/joiningUi.jsx';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';
import { joiningApi } from '../../utils/api.js';

const EDITABLE = ['draft', 'needs_changes'];
const FIELDS = [
  { key: 'hall_ticket_no', label: 'TGEAPCET hall ticket no.', group: 'allot' },
  { key: 'eapcet_rank', label: 'TGEAPCET rank', type: 'number', group: 'allot' },
  { key: 'allotment_no', label: 'Allotment order no.', group: 'allot' },
  { key: 'counselling_phase', label: 'Counselling phase (optional)', group: 'allot', optional: true, placeholder: 'Phase 1 / Final phase' },
  { key: 'branch', label: 'Allotted branch', type: 'select', options: 'branches', group: 'allot' },
  { key: 'category', label: 'Category', type: 'select', options: 'categories', group: 'allot' },
  { key: 'tuition_paid_on_portal', label: 'Tuition paid on the portal (₹)', type: 'number', group: 'allot' },
  { key: 'full_name', label: 'Full name (as in SSC memo)', group: 'personal' },
  { key: 'date_of_birth', label: 'Date of birth', type: 'date', group: 'personal' },
  { key: 'gender', label: 'Gender', type: 'select', options: 'genders', group: 'personal' },
  { key: 'father_name', label: "Father's name", group: 'personal' },
  { key: 'mother_name', label: "Mother's name", group: 'personal' },
  { key: 'phone', label: 'Mobile number', group: 'personal', placeholder: '98480 12345' },
  { key: 'ssc_board_year', label: 'SSC board & year', group: 'personal', placeholder: 'BSE Telangana, 2024' },
  { key: 'inter_board_year', label: 'Intermediate board & year', group: 'personal', placeholder: 'TSBIE, 2026' },
  { key: 'address', label: 'Address', type: 'textarea', group: 'personal' },
];

function Section({ n, title, children, muted }) {
  return (
    <section className={`glass rounded-2xl p-5 ${muted ? 'opacity-60' : ''}`}>
      <h2 className="section-title mb-4"><span className="mr-2 text-cyan-300">{n}.</span>{title}</h2>
      {children}
    </section>
  );
}

export default function JoiningJourney() {
  const [config, setConfig] = useState(null);
  const [app, setApp] = useState(undefined);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState({ text: '', bad: false });
  const [busy, setBusy] = useState('');
  const [viewing, setViewing] = useState(null);
  const [optional, setOptional] = useState([]);
  const [boarding, setBoarding] = useState('');
  const [checkout, setCheckout] = useState(null);
  const fileInputs = useRef({});

  const flash = (text, bad = false) => setMsg({ text, bad });
  const apply = useCallback((a) => {
    setApp(a);
    if (a) setForm({ ...a.details });
  }, []);
  const load = useCallback(() => joiningApi.mine().then(apply).catch((e) => flash(e.message, true)), [apply]);

  useEffect(() => {
    joiningApi.config().then(setConfig).catch((e) => flash(e.message, true));
    load();
  }, [load]);

  const editable = app && EDITABLE.includes(app.status);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const run = async (key, fn, okText) => {
    setBusy(key);
    flash('');
    try { const res = await fn(); if (res !== undefined) apply(res?.application || res); if (okText) flash(okText); } catch (e) { flash(e.message, true); } finally { setBusy(''); }
  };

  const saveDetails = () => run('details', () => joiningApi.saveDetails({
    ...form,
    eapcet_rank: form.eapcet_rank === '' || form.eapcet_rank == null ? null : Number(form.eapcet_rank),
    tuition_paid_on_portal: form.tuition_paid_on_portal === '' || form.tuition_paid_on_portal == null ? null : Number(form.tuition_paid_on_portal),
    date_of_birth: form.date_of_birth || null,
  }), 'Details saved.');

  const required = useMemo(() => (app?.checklist || []).filter((c) => c.required), [app]);
  const readyToSubmit = app && !app.missing_fields.length && required.every((c) => c.upload && c.upload.status !== 'rejected');
  const feeHeads = config?.fee_heads || [];
  const total = feeHeads.filter((h) => !h.optional || optional.includes(h.id)).reduce((n, h) => n + h.amount, 0);
  const busChosen = feeHeads.some((h) => h.optional && optional.includes(h.id) && /bus/i.test(h.name));
  const paidPayments = (app?.payments || []).filter((p) => p.status === 'paid');
  const acks = [...new Set((app?.originals || []).map((o) => o.ack_no).filter(Boolean))];

  if (app === undefined || !config) {
    return <PageTransition className="mx-auto min-h-screen max-w-5xl px-4 pb-20 pt-28"><p className="text-sm text-slate-400">Loading…</p></PageTransition>;
  }

  return (
    <PageTransition className="mx-auto min-h-screen max-w-5xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow={`Joining · ${config.academic_year}`} title="Welcome to MVSR. Let's get you enrolled." />
      {msg.text && <p className={`rounded-lg border px-3 py-2 text-sm ${msg.bad ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>{msg.text}</p>}

      {!app ? (
        <section className="glass rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white">Allotted a seat at MVSR through TGEAPCET counselling?</h2>
          <p className="mt-2 text-sm text-slate-300">
            After paying the tuition fee and self-reporting on the counselling portal, complete your joining here:
            upload your documents, get them verified, pay the college fees and hand in your original TC. Each step stamps your Campus Passport.
          </p>
          <button className={`${btnPrimary} mt-4`} disabled={busy === 'start'} onClick={() => run('start', joiningApi.start)}>Start joining</button>
        </section>
      ) : (
        <>
          <section className="glass rounded-2xl p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">Campus Passport</h2>
              <AdmissionBadge status={app.status} />
            </div>
            <PassportStamps progress={app.progress} />
            <p className="mt-3 text-xs text-slate-500">Tip: on the <Link to="/" className="text-cyan-300 hover:underline">campus twin</Link>, follow the glowing pin to your next stop.</p>
          </section>

          {app.status === 'needs_changes' && (
            <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-4 text-sm text-amber-100">
              <p className="font-bold">The Admin Office asked for changes</p>
              {app.office_remarks && <p className="mt-1">{app.office_remarks}</p>}
              <ul className="mt-1 list-disc pl-5">
                {app.checklist.filter((c) => c.upload?.status === 'rejected').map((c) => <li key={c.key}><b>{c.label}:</b> {c.upload.remarks}</li>)}
              </ul>
            </div>
          )}

          <Section n={1} title="Joining details">
            {['allot', 'personal'].map((group) => (
              <div key={group} className="mb-4">
                <p className={`${labelCls} mb-2 text-cyan-300`}>{group === 'allot' ? 'From your TGEAPCET allotment' : 'Personal details (as in your SSC memo)'}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {FIELDS.filter((f) => f.group === group).map((f) => (
                    <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <label className={labelCls}>{f.label}</label>
                      {f.type === 'select' ? (
                        <select className={inputCls} value={form[f.key] || ''} onChange={set(f.key)} disabled={!editable}>
                          <option value="">Select</option>
                          {config[f.options].map((o) => <option key={o} value={o}>{f.options === 'genders' ? o[0].toUpperCase() + o.slice(1) : o}</option>)}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea className={inputCls} rows={2} maxLength={400} value={form[f.key] || ''} onChange={set(f.key)} disabled={!editable} />
                      ) : (
                        <input className={inputCls} type={f.type || 'text'} value={form[f.key] ?? ''} onChange={set(f.key)} disabled={!editable} placeholder={f.placeholder} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="mb-4 flex flex-wrap gap-5 text-sm text-slate-200">
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.fee_reimbursement} onChange={set('fee_reimbursement')} disabled={!editable} /> I'm applying for fee reimbursement (TS ePASS)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.other_board} onChange={set('other_board')} disabled={!editable} /> My Intermediate was outside the Telangana board</label>
            </div>
            {editable && <button className={btnPrimary} disabled={busy === 'details'} onClick={saveDetails}>{busy === 'details' ? 'Saving…' : 'Save details'}</button>}
            {app.missing_fields.length > 0 && <p className="mt-2 text-xs text-amber-300">Still needed: {app.missing_fields.join(', ')}</p>}
          </Section>

          <Section n={2} title="Documents">
            <p className="mb-3 text-xs text-slate-400">Clear scans or photos, PDF/JPG/PNG, up to 5 MB each. The list depends on your category and the options above — save your details first.</p>
            <ul className="space-y-2">
              {app.checklist.map((c) => {
                const up = c.upload;
                return (
                  <li key={c.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{c.label} {!c.required && <span className="text-xs font-normal text-slate-500">(optional)</span>}</p>
                      {c.hint && <p className="text-xs text-slate-500">{c.hint}</p>}
                      {up ? (
                        <p className={`text-xs ${DOC_STATUS[up.status].cls}`}>{DOC_STATUS[up.status].label}{up.remarks ? ` — ${up.remarks}` : ''} · {up.original_name}</p>
                      ) : <p className="text-xs text-amber-300">{c.required ? 'Not uploaded' : 'Not uploaded (optional)'}</p>}
                    </div>
                    <div className="flex gap-1.5">
                      {up && <button className={btnGhost} onClick={() => setViewing(up)}><Eye size={14} /> View</button>}
                      {editable && up?.status !== 'accepted' && (
                        <>
                          <input type="file" accept={c.images_only ? 'image/png,image/jpeg' : 'application/pdf,image/png,image/jpeg'} className="hidden"
                            ref={(el) => { fileInputs.current[c.key] = el; }}
                            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) run(`up-${c.key}`, () => joiningApi.uploadDoc(c.key, file), `${c.label} uploaded.`); }} />
                          <button className={btnPrimary} disabled={busy === `up-${c.key}`} onClick={() => fileInputs.current[c.key]?.click()}>
                            <FileUp size={14} /> {busy === `up-${c.key}` ? 'Uploading…' : up ? 'Replace' : 'Upload'}
                          </button>
                          {up && <button className={btnGhost} aria-label="Remove" onClick={() => run(`rm-${c.key}`, () => joiningApi.removeDoc(c.key))}><Trash2 size={14} /></button>}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {editable && (
              <div className="mt-4">
                <button className={btnPrimary} disabled={!readyToSubmit || busy === 'submit'} onClick={() => run('submit', joiningApi.submit, 'Sent to the Admin Office for verification.')}>
                  {app.status === 'needs_changes' ? 'Resubmit to the Admin Office' : 'Submit to the Admin Office'}
                </button>
                {!readyToSubmit && <p className="mt-2 text-xs text-slate-500">Fill in every detail and upload every required document to submit.</p>}
              </div>
            )}
            {!editable && <p className="mt-3 text-sm text-slate-300">{app.status === 'submitted' ? 'Submitted — the Admin Office is checking your documents.' : 'Your documents are verified.'}</p>}
          </Section>

          <Section n={3} title="College fees" muted={editable}>
            {editable ? <p className="text-sm text-slate-400">Available after you submit your application.</p>
              : paidPayments.length ? (
                <div className="space-y-2">
                  {paidPayments.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm">
                      <span className="text-emerald-200">Paid {rupees(p.amount)} · {p.receipt_no}{p.provider === 'test' ? ' · test mode' : ''}</span>
                      <button className={btnGhost} onClick={() => joiningApi.receipt(p.id, p.receipt_no).catch((e) => flash(e.message, true))}><Download size={14} /> Receipt</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <ul className="space-y-1.5 text-sm">
                    {feeHeads.map((h) => (
                      <li key={h.id} className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2">
                        <label className="flex items-center gap-2 text-slate-200">
                          {h.optional
                            ? <input type="checkbox" checked={optional.includes(h.id)} onChange={(e) => setOptional((o) => e.target.checked ? [...o, h.id] : o.filter((x) => x !== h.id))} />
                            : <span className="inline-block w-4" />}
                          {h.name}{h.optional && <span className="text-xs text-slate-500">(optional)</span>}
                        </label>
                        <span className="text-slate-200">{rupees(h.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  {busChosen && (
                    <div className="mt-3 max-w-sm">
                      <label className={labelCls}>Bus boarding point</label>
                      <input className={inputCls} value={boarding} onChange={(e) => setBoarding(e.target.value)} maxLength={80} placeholder="e.g. LB Nagar" />
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button className={btnPrimary} disabled={!total || busy === 'pay' || (busChosen && !boarding.trim())}
                      onClick={() => run('pay', async () => { setCheckout(await joiningApi.createPayment({ optional_fee_head_ids: optional, bus_boarding_point: busChosen ? boarding : null })); })}>
                      Pay {rupees(total)}
                    </button>
                    {config.payment_mode === 'test' && <span className="text-xs text-amber-300">Test mode — no real money</span>}
                  </div>
                  {(app.payments || []).some((p) => p.status === 'failed') && <p className="mt-2 text-xs text-rose-300">A previous payment attempt failed. You can try again.</p>}
                </div>
              )}
          </Section>

          <Section n={4} title="Original certificates" muted={editable}>
            {app.originals.length ? (
              <>
                <ul className="space-y-1.5 text-sm">
                  {app.originals.map((o) => (
                    <li key={o.id} className="flex justify-between rounded-lg border border-white/5 px-3 py-2 text-slate-200">
                      <span>{o.label}</span>
                      <span className={o.status === 'held' ? 'text-emerald-300' : o.status === 'out' ? 'text-amber-300' : 'text-slate-400'}>
                        {o.status === 'held' ? 'With the college' : o.status === 'out' ? `Lent to you · due back ${o.due_back}` : 'Returned to you'}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {acks.map((a) => <button key={a} className={btnGhost} onClick={() => joiningApi.acknowledgement(a).catch((e) => flash(e.message, true))}><Download size={14} /> Acknowledgement {a}</button>)}
                </div>
              </>
            ) : <p className="text-sm text-slate-300">Hand in your <b>original Transfer Certificate</b> at the Admin Office (Civil &amp; IT Block). Your acknowledgement slip will appear here.</p>}
          </Section>

          <Section n={5} title="Enrolment" muted={app.status !== 'enrolled'}>
            {app.status === 'enrolled' ? (
              <div className="text-sm text-slate-200">
                <p className="text-lg font-bold text-emerald-300">You're enrolled! 🎓</p>
                <p className="mt-1">Roll no. <b>{app.roll_no}</b> · {app.details.branch} · Section <b>{app.section}</b></p>
                <Link to="/services" className={`${btnPrimary} mt-3`}>Go to Student Services</Link>
              </div>
            ) : <p className="text-sm text-slate-400">The Admin Office assigns your roll number, section and mentor once your documents are verified, fees are paid and your TC is handed in.</p>}
          </Section>
        </>
      )}

      {viewing && <DocViewer doc={viewing} onClose={() => setViewing(null)} />}
      {checkout && (
        <TestCheckout payment={checkout} onClose={() => setCheckout(null)}
          onDone={(p) => { setCheckout(null); flash(p.status === 'paid' ? `Payment successful · receipt ${p.receipt_no}` : 'Payment failed. Nothing was charged — please try again.', p.status !== 'paid'); load(); }} />
      )}
    </PageTransition>
  );
}
