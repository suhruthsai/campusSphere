// Student view: academic profile, the service counters and every request with its live timeline.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CreditCard, Download, ExternalLink, FileBadge, LogOut, Receipt, RefreshCw, Undo2 } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import ProfileForm from '../../components/services/ProfileForm.jsx';
import ServiceCounter, { requestPayment } from '../../components/services/ServiceCounter.jsx';
import { TestCheckout } from '../../components/joining/joiningUi.jsx';
import {
  RequestTimeline, StatusBadge, btnGhost, btnPrimary, fmtIst, fmtWaiting, whereNow,
} from '../../components/services/requestUi.jsx';
import { leavingApi, servicesApi } from '../../utils/api.js';

const COUNTERS = [
  { id: 'civilit', name: 'Admin Office', docs: 'Bonafide, TC, Conduct, Course Completion, Medium of Instruction', where: 'Civil & IT Block' },
  { id: 'placement', name: 'Placement Cell', docs: 'No Objection Certificate (NOC)', where: 'Beside the Library' },
  { id: 'exam', name: 'Exam Cell', docs: 'Provisional Certificate, CMM, Official Transcripts', where: 'Examination Department' },
];

export default function MyRequests() {
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState(null);
  const [counter, setCounter] = useState(null);
  const [editProfile, setEditProfile] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [paying, setPaying] = useState(null);

  const load = useCallback(() => {
    servicesApi.myRequests().then(setRequests).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    servicesApi.myProfile().then(setProfile).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const withdraw = async (req) => {
    if (!window.confirm(`Withdraw ${req.ref_no}?`)) return;
    setBusy(req.id);
    try { await servicesApi.cancel(req.id); load(); } catch (e) { setError(e.message); } finally { setBusy(null); }
  };
  const receipt = async (req) => {
    setBusy(req.id);
    try { await leavingApi.receipt(req.payment_id, `Receipt-${req.ref_no}`); } catch (e) { setError(e.message); } finally { setBusy(null); }
  };
  const afterPayment = (pay) => {
    setPaying(null);
    setError(pay.status === 'paid' ? '' : 'The payment did not go through. You can try again.');
    if (pay.status !== 'paid') window.scrollTo({ top: 0, behavior: 'smooth' });   // the message is at the top
    load();
  };
  const download = async (req) => {
    setBusy(req.id);
    try { await servicesApi.downloadPdf(req.id, req.ref_no); } catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Student services" title="Request certificates. Track every signature." />

      {error && <p className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <section className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">My details</h2>
            {profile?.complete && !editProfile && (
              <button className="text-xs font-semibold text-cyan-300 hover:underline" onClick={() => setEditProfile(true)}>Edit</button>
            )}
          </div>
          {!profile ? <p className="text-sm text-slate-400">Loading…</p>
            : (!profile.complete || editProfile) ? (
              <ProfileForm profile={profile} onSaved={(p) => { setProfile(p); setEditProfile(false); }} />
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ['Name', profile.name], ['Roll no.', profile.roll_no],
                  ['Course', `${profile.program} (${profile.department})`],
                  ['Year & section', `${['I', 'II', 'III', 'IV'][profile.year - 1]} Year · ${profile.section}`],
                  ['Parent', profile.parent_name], ['Mentor', profile.mentor_name || 'Not assigned yet'],
                ].map(([k, v]) => (
                  <div key={k}><dt className="text-[11px] uppercase tracking-wider text-slate-500">{k}</dt><dd className="text-slate-200">{v}</dd></div>
                ))}
              </dl>
            )}
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="section-title mb-3">Service counters</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {COUNTERS.map((c) => (
              <button key={c.id} onClick={() => setCounter(c.id)} disabled={!profile}
                className="glass-card rounded-xl p-4 text-left">
                <Building2 className="mb-2 h-5 w-5 text-cyan-300" />
                <p className="font-bold text-white">{c.name}</p>
                <p className="text-xs text-slate-400">{c.where}</p>
                <p className="mt-2 text-sm text-slate-200">{c.docs}</p>
                <span className="mt-3 inline-block text-xs font-semibold text-cyan-300">Open counter →</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Tip: on the <Link to="/" className="text-cyan-300 hover:underline">campus twin</Link>, click the Civil &amp; IT Block, the Placement Cell or the Examination Department to visit its counter.
          </p>
          <Link to="/leaving" className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5">
            <LogOut size={15} className="text-amber-300" />
            <span>Leaving the college? <b className="text-white">No-dues clearance</b> unlocks your TC.</span>
          </Link>
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">My requests</h2>
          <button onClick={load} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        {!requests ? <p className="text-sm text-slate-400">Loading…</p>
          : requests.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">
              <FileBadge className="mx-auto mb-2 h-8 w-8 text-slate-500" />
              No requests yet. Open a service counter to ask for a bonafide or NOC.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <article key={r.id} className="glass rounded-2xl p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-white">{r.doc_name}</h3>
                        <StatusBadge status={r.status} />
                        {r.overdue && <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">Overdue</span>}
                      </div>
                      <p className="text-sm text-slate-300">
                        {r.purpose === 'Other' ? r.details.purpose_details : r.purpose}
                        {r.details.organization ? ` · ${r.details.organization}` : ''}
                        {r.details.copies ? ` · ${r.details.copies} ${r.details.copies === '1' ? 'copy' : 'copies'}` : ''}
                        {r.details.delivery ? ` · ${r.details.delivery}` : ''}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">{r.ref_no} · requested {fmtIst(r.created_at)}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold text-slate-200">{whereNow(r)}</p>
                      {r.status === 'in_review' && <p className={r.overdue ? 'text-rose-300' : 'text-slate-500'}>waiting {fmtWaiting(r.waiting_hours)}</p>}
                      {r.status === 'approved' && <p className="text-slate-500">issued {fmtIst(r.issued_at)}</p>}
                      {r.dispatch && <p className="text-slate-500">sent {fmtIst(r.dispatch.at, false)} · {r.dispatch.mode}</p>}
                    </div>
                  </div>
                  <RequestTimeline req={r} />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {r.status === 'approved' && (
                      <>
                        <button className={btnPrimary} onClick={() => download(r)} disabled={busy === r.id}><Download size={15} /> Download PDF</button>
                        <Link to={`/verify/${r.verify_code}`} target="_blank" className={btnGhost}><ExternalLink size={15} /> Verification page</Link>
                      </>
                    )}
                    {r.status === 'awaiting_payment' && (
                      <button className={btnPrimary} onClick={() => setPaying(r)}><CreditCard size={15} /> Pay ₹{r.amount}</button>
                    )}
                    {(r.status === 'awaiting_payment' || (r.status === 'in_review' && !r.amount)) && (
                      <button className={btnGhost} onClick={() => withdraw(r)} disabled={busy === r.id}><Undo2 size={15} /> Withdraw</button>
                    )}
                    {r.amount > 0 && r.status !== 'awaiting_payment' && r.status !== 'cancelled' && (
                      <button className={btnGhost} onClick={() => receipt(r)} disabled={busy === r.id}><Receipt size={15} /> Fee receipt</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
      </section>

      {counter && <ServiceCounter counterId={counter} onClose={() => setCounter(null)} onCreated={load} />}
      {paying && (
        <TestCheckout payment={requestPayment(paying)} completeFn={leavingApi.completeTest}
          onDone={afterPayment} onClose={() => setPaying(null)} />
      )}
    </PageTransition>
  );
}
