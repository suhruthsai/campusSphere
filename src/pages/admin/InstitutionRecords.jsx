// Institution records (IQAC, criterion in-charges, HODs, management): student progression and achievements, yearly
// facility / library / ICT / finance figures and audits, and statutory meetings with their decisions.
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Trash2 } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { institutionApi as api } from '../../utils/api.js';
import { btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';

const th = 'py-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500';
const td = 'py-2 pr-3 text-slate-200';
const yearNow = () => { const d = new Date(); const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };
const KIND = { higher_studies: 'Higher studies', exam: 'Competitive exam', startup: 'Startup', award: 'Award', event: 'Event', alumni_contribution: 'Alumni contribution' };
const spin = <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;

function Progression() {
  const [f, setF] = useState({ year: '', kind: '' });
  const [rows, setRows] = useState(null);
  const [n, setN] = useState({ kind: 'higher_studies', programme: 'IT', year: yearNow(), student_name: '', title: '', level: 'state', category: 'technical', participants: '', amount_lakh: '' });
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api.achievements({ programme: 'IT', ...f }).then(setRows), [f]);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setN((s) => ({ ...s, [k]: e.target.value }));
  const add = async (e) => {
    e.preventDefault();
    const d = { kind: n.kind, year: n.year, title: n.title, programme: ['event', 'alumni_contribution'].includes(n.kind) ? null : n.programme };
    if (['higher_studies', 'exam', 'startup'].includes(n.kind)) d.student_name = n.student_name;
    if (n.kind === 'award') Object.assign(d, { level: n.level, category: n.category });
    if (n.kind === 'event') Object.assign(d, { category: n.category, participants: n.participants ? Number(n.participants) : null });
    if (n.kind === 'alumni_contribution') d.amount_lakh = Number(n.amount_lakh);
    try { await api.addAchievement(d); setMsg('Added'); setN((s) => ({ ...s, title: '', student_name: '' })); load(); } catch (err) { setMsg(err.message); }
  };
  return (
    <div className="space-y-5">
      <form onSubmit={add} className="glass grid gap-3 rounded-2xl p-5 sm:grid-cols-6">
        <div className="sm:col-span-2"><label className={labelCls}>Record</label><select className={inputCls} value={n.kind} onChange={set('kind')}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="sm:col-span-3"><label className={labelCls}>{n.kind === 'higher_studies' ? 'Programme and university' : n.kind === 'exam' ? 'Exam (e.g. GATE 2026 CS)' : 'Title'}</label><input className={inputCls} required minLength={3} value={n.title} onChange={set('title')} /></div>
        <div><label className={labelCls}>Year</label><input className={inputCls} value={n.year} onChange={set('year')} pattern="\d{4}-\d{2}" /></div>
        {['higher_studies', 'exam', 'startup'].includes(n.kind) && <div className="sm:col-span-3"><label className={labelCls}>Student (name or roll number)</label><input className={inputCls} required value={n.student_name} onChange={set('student_name')} /></div>}
        {n.kind === 'award' && <div className="sm:col-span-2"><label className={labelCls}>Level</label><select className={inputCls} value={n.level} onChange={set('level')}>{['college', 'state', 'national', 'international'].map((x) => <option key={x}>{x}</option>)}</select></div>}
        {['award', 'event'].includes(n.kind) && <div className="sm:col-span-2"><label className={labelCls}>Category</label><select className={inputCls} value={n.category} onChange={set('category')}>{['sports', 'cultural', 'technical'].map((x) => <option key={x}>{x}</option>)}</select></div>}
        {n.kind === 'event' && <div><label className={labelCls}>Participants</label><input type="number" className={inputCls} value={n.participants} onChange={set('participants')} /></div>}
        {n.kind === 'alumni_contribution' && <div><label className={labelCls}>₹ lakh</label><input type="number" step="0.01" required className={inputCls} value={n.amount_lakh} onChange={set('amount_lakh')} /></div>}
        <div className="flex items-center gap-3 sm:col-span-6"><button className={btnPrimary}>Add</button>{msg && <span className="text-sm text-cyan-300">{msg}</span>}</div>
      </form>
      <section className="glass rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <h2 className="section-title mr-auto">Progression and achievements</h2>
          <select className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white" value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value }))}><option value="">All</option>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input className="w-28 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white" placeholder="2025-26" value={f.year} onChange={(e) => setF((s) => ({ ...s, year: e.target.value }))} />
        </div>
        {!rows ? spin : (
          <div className="max-h-[32rem] overflow-y-auto"><table className="w-full text-sm">
            <thead><tr><th className={th}>Year</th><th className={th}>Type</th><th className={th}>Details</th><th className={th} /></tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id} className="border-t border-white/5"><td className={td}>{a.year}</td><td className={`${td} text-xs text-cyan-300`}>{KIND[a.kind]}</td>
                <td className={td}>{a.title}<div className="text-[11px] text-slate-500">{[a.student_name, a.level, a.category, a.participants && `${a.participants} participants`, a.amount_lakh && `₹${a.amount_lakh} L`, a.programme || 'College-wide'].filter(Boolean).join(' · ')}</div></td>
                <td className="text-right"><button onClick={() => api.removeAchievement(a.id).then(load)} className="rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 size={13} /></button></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}

function Figures() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => api.stats().then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return spin;
  const years = d.years.slice(-6);
  const save = async (k, y, raw) => {
    const unit = k.unit;
    try { await api.setStat({ key: k.key, year: y, ...(unit === 'yes_no' ? { text: raw } : { value: Number(raw) }) }); setMsg(`Saved ${k.label} · ${y}`); load(); } catch (e) { setMsg(e.message); }
  };
  const groups = { finance: 'Finance', library: 'Library', ict: 'ICT', audits: 'Audits and green campus' };
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="section-title">Yearly figures</h2>
      <p className="mb-3 mt-1 text-xs text-slate-400">Type a value and leave the cell to save it. Expenditure figures come from the audited statements.</p>
      {msg && <p className="mb-2 text-sm text-cyan-300">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Figure</th><th className={th}>Feeds</th>{years.map((y) => <th key={y} className={th}>{y}</th>)}</tr></thead>
          <tbody>
            {Object.entries(groups).map(([g, gl]) => [
              <tr key={g}><td colSpan={years.length + 2} className="pt-4 text-[11px] uppercase tracking-wider text-cyan-300">{gl}</td></tr>,
              ...d.keys.filter((k) => k.group === g).map((k) => (
                <tr key={k.key} className="border-t border-white/5">
                  <td className={`${td} max-w-xs`}>{k.label}</td><td className="pr-3 font-mono text-[11px] text-slate-500">{k.metric}</td>
                  {years.map((y) => {
                    const v = d.values[`${k.key}|${y}`];
                    return (
                      <td key={y} className="pr-2">
                        {k.unit === 'yes_no' ? (
                          <select defaultValue={v ?? ''} onChange={(e) => e.target.value && save(k, y, e.target.value)} className="w-20 rounded bg-white/5 px-1 py-1 text-xs text-white">
                            <option value="">—</option><option value="yes">yes</option><option value="no">no</option>
                          </select>
                        ) : (
                          <input defaultValue={v ?? ''} onBlur={(e) => e.target.value !== String(v ?? '') && e.target.value !== '' && save(k, y, e.target.value)}
                                 className="w-24 rounded bg-white/5 px-2 py-1 text-xs text-white" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Meetings() {
  const [d, setD] = useState(null);
  const [body, setBody] = useState('');
  const [n, setN] = useState({ body: 'iqac', programme: 'IT', held_on: '', attendees: '', agenda: '', decisions: '' });
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api.meetings(body).then(setD), [body]);
  useEffect(() => { load(); }, [load]);
  if (!d) return spin;
  const perProg = ['bos', 'dab', 'pac'].includes(n.body);
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.addMeeting({ body: n.body, programme: perProg ? n.programme : null, held_on: n.held_on, attendees: n.attendees ? Number(n.attendees) : null,
        agenda: n.agenda || null, decisions: n.decisions.split('\n').map((t) => t.trim()).filter((t) => t.length >= 3).map((text) => ({ text })) });
      setMsg('Meeting recorded'); setN((s) => ({ ...s, agenda: '', decisions: '', held_on: '' })); load();
    } catch (err) { setMsg(err.message); }
  };
  return (
    <div className="space-y-5">
      <form onSubmit={add} className="glass grid gap-3 rounded-2xl p-5 sm:grid-cols-6">
        <div className="sm:col-span-2"><label className={labelCls}>Body</label><select className={inputCls} value={n.body} onChange={(e) => setN((s) => ({ ...s, body: e.target.value }))}>{Object.entries(d.bodies).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {perProg && <div><label className={labelCls}>Programme</label><select className={inputCls} value={n.programme} onChange={(e) => setN((s) => ({ ...s, programme: e.target.value }))}><option>IT</option><option value="CIVIL">Civil</option></select></div>}
        <div><label className={labelCls}>Held on</label><input type="date" required className={inputCls} value={n.held_on} onChange={(e) => setN((s) => ({ ...s, held_on: e.target.value }))} /></div>
        <div><label className={labelCls}>Attendees</label><input type="number" className={inputCls} value={n.attendees} onChange={(e) => setN((s) => ({ ...s, attendees: e.target.value }))} /></div>
        <div className="sm:col-span-6"><label className={labelCls}>Agenda</label><input className={inputCls} value={n.agenda} onChange={(e) => setN((s) => ({ ...s, agenda: e.target.value }))} /></div>
        <div className="sm:col-span-6"><label className={labelCls}>Decisions (one per line)</label><textarea rows={3} className={inputCls} value={n.decisions} onChange={(e) => setN((s) => ({ ...s, decisions: e.target.value }))} /></div>
        <div className="flex items-center gap-3 sm:col-span-6"><button className={btnPrimary}>Record meeting</button>{msg && <span className="text-sm text-cyan-300">{msg}</span>}</div>
      </form>
      <section className="glass rounded-2xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="section-title mr-auto">Meetings and decisions</h2>
          <select className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white" value={body} onChange={(e) => setBody(e.target.value)}><option value="">All bodies</option>{Object.entries(d.bodies).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <ul className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
          {d.meetings.map((m) => (
            <li key={m.id} className="rounded-xl bg-white/5 p-3">
              <p className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                <span className="font-semibold">{m.body_label}{m.programme ? ` · ${m.programme}` : ''}</span>
                <span className="text-xs text-slate-500">{new Date(m.held_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {m.attendees ?? '—'} present</span>
                <span className={`ml-auto text-xs ${m.done === m.decisions.length ? 'text-emerald-300' : 'text-amber-300'}`}>{m.done} / {m.decisions.length} done</span>
                {!m.minutes && <span className="text-[11px] text-amber-300/80">no minutes attached</span>}
              </p>
              <ul className="mt-2 space-y-1">
                {m.decisions.map((x, i) => (
                  <li key={i}>
                    <button onClick={() => api.setDecision(m.id, i, x.status === 'done' ? 'open' : 'done').then(load)} className="flex items-center gap-2 text-left text-xs text-slate-300 hover:text-white">
                      {x.status === 'done' ? <CheckCircle2 size={13} className="text-emerald-300" /> : <Circle size={13} className="text-slate-500" />}
                      {x.text}{x.owner && <span className="text-slate-500">· {x.owner}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function InstitutionRecords() {
  const [tab, setTab] = useState('progression');
  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Institution records" title="Progression, resources and governance" />
      <div className="flex flex-wrap gap-2">
        {[['progression', 'Progression & achievements'], ['figures', 'Facilities & finance'], ['meetings', 'Meetings']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{l}</button>
        ))}
      </div>
      {tab === 'progression' ? <Progression /> : tab === 'figures' ? <Figures /> : <Meetings />}
    </PageTransition>
  );
}
