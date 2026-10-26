// Exam Cell (Controller of Examinations): upload the prepared PC / CMM / transcripts once the
// Principal approves, then record postal or WES dispatch.
import { useCallback, useEffect, useState } from 'react';
import { FileUp, Truck } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { btnPrimary, fmtIst, inputCls } from '../../components/services/requestUi.jsx';
import { servicesApi } from '../../utils/api.js';

function Student({ r }) {
  return (
    <div>
      <p className="font-semibold text-white">{r.doc_name} <span className="font-mono text-xs font-normal text-slate-500">{r.ref_no}</span></p>
      <p className="text-xs text-slate-400">
        {r.student.name} · {r.student.roll_no} · {r.student.department} · {r.purpose}
        {r.details.copies ? ` · ${r.details.copies} ${r.details.copies === '1' ? 'copy' : 'copies'}` : ''}
      </p>
      {r.details.delivery && <p className="text-xs text-slate-300">{r.details.delivery}{r.details.address ? `: ${r.details.address}` : ''}{r.details.wes_ref ? ` · ref ${r.details.wes_ref}` : ''}</p>}
    </div>
  );
}

function UploadRow({ r, onChange }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try { await servicesApi.uploadFinal(r.id, file); onChange(); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <li className="rounded-xl border border-violet-400/30 bg-violet-500/[0.06] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Student r={r} />
        <label className={`${btnPrimary} cursor-pointer`}>
          <FileUp size={14} /> {busy ? 'Uploading…' : 'Upload signed PDF'}
          <input type="file" accept="application/pdf" className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Approved by the Principal · {fmtIst(r.steps[r.steps.length - 1].acted_at)}</p>
      {error && <p className="mt-1 text-sm text-rose-300">{error}</p>}
    </li>
  );
}

function DispatchRow({ r, onChange }) {
  const [tracking, setTracking] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try { await servicesApi.dispatch(r.id, tracking); onChange(); } catch (err) { setError(err.message); }
  };
  return (
    <li className="rounded-xl border border-white/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Student r={r} />
        <form onSubmit={submit} className="flex gap-2">
          <input className={`${inputCls} w-48`} required minLength={3} maxLength={80} placeholder="Tracking / reference no."
            value={tracking} onChange={(e) => setTracking(e.target.value)} />
          <button className={btnPrimary}><Truck size={14} /> Dispatched</button>
        </form>
      </div>
      {error && <p className="mt-1 text-sm text-rose-300">{error}</p>}
    </li>
  );
}

export default function ExamCellDesk() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    servicesApi.examQueue().then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-5xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Exam Cell" title="Prepared documents, uploaded and dispatched." />
      {error === 'Controller of Examinations only' ? (
        <div className="glass rounded-2xl p-6 text-sm text-slate-300">
          This desk is for the <b className="text-white">Controller of Examinations</b>. If that's you, ask the admin to assign
          the role in <b className="text-white">Services → Setup → Approvers</b>.
        </div>
      ) : error && <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-400">Loading…</p>}
      {data && (
        <>
          <section>
            <h2 className="section-title mb-1">Approved · waiting for the document</h2>
            <p className="mb-3 text-xs text-slate-500">Upload the signed PDF from the examination system. The student can download it straight away.</p>
            {data.to_upload.length === 0 ? <div className="glass rounded-2xl p-6 text-center text-sm text-slate-400">Nothing to upload.</div>
              : <ul className="space-y-2">{data.to_upload.map((r) => <UploadRow key={r.id} r={r} onChange={load} />)}</ul>}
          </section>
          <section>
            <h2 className="section-title mb-1">To post or send to WES / ECE</h2>
            <p className="mb-3 text-xs text-slate-500">Record the India Post or courier tracking number once the sealed envelope leaves.</p>
            {data.to_dispatch.length === 0 ? <div className="glass rounded-2xl p-6 text-center text-sm text-slate-400">Nothing to dispatch.</div>
              : <ul className="space-y-2">{data.to_dispatch.map((r) => <DispatchRow key={r.id} r={r} onChange={load} />)}</ul>}
          </section>
        </>
      )}
    </PageTransition>
  );
}
