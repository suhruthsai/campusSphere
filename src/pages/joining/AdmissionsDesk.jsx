// Admin Office desk for new joinees: review documents, verify or send back, record originals
// handed in (with an acknowledgement slip) and enrol (roll no., section, mentor).
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Download, Eye, X } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import {
  AdmissionBadge, DOC_STATUS, DocViewer, PassportStamps, rupees,
} from '../../components/joining/joiningUi.jsx';
import { btnGhost, btnPrimary, fmtIst, inputCls, labelCls } from '../../components/services/requestUi.jsx';
import { joiningApi } from '../../utils/api.js';

const FILTERS = [
  ['submitted', 'To review'], ['needs_changes', 'Sent back'], ['verified', 'Verified'], ['enrolled', 'Enrolled'], ['draft', 'Drafts'], ['', 'All'],
];
const DETAIL_LABELS = {
  hall_ticket_no: 'Hall ticket', eapcet_rank: 'Rank', allotment_no: 'Allotment no.', counselling_phase: 'Phase',
  branch: 'Branch', category: 'Category', quota: 'Quota', tuition_paid_on_portal: 'Tuition paid on portal (₹)',
  full_name: 'Name', date_of_birth: 'Date of birth', gender: 'Gender', father_name: 'Father', mother_name: 'Mother',
  phone: 'Mobile', ssc_board_year: 'SSC', inter_board_year: 'Intermediate', address: 'Address',
  fee_reimbursement: 'Fee reimbursement', other_board: 'Other board',
};

function DocRow({ c, canReview, onView, onReview }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const up = c.upload;
  return (
    <li className="rounded-xl border border-white/5 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{c.label} {!c.required && <span className="text-xs font-normal text-slate-500">(optional)</span>}</p>
          {up ? <p className={`text-xs ${DOC_STATUS[up.status].cls}`}>{DOC_STATUS[up.status].label}{up.remarks ? ` — ${up.remarks}` : ''}{up.reviewed_by ? ` · ${up.reviewed_by}` : ''}</p>
            : <p className="text-xs text-amber-300">Not uploaded</p>}
        </div>
        {up && (
          <div className="flex gap-1.5">
            <button className={btnGhost} onClick={() => onView(up)}><Eye size={14} /> View</button>
            {canReview && up.status !== 'accepted' && <button className={btnPrimary} onClick={() => onReview(up.id, 'accepted')}><Check size={14} /> Accept</button>}
            {canReview && up.status !== 'rejected' && <button className={btnGhost} onClick={() => setRejecting(true)}><X size={14} /> Reject</button>}
          </div>
        )}
      </div>
      {rejecting && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input className={`${inputCls} flex-1`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="What's wrong? The student will see this." />
          <button className={btnPrimary} disabled={reason.trim().length < 5} onClick={() => { onReview(up.id, 'rejected', reason); setRejecting(false); setReason(''); }}>Reject</button>
          <button className={btnGhost} onClick={() => setRejecting(false)}>Cancel</button>
        </div>
      )}
    </li>
  );
}

function Application({ id, config, mentors, onBack }) {
  const [app, setApp] = useState(null);
  const [msg, setMsg] = useState({ text: '', bad: false });
  const [viewing, setViewing] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [originals, setOriginals] = useState(['tc']);
  const [enrol, setEnrol] = useState({ roll_no: '', section: '', mentor_id: '' });

  const load = useCallback(() => joiningApi.application(id).then(setApp).catch((e) => setMsg({ text: e.message, bad: true })), [id]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn, ok) => {
    setMsg({ text: '', bad: false });
    try { const res = await fn(); setApp(res.application || res); if (ok) setMsg({ text: typeof ok === 'function' ? ok(res) : ok, bad: false }); } catch (e) { setMsg({ text: e.message, bad: true }); }
  };
  if (!app) return <p className="text-sm text-slate-400">Loading…</p>;

  const held = new Set(app.originals.filter((o) => o.status !== 'returned').map((o) => o.doc_key));
  const d = app.details;
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> All applications</button>
      {msg.text && <p className={`rounded-lg border px-3 py-2 text-sm ${msg.bad ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>{msg.text}</p>}

      <section className="glass rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white">{d.full_name || app.account?.name}</h2>
            <p className="text-sm text-slate-400">{app.account?.email} · {d.branch || 'branch?'} · rank {d.eapcet_rank || '—'} · {d.category || '—'}</p>
          </div>
          <AdmissionBadge status={app.status} />
        </div>
        <PassportStamps progress={app.progress} />
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {Object.entries(DETAIL_LABELS).map(([k, label]) => (
            <div key={k} className={k === 'address' ? 'col-span-2 sm:col-span-3' : ''}>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className="text-slate-200">{typeof d[k] === 'boolean' ? (d[k] ? 'Yes' : 'No') : (d[k] ?? '—')}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="glass rounded-2xl p-5">
        <h3 className="section-title mb-3">Documents</h3>
        <ul className="space-y-2">
          {app.checklist.map((c) => (
            <DocRow key={c.key} c={c} canReview={app.status === 'submitted'} onView={setViewing}
              onReview={(docId, status, why) => run(() => joiningApi.review(docId, status, why))} />
          ))}
        </ul>
        {app.status === 'submitted' && (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <button className={btnPrimary} onClick={() => run(() => joiningApi.verify(app.id), 'Documents verified.')}>Mark verified</button>
            <input className={`${inputCls} max-w-md`} value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} placeholder="Note for the student (when sending back)" />
            <button className={btnGhost} onClick={() => run(() => joiningApi.sendBack(app.id, remarks), 'Sent back to the student.')}>Send back for changes</button>
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h3 className="section-title mb-1">Fees</h3>
        {app.paid ? app.payments.filter((p) => p.status === 'paid').map((p) => (
          <div key={p.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-emerald-200">
            <span>Paid {rupees(p.amount)} · {p.receipt_no} · {fmtIst(p.paid_at)}{p.provider === 'test' ? ' · test mode' : ''}{p.details?.bus_boarding_point ? ` · bus from ${p.details.bus_boarding_point}` : ''}</span>
            <button className={btnGhost} onClick={() => joiningApi.receipt(p.id, p.receipt_no)}><Download size={14} /> Receipt</button>
          </div>
        )) : <p className="text-sm text-amber-300">Not paid yet.</p>}
      </section>

      <section className="glass rounded-2xl p-5">
        <h3 className="section-title mb-3">Original certificates handed in</h3>
        {app.status === 'draft' || app.status === 'needs_changes' ? <p className="text-sm text-slate-400">Available once the student submits.</p> : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {config.originals.map((o) => (
                <label key={o.key} className={`flex items-center gap-2 rounded-lg border border-white/5 px-3 py-2 text-sm ${held.has(o.key) ? 'text-emerald-300' : 'text-slate-200'}`}>
                  <input type="checkbox" disabled={held.has(o.key)} checked={held.has(o.key) || originals.includes(o.key)}
                    onChange={(e) => setOriginals((list) => e.target.checked ? [...list, o.key] : list.filter((k) => k !== o.key))} />
                  {o.label}{held.has(o.key) && ' · with the college'}
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={btnPrimary} disabled={!originals.some((k) => !held.has(k))}
                onClick={() => run(() => joiningApi.receiveOriginals(app.id, originals.filter((k) => !held.has(k))), (res) => `Recorded · acknowledgement ${res.ack_no}`)}>
                Record received
              </button>
              {[...new Set(app.originals.map((o) => o.ack_no).filter(Boolean))].map((a) => (
                <button key={a} className={btnGhost} onClick={() => joiningApi.acknowledgement(a)}><Download size={14} /> {a}</button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h3 className="section-title mb-3">Enrolment</h3>
        {app.status === 'enrolled' ? (
          <p className="text-sm text-emerald-200">Enrolled · roll no. <b>{app.roll_no}</b> · Section {app.section} · {fmtIst(app.enrolled_at)}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-4">
            <div><label className={labelCls}>Roll no.</label><input className={inputCls} value={enrol.roll_no} onChange={(e) => setEnrol((x) => ({ ...x, roll_no: e.target.value }))} placeholder="1602-26-733-001" /></div>
            <div><label className={labelCls}>Section</label><input className={inputCls} value={enrol.section} maxLength={10} onChange={(e) => setEnrol((x) => ({ ...x, section: e.target.value }))} placeholder="A" /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Mentor</label>
              <select className={inputCls} value={enrol.mentor_id} onChange={(e) => setEnrol((x) => ({ ...x, mentor_id: e.target.value }))}>
                <option value="">Assign later</option>
                {mentors.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.department}</option>)}
              </select>
            </div>
            <div className="sm:col-span-4">
              <button className={btnPrimary} disabled={app.status !== 'verified' || !enrol.roll_no || !enrol.section}
                onClick={() => run(() => joiningApi.enroll(app.id, { ...enrol, mentor_id: enrol.mentor_id || null }), 'Enrolled. Their certificate profile is ready.')}>
                Enrol student
              </button>
              <p className="mt-2 text-xs text-slate-500">Needs: documents verified, fees paid, original TC recorded.</p>
            </div>
          </div>
        )}
      </section>

      {viewing && <DocViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

export default function AdmissionsDesk() {
  const [filter, setFilter] = useState('submitted');
  const [rows, setRows] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [config, setConfig] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    joiningApi.config().then(setConfig).catch((e) => setError(e.message));
    joiningApi.mentors().then(setMentors).catch(() => {});
  }, []);
  useEffect(() => {
    if (openId) return;
    setRows(null);
    joiningApi.applications(filter ? { status: filter } : {}).then(setRows).catch((e) => setError(e.message));
  }, [filter, openId]);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl space-y-4 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Admin Office · admissions desk" title="New joinees: verify, collect, enrol." />
      {error && <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
      {openId && config ? (
        <Application id={openId} config={config} mentors={mentors} onBack={() => setOpenId(null)} />
      ) : (
        <>
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {FILTERS.map(([v, label]) => (
              <button key={label} onClick={() => setFilter(v)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${filter === v ? 'bg-cyan-400 text-slate-900' : 'text-slate-300 hover:bg-white/5'}`}>{label}</button>
            ))}
          </div>
          {!rows ? <p className="text-sm text-slate-400">Loading…</p> : rows.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">No applications here.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <button key={r.id} onClick={() => setOpenId(r.id)} className="glass-card flex w-full flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-left">
                  <div>
                    <p className="font-semibold text-white">{r.full_name || 'Unnamed'} <span className="font-normal text-slate-500">· {r.branch || '—'} · rank {r.eapcet_rank || '—'} · {r.category || '—'}</span></p>
                    <p className="text-xs text-slate-400">
                      Docs: {r.docs.accepted} accepted, {r.docs.pending} pending{r.docs.rejected ? `, ${r.docs.rejected} rejected` : ''}
                      {' · '}{r.paid ? 'fees paid' : 'fees due'}{' · '}{r.tc_in ? 'TC in' : 'TC not in'}
                      {r.submitted_at ? ` · submitted ${fmtIst(r.submitted_at)}` : ''}
                    </p>
                  </div>
                  <AdmissionBadge status={r.status} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </PageTransition>
  );
}
