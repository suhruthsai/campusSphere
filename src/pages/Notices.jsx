// Notices: what's meant for me (urgent first), and — for those who may post — a form limited to where they
// may post (Principal / admin / Admin Office: anyone; HOD: their department; faculty: a class in their department).
import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, Loader2, Megaphone, Send, Trash2, Users } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import { DashboardHeading } from './StudentDashboard.jsx';
import { announcementsApi } from '../utils/api.js';
import { inputCls, labelCls } from '../components/services/requestUi.jsx';

const AUDIENCE = { all: 'Everyone', students: 'Students', staff: 'Staff' };
const when = (iso) => new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
});

function NoticeCard({ n, onTakeDown }) {
  const urgent = n.priority === 'urgent';
  return (
    <article className={`rounded-2xl border p-5 ${urgent ? 'border-rose-400/30 bg-rose-500/[0.07]' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          {urgent && <AlertTriangle size={15} className="shrink-0 text-rose-300" />}
          {n.title}
        </h3>
        {urgent && <span className="rounded-full bg-rose-400/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-200">Urgent</span>}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">{n.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><Users size={11} /> {n.for}</span>
        <span className="flex items-center gap-1"><CalendarClock size={11} /> {when(n.created_at)}{n.author_name ? ` · ${n.author_name}` : ''}</span>
        {n.expires_at && <span>until {when(n.expires_at)}</span>}
        {!n.is_active && <span className="font-semibold text-slate-400">Taken down</span>}
        {onTakeDown && n.is_active && (
          <button onClick={() => onTakeDown(n)} className="ml-auto flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-slate-300 hover:border-rose-300/40 hover:text-rose-200">
            <Trash2 size={11} /> Take down
          </button>
        )}
      </div>
    </article>
  );
}

function PostForm({ rights, onPosted }) {
  const [f, setF] = useState({ title: '', body: '', audience: rights.audiences[0], department: rights.departments?.[0] || '',
                               year: '', section: '', priority: 'normal', days: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const students = f.audience !== 'staff';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await announcementsApi.create({
        title: f.title, body: f.body, audience: f.audience, priority: f.priority,
        department: f.department || null, year: students && f.year ? Number(f.year) : null,
        section: students && f.section ? f.section : null, days: f.days ? Number(f.days) : null,
      });
      setF((x) => ({ ...x, title: '', body: '' }));
      onPosted();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-5">
      <h2 className="section-title mb-4 flex items-center gap-2"><Megaphone size={16} /> Post a notice</h2>
      <label className={labelCls}>Title</label>
      <input className={inputCls} value={f.title} onChange={set('title')} maxLength={120} required placeholder="e.g. Mid-1 exams from 10 November" />
      <label className={`${labelCls} mt-3`}>Notice</label>
      <textarea className={`${inputCls} min-h-[110px]`} value={f.body} onChange={set('body')} maxLength={2000} required />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>For</label>
          <select className={inputCls} value={f.audience} onChange={set('audience')}>
            {rights.audiences.map((a) => <option key={a} value={a}>{AUDIENCE[a]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Department</label>
          {rights.departments ? (
            <select className={inputCls} value={f.department} onChange={set('department')}>
              {rights.departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          ) : (
            <input className={inputCls} value={f.department} onChange={set('department')} placeholder="Leave empty: whole college" />
          )}
        </div>
        {students && (
          <>
            <div>
              <label className={labelCls}>Year {rights.need_year ? '' : '(optional)'}</label>
              <select className={inputCls} value={f.year} onChange={set('year')} required={rights.need_year}>
                <option value="">{rights.need_year ? 'Choose…' : 'All years'}</option>
                {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Section (optional)</label>
              <input className={inputCls} value={f.section} onChange={set('section')} maxLength={5} placeholder="All sections" />
            </div>
          </>
        )}
        <div>
          <label className={labelCls}>Priority</label>
          <select className={inputCls} value={f.priority} onChange={set('priority')}>
            <option value="normal">Normal</option><option value="urgent">Urgent</option><option value="info">For information</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Show for (days)</label>
          <input className={inputCls} type="number" min={1} max={365} value={f.days} onChange={set('days')} placeholder="Until taken down" />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      <button type="submit" disabled={busy}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Post notice
      </button>
    </form>
  );
}

export default function Notices() {
  const [notices, setNotices] = useState(null);
  const [rights, setRights] = useState(null);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState('');

  const load = () => {
    announcementsApi.mine().then(setNotices).catch((e) => setError(e.message));
    announcementsApi.canPost().then((r) => {
      setRights(r);
      if (r.allowed) announcementsApi.posted().then(setMine).catch(() => setMine([]));
    }).catch(() => setRights({ allowed: false }));
  };
  useEffect(load, []);

  const takeDown = async (n) => {
    if (!window.confirm(`Take down "${n.title}"? People will no longer see it.`)) return;
    try { await announcementsApi.deactivate(n.id); load(); } catch (e) { setError(e.message); }
  };

  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Notices" title="Circulars and notices meant for you." />
      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      <div className={`grid gap-6 ${rights?.allowed ? 'lg:grid-cols-[1.25fr_0.75fr]' : ''}`}>
        <section className="space-y-3">
          {!notices ? <p className="flex items-center gap-2 text-slate-400"><Loader2 size={15} className="animate-spin" /> Loading…</p>
            : notices.length === 0 ? <p className="glass rounded-2xl p-6 text-sm text-slate-400">No notices for you right now.</p>
            : notices.map((n) => <NoticeCard key={n.id} n={n} />)}
        </section>
        {rights?.allowed && (
          <aside className="space-y-4">
            <PostForm rights={rights} onPosted={load} />
            {mine.length > 0 && (
              <div>
                <h2 className="section-title mb-3 text-base">Posted by you</h2>
                <div className="space-y-3">{mine.slice(0, 8).map((n) => <NoticeCard key={n.id} n={n} onTakeDown={takeDown} />)}</div>
              </div>
            )}
          </aside>
        )}
      </div>
    </PageTransition>
  );
}
