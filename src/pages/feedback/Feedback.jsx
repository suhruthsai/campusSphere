// Feedback: students and teachers answer the forms open to them; the IQAC, the Criterion 1 in-charge and HODs create
// forms, open and close them, read the analysis, write the action-taken report, and the IQAC approves and publishes it.
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Copy, Loader2, MessageSquareText } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { feedbackApi as api, obeApi } from '../../utils/api.js';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';
import FeedbackForm from './FeedbackForm.jsx';

const th = 'py-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500';
const td = 'py-2 pr-3 text-slate-200';
const STATUS = { draft: 'bg-white/10 text-slate-300', open: 'bg-emerald-400/15 text-emerald-300', closed: 'bg-sky-400/15 text-sky-300' };
const yearNow = () => { const d = new Date(); const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };

function MyForms() {
  const [forms, setForms] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => api.mine().then(setForms);
  useEffect(() => { load(); }, []);
  if (!forms) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  if (open) {
    return (
      <section className="glass space-y-4 rounded-2xl p-5">
        <button onClick={() => { setOpen(null); load(); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"><ChevronLeft size={14} /> Back</button>
        <h2 className="font-display text-xl font-bold text-white">{open.title}</h2>
        <FeedbackForm form={open} onSubmit={(answers) => api.respond(open.id, answers)} />
      </section>
    );
  }
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="section-title mb-3">Feedback waiting for you</h2>
      {forms.length === 0 ? <p className="text-sm text-slate-400">Nothing to fill in right now.</p> : (
        <ul className="divide-y divide-white/5">
          {forms.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="text-sm text-slate-200">{f.title}{f.closes_at && <span className="ml-2 text-xs text-slate-500">closes {new Date(f.closes_at + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}</span>
              {f.answered ? <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-300">Given · thank you</span>
                : <button className={btnPrimary} onClick={() => setOpen(f)}>Give feedback</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Analysis({ id, onBack }) {
  const [r, setR] = useState(null);
  const [atr, setAtr] = useState({ observations: '', actions: '' });
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api.results(id).then((x) => { setR(x); setAtr({ observations: x.atr?.observations || '', actions: x.atr?.actions || '' }); }).catch((e) => setMsg(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  if (!r) return msg ? <p className="text-rose-300">{msg}</p> : <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  const act = async (fn) => { try { setMsg((await fn()).message); load(); } catch (e) { setMsg(e.message); } };
  const link = r.public_code ? `${window.location.origin}/f/${r.public_code}` : null;
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"><ChevronLeft size={14} /> All forms</button>
      <div>
        <p className="text-xs text-cyan-300">{r.kind_label} · {r.year}{r.programme ? ` · ${r.programme}` : ' · college-wide'}</p>
        <h2 className="font-display text-2xl font-bold text-white">{r.title}</h2>
        <p className="text-sm text-slate-400">{r.responses} responses · overall {r.overall ?? '—'} / 5 · <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[r.status]}`}>{r.status}</span></p>
        {link && r.status === 'open' && (
          <button onClick={() => navigator.clipboard?.writeText(link).then(() => setMsg('Link copied'))} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-cyan-300">
            <Copy size={12} /> {link}
          </button>
        )}
      </div>
      {msg && <p className="text-sm text-cyan-300">{msg}</p>}
      <section className="glass rounded-2xl p-5">
        <h3 className="section-title mb-3">Analysis</h3>
        <div className="space-y-3">
          {r.rows.filter((q) => q.type === 'rating').map((q) => (
            <div key={q.id} className="grid items-center gap-2 sm:grid-cols-[1fr_12rem_3rem]">
              <p className="text-sm text-slate-200">{q.text}</p>
              <div className="flex h-3 overflow-hidden rounded-full bg-white/5" title={q.dist.map((n, i) => `${i + 1}: ${n}`).join(' · ')}>
                {q.dist.map((n, i) => <span key={i} style={{ width: `${q.n ? (100 * n) / q.n : 0}%`, background: ['#F43F5E', '#FB923C', '#94A3B8', '#38BDF8', '#10B981'][i] }} />)}
              </div>
              <p className={`text-right text-sm font-semibold ${q.mean >= 3.75 ? 'text-emerald-300' : q.mean >= 3.25 ? 'text-slate-200' : 'text-amber-300'}`}>{q.mean ?? '—'}</p>
            </div>
          ))}
        </div>
        {r.rows.filter((q) => q.type === 'text' && q.comments?.length).map((q) => (
          <div key={q.id} className="mt-5">
            <p className={labelCls}><MessageSquareText size={12} className="mr-1 inline" /> Comments ({q.n})</p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-300">{q.comments.map((c, i) => <li key={i} className="rounded bg-white/5 px-2 py-1">{c}</li>)}</ul>
          </div>
        ))}
      </section>
      {r.can_manage && (
        <section className="glass space-y-3 rounded-2xl p-5">
          <h3 className="section-title">Action-taken report {r.atr && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${r.atr.status === 'approved' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-slate-300'}`}>{r.atr.status}{r.atr.published ? ' · published' : ''}</span>}</h3>
          <div><label className={labelCls}>What the feedback shows</label>
            <textarea rows={3} className={inputCls} disabled={r.atr?.status === 'approved'} value={atr.observations} onChange={(e) => setAtr((s) => ({ ...s, observations: e.target.value }))} /></div>
          <div><label className={labelCls}>What was done about it</label>
            <textarea rows={3} className={inputCls} disabled={r.atr?.status === 'approved'} value={atr.actions} onChange={(e) => setAtr((s) => ({ ...s, actions: e.target.value }))} /></div>
          <div className="flex flex-wrap gap-2">
            {r.atr?.status !== 'approved' && <button className={btnPrimary} onClick={() => act(() => api.saveAtr(r.id, atr))}>Save ATR</button>}
            {r.can_approve && r.atr && <button className={btnGhost} onClick={() => act(() => api.approveAtr(r.id, r.atr.status !== 'approved'))}>{r.atr.status === 'approved' ? 'Reopen' : 'Approve (IQAC)'}</button>}
            {r.can_approve && r.atr?.status === 'approved' && r.kind !== 'teaching' && (
              <button className={btnGhost} onClick={() => act(() => api.publishAtr(r.id, !r.atr.published))}>{r.atr.published ? 'Unpublish' : 'Publish on website'}</button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function NewForm({ onDone }) {
  const [templates, setTemplates] = useState([]);
  const [courses, setCourses] = useState([]);
  const [f, setF] = useState({ kind: 'curriculum', programme: 'IT', year: yearNow(), study_year: '', course_id: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { api.templates().then(setTemplates); obeApi.courses('IT', yearNow()).then(setCourses).catch(() => setCourses([])); }, []);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const needsCourse = ['teaching', 'course_exit'].includes(f.kind);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.create({ kind: f.kind, year: f.year, programme: ['facilities', 'sss'].includes(f.kind) ? null : f.programme,
        study_year: f.study_year ? Number(f.study_year) : null, course_id: needsCourse ? Number(f.course_id) : null });
      onDone();
    } catch (err) { setMsg(err.message); }
  };
  return (
    <form onSubmit={submit} className="glass grid gap-3 rounded-2xl p-5 sm:grid-cols-4">
      <div className="sm:col-span-2"><label className={labelCls}>Feedback from</label>
        <select className={inputCls} value={f.kind} onChange={set('kind')}>{templates.map((t) => <option key={t.kind} value={t.kind}>{t.label}</option>)}</select></div>
      <div><label className={labelCls}>Academic year</label><input className={inputCls} value={f.year} onChange={set('year')} pattern="\d{4}-\d{2}" /></div>
      {!['facilities', 'sss'].includes(f.kind) && <div><label className={labelCls}>Programme</label><select className={inputCls} value={f.programme} onChange={set('programme')}><option>IT</option><option value="CIVIL">Civil</option></select></div>}
      {needsCourse ? (
        <div className="sm:col-span-4"><label className={labelCls}>Course</label>
          <select className={inputCls} value={f.course_id} onChange={set('course_id')} required>
            <option value="">Select a course offering ({yearNow()})</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name} · sem {c.semester}</option>)}
          </select></div>
      ) : ['curriculum', 'sss', 'facilities'].includes(f.kind) && (
        <div><label className={labelCls}>Year of study</label><select className={inputCls} value={f.study_year} onChange={set('study_year')}><option value="">All years</option>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
      )}
      {msg && <p className="text-sm text-rose-300 sm:col-span-4">{msg}</p>}
      <div className="flex gap-2 sm:col-span-4"><button className={btnPrimary}>Create form</button><button type="button" className={btnGhost} onClick={onDone}>Cancel</button></div>
    </form>
  );
}

function Manage() {
  const [year, setYear] = useState('');
  const [forms, setForms] = useState(null);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => api.forms(year).then(setForms), [year]);
  useEffect(() => { load(); }, [load]);
  if (open) return <Analysis id={open} onBack={() => { setOpen(null); load(); }} />;
  if (adding) return <NewForm onDone={() => { setAdding(false); load(); }} />;
  if (!forms) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  const years = [...new Set(forms.map((f) => f.year))];
  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="section-title mr-auto">Feedback forms</h2>
        <select className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All years</option>{(year ? [year] : years).map((y) => <option key={y}>{y}</option>)}
        </select>
        <button className={btnPrimary} onClick={() => setAdding(true)}>New form</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Form</th><th className={th}>Year</th><th className={th}>Responses</th><th className={th}>Status</th><th className={th}>ATR</th><th className={th} /></tr></thead>
          <tbody>
            {forms.map((f) => (
              <tr key={f.id} className="border-t border-white/5">
                <td className={`${td} cursor-pointer hover:text-cyan-200`} onClick={() => setOpen(f.id)}>{f.kind_label}<div className="text-[11px] text-slate-500">{f.course || (f.programme ? f.programme : 'College-wide')}{f.audience === 'public' ? ' · public link' : ''}</div></td>
                <td className={td}>{f.year}</td><td className={td}>{f.responses}</td>
                <td className={td}><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[f.status]}`}>{f.status}</span></td>
                <td className={`${td} text-xs`}>{f.atr ? `${f.atr}${f.published ? ' · published' : ''}` : '—'}</td>
                <td className={`${td} text-right`}>
                  {f.can_manage && f.status !== 'closed' && <button className="text-xs text-cyan-300 hover:underline" onClick={() => api.setStatus(f.id, f.status === 'open' ? 'closed' : 'open').then(load)}>{f.status === 'open' ? 'Close' : 'Open'}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Feedback() {
  const [access, setAccess] = useState(null);
  const [tab, setTab] = useState('mine');
  useEffect(() => { api.access().then((a) => { setAccess(a); if (a.manage || a.view) setTab('manage'); }).catch(() => setAccess({})); }, []);
  if (!access) return null;
  const staff = access.manage || access.view;
  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Feedback" title={staff ? 'Feedback, analysis and action taken' : 'Your feedback counts'} />
      {staff && (
        <div className="flex gap-2">
          {[['manage', 'Forms and analysis'], ['mine', 'My pending feedback']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{l}</button>
          ))}
        </div>
      )}
      {tab === 'manage' && staff ? <Manage /> : <MyForms />}
    </PageTransition>
  );
}
