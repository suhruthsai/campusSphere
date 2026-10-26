// Approver view (mentor, class in-charge, AHOD, HOD, principal; admins can step in):
// requests waiting at my desk, everyone's queue (admins) and what I've acted on.
import { useCallback, useEffect, useState } from 'react';
import { Check, Download, Inbox, RefreshCw, X } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import {
  RequestTimeline, StatusBadge, btnGhost, btnPrimary, fmtIst, fmtWaiting, inputCls, whereNow,
} from '../../components/services/requestUi.jsx';
import { servicesApi } from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

function RequestCard({ req, onDone, showActions }) {
  const [mode, setMode] = useState(null); // 'approve' | 'reject'
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = req.student || {};

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'approve') await servicesApi.approve(req.id, remarks);
      else await servicesApi.reject(req.id, remarks);
      setMode(null);
      setRemarks('');
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="glass rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-white">{req.doc_name}</h3>
            <StatusBadge status={req.status} />
            {req.overdue && <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">Overdue</span>}
          </div>
          <p className="text-sm text-slate-200">
            <b>{s.name}</b> · {s.roll_no} · {s.department} {['I', 'II', 'III', 'IV'][(s.year || 1) - 1]} Year · Sec {s.section}
          </p>
          <p className="text-sm text-slate-300">
            Purpose: {req.purpose === 'Other' ? req.details.purpose_details : req.purpose}
            {req.details.organization ? ` · ${req.details.organization}` : ''}
            {req.details.location ? `, ${req.details.location}` : ''}
            {req.details.from_date ? ` · ${req.details.from_date} → ${req.details.to_date}` : ''}
            {req.details.copies ? ` · ${req.details.copies} ${req.details.copies === '1' ? 'copy' : 'copies'}` : ''}
            {req.details.delivery ? ` · ${req.details.delivery}` : ''}
            {req.amount > 0 ? ` · fee ₹${req.amount} paid` : ''}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">{req.ref_no} · requested {fmtIst(req.created_at)}</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-semibold text-slate-200">{whereNow(req)}</p>
          {req.status === 'in_review' && <p className={req.overdue ? 'text-rose-300' : 'text-slate-500'}>at this desk {fmtWaiting(req.waiting_hours)}</p>}
        </div>
      </div>

      <RequestTimeline req={req} />

      {showActions && req.can_act && (
        <div className="mt-4">
          {!mode ? (
            <div className="flex flex-wrap gap-2">
              <button className={btnPrimary} onClick={() => setMode('approve')}><Check size={15} /> Approve</button>
              <button className={`${btnGhost} hover:border-rose-400/50 hover:text-rose-200`} onClick={() => setMode('reject')}><X size={15} /> Reject</button>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-white/10 p-3">
              <textarea className={inputCls} rows={2} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)}
                placeholder={mode === 'approve' ? 'Remarks (optional)' : 'Reason for rejection — the student will see this'} />
              {error && <p className="text-sm text-rose-300">{error}</p>}
              <div className="flex gap-2">
                <button className={mode === 'approve' ? btnPrimary : `${btnPrimary} bg-rose-400 hover:bg-rose-300`} disabled={busy || (mode === 'reject' && remarks.trim().length < 5)} onClick={submit}>
                  {busy ? 'Saving…' : mode === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
                </button>
                <button className={btnGhost} onClick={() => { setMode(null); setError(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {req.status === 'approved' && (
        <button className={`${btnGhost} mt-4`} onClick={() => servicesApi.downloadPdf(req.id, req.ref_no).catch((e) => setError(e.message))}><Download size={15} /> Download PDF</button>
      )}
    </article>
  );
}

export default function ApprovalsInbox() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('mine');
  const [inbox, setInbox] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    servicesApi.inbox().then(setInbox).catch((e) => setError(e.message));
    servicesApi.history().then(setHistory).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const tabs = [
    { id: 'mine', label: 'Waiting for you', count: inbox?.mine.length },
    ...(isAdmin ? [{ id: 'others', label: "Everyone's queue", count: inbox?.others.length }] : []),
    { id: 'history', label: 'History', count: history?.length },
  ];
  const list = tab === 'history' ? history : inbox?.[tab];

  return (
    <PageTransition className="mx-auto min-h-screen max-w-5xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Approvals" title="Certificates waiting for your signature." />
      {error && <p className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === t.id ? 'bg-cyan-400 text-slate-900' : 'text-slate-300 hover:bg-white/5'}`}>
              {t.label}{t.count != null ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {tab === 'others' && <p className="mb-3 text-xs text-slate-400">As admin you can act on any step, for example when an approver is on leave. Your action is recorded as an admin override.</p>}

      {!list ? <p className="text-sm text-slate-400">Loading…</p>
        : list.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">
            <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-500" />
            {tab === 'history' ? "You haven't acted on any requests yet." : 'Nothing waiting. All caught up.'}
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((r) => <RequestCard key={r.id} req={r} onDone={load} showActions={tab !== 'history'} />)}
          </div>
        )}
    </PageTransition>
  );
}
