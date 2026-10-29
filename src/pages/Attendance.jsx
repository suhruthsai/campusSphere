// Attendance, by role. Students: overall and per subject, with how many classes they can miss and stay at
// 75%, or must attend to get back (65% is the condonation floor; below it the student is detained).
// Faculty: mark today's periods from the timetable (everyone present, tap the absentees) and section reports.
// HODs, the Principal and admins: the overview by section; admins also set the rules and semester dates.
import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, ChevronLeft, Clock, Loader2, Save, Settings } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import { DashboardHeading } from './StudentDashboard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { attendanceApi, authApi } from '../utils/api.js';
import { inputCls, labelCls } from '../components/services/requestUi.jsx';

const TONE = {
  good:        { label: 'Safe',         ring: 'border-emerald-400/30 bg-emerald-400/[0.07]', text: 'text-emerald-300', bar: 'bg-emerald-400' },
  condonation: { label: 'Condonation',  ring: 'border-amber-300/30 bg-amber-400/[0.07]',     text: 'text-amber-200',   bar: 'bg-amber-300' },
  detained:    { label: 'Detention risk', ring: 'border-rose-400/30 bg-rose-500/[0.07]',     text: 'text-rose-300',    bar: 'bg-rose-400' },
  none:        { label: 'No classes yet', ring: 'border-white/10 bg-white/[0.03]',          text: 'text-slate-400',   bar: 'bg-slate-600' },
};
const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const todayIso = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);   // India date
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 'es'}`.replace('classs', 'classes');

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-6 inline-flex flex-wrap rounded-xl border border-white/10 bg-white/[0.04] p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${value === t.id ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Pct({ value, status }) {
  return <span className={`font-display text-2xl font-bold ${TONE[status]?.text || 'text-white'}`}>{value == null ? '—' : `${value}%`}</span>;
}

/** The one-line advice for a subject or the overall figure. */
function advice(a, rules) {
  if (!a.held) return 'No classes marked yet.';
  if (a.status === 'good') {
    return a.can_miss > 0 ? `You can miss ${plural(a.can_miss, 'class')} in a row and stay at ${rules.target_pct}%.`
      : `Exactly at the limit: don't miss the next class.`;
  }
  const floorPart = a.status === 'detained' ? ` (${a.need_for_floor} to get back above ${rules.floor_pct}%)` : '';
  return `Attend the next ${plural(a.need_for_target, 'class')} in a row to get back to ${rules.target_pct}%${floorPart}.`;
}

// ── Student ──────────────────────────────────────────────────────────────────────
function StudentView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { attendanceApi.me().then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="text-rose-300">{error}</p>;
  if (!data) return <p className="flex items-center gap-2 text-slate-400"><Loader2 size={15} className="animate-spin" /> Loading…</p>;
  if (!data.ready) return <p className="glass rounded-2xl p-6 text-sm text-slate-300">{data.reason}</p>;
  const { overall: o, rules } = data;
  const tone = TONE[o.status];
  return (
    <>
      <section className={`mb-6 rounded-2xl border p-6 ${tone.ring}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overall attendance · {data.name} · {data.roll_no}</p>
            <p className={`mt-1 font-display text-5xl font-extrabold ${tone.text}`}>{o.pct == null ? '—' : `${o.pct}%`}</p>
            <p className="mt-1 text-sm text-slate-300">{o.attended} of {o.held} classes attended · <b className={tone.text}>{tone.label}</b></p>
          </div>
          <div className="max-w-md text-sm text-slate-200">
            <p className="font-semibold">{advice(o, rules)}</p>
            {o.semester_bunks_left != null && o.held > 0 && (
              <p className="mt-1 text-slate-400">This semester you can miss <b className="text-white">{o.semester_bunks_left}</b> more classes in total and still finish at {rules.target_pct}%{o.best_possible_pct != null ? ` (best possible: ${o.best_possible_pct}%)` : ''}.</p>
            )}
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(100, o.pct || 0)}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {rules.target_pct}% is required · {rules.floor_pct}–{rules.target_pct}% can be condoned (medical grounds, fee) · below {rules.floor_pct}% means detention.
          {' '}This semester: {fmtDate(rules.semester_start)} – {fmtDate(rules.semester_end)}.
          {data.placeholder && ' Your roll list is a placeholder until the official one is imported.'}
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {data.subjects.map((s) => (
          <article key={s.subject} className={`rounded-2xl border p-4 ${TONE[s.status].ring}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-white">{s.subject}</h3>
              <Pct value={s.pct} status={s.status} />
            </div>
            <p className="mt-1 text-xs text-slate-400">{s.attended}/{s.held} attended{s.remaining != null ? ` · ${s.remaining} classes left this semester` : ''}</p>
            <p className={`mt-2 text-sm ${TONE[s.status].text}`}>{advice(s, rules)}</p>
          </article>
        ))}
      </div>
    </>
  );
}

// ── Faculty: marking ─────────────────────────────────────────────────────────────
function Marker({ entryId, date, onBack }) {
  const [s, setS] = useState(null);
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const load = () => attendanceApi.session(entryId, date).then((d) => {
    setS(d);
    setMarks(Object.fromEntries(d.students.filter((x) => x.in_group).map((x) => [x.roll_no, x.status])));
  }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [entryId, date]);

  const cycle = (roll) => setMarks((m) => ({ ...m, [roll]: m[roll] === 'present' ? 'absent' : m[roll] === 'absent' ? 'late' : 'present' }));
  const toggleGroup = async (roll, member) => {
    try { await attendanceApi.setGroup({ entry_id: entryId, roll_no: roll, member }); load(); } catch (e) { setError(e.message); }
  };
  const save = async () => {
    setBusy(true); setError(''); setMsg('');
    const absent = Object.keys(marks).filter((r) => marks[r] === 'absent');
    const late = Object.keys(marks).filter((r) => marks[r] === 'late');
    try {
      const r = await attendanceApi.save({ entry_id: entryId, date, absent, late });
      setMsg(`Saved: ${r.present} present, ${r.late} late, ${r.absent} absent.`); load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  if (error && !s) return <p className="text-rose-300">{error}</p>;
  if (!s) return <p className="flex items-center gap-2 text-slate-400"><Loader2 size={15} className="animate-spin" /> Loading the class list…</p>;
  const count = (st) => Object.values(marks).filter((v) => v === st).length;
  const members = s.students.filter((x) => x.in_group);
  return (
    <section>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200"><ChevronLeft size={15} /> Today's classes</button>
      <div className="glass mb-4 rounded-2xl p-5">
        <h2 className="font-display text-xl font-bold text-white">{s.subject}</h2>
        <p className="text-sm text-slate-400">{s.section}{s.batch ? ` · ${s.batch}` : ''} · P{s.period} {s.time} · {s.classroom} · {s.date}</p>
        <p className="mt-2 text-xs text-slate-500">
          Everyone starts as present. Tap a student to mark absent, tap again for late. {s.saved ? `Saved by ${s.marked_by}.` : 'Not saved yet.'}
          {!s.can_edit && ` Locked ${s.edit_hours} hours after class; ask your HOD to correct it.`}
          {s.placeholder_roll_list && ' (Placeholder roll list.)'}
        </p>
        {s.note && <p className="mt-2 text-sm text-amber-200">{s.note}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-200">{count('present')} present</span>
          <span className="rounded-full bg-amber-300/15 px-3 py-1 text-amber-200">{count('late')} late</span>
          <span className="rounded-full bg-rose-400/15 px-3 py-1 text-rose-200">{count('absent')} absent</span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((x) => {
          const st = marks[x.roll_no];
          const cls = st === 'absent' ? 'border-rose-400/40 bg-rose-500/10' : st === 'late' ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.03]';
          return (
            <button key={x.roll_no} disabled={!s.can_edit} onClick={() => cycle(x.roll_no)}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed ${cls}`}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{x.name}</span>
                <span className="block text-[11px] text-slate-500">{x.roll_no}</span>
              </span>
              <span className={`shrink-0 text-xs font-bold ${st === 'absent' ? 'text-rose-300' : st === 'late' ? 'text-amber-200' : 'text-emerald-300'}`}>
                {st === 'absent' ? 'Absent' : st === 'late' ? 'Late' : 'Present'}
              </span>
            </button>
          );
        })}
      </div>

      {s.batch && s.can_edit && (
        <details className="glass mt-4 rounded-2xl p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">Who is in {s.batch}? ({members.length} of {s.students.length})</summary>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {s.students.map((x) => (
              <label key={x.roll_no} className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={x.in_group} onChange={(e) => toggleGroup(x.roll_no, e.target.checked)} className="accent-cyan-400" />
                {x.roll_no} · {x.name}
              </label>
            ))}
          </div>
        </details>
      )}

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {msg && <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-300"><CheckCircle2 size={14} /> {msg}</p>}
      {s.can_edit && members.length > 0 && (
        <button onClick={save} disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {s.saved ? 'Update attendance' : 'Save attendance'}
        </button>
      )}
    </section>
  );
}

function MarkView({ canDepartment }) {
  const [date, setDate] = useState(todayIso());
  const [scope, setScope] = useState('mine');
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) return;
    setData(null);
    attendanceApi.classes(date, scope).then(setData).catch((e) => setError(e.message));
  }, [date, scope, open]);
  if (open) return <Marker entryId={open} date={date} onBack={() => setOpen(null)} />;
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" className={inputCls} value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </div>
        {canDepartment && (
          <div>
            <label className={labelCls}>Show</label>
            <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="mine">My classes</option><option value="department">My department's classes</option>
            </select>
          </div>
        )}
      </div>
      {error && <p className="text-rose-300">{error}</p>}
      {!data ? <p className="flex items-center gap-2 text-slate-400"><Loader2 size={15} className="animate-spin" /> Loading…</p> : (
        <>
          {data.note && <p className="mb-3 text-sm text-amber-200">{data.note}</p>}
          {data.classes.length === 0 ? <p className="glass rounded-2xl p-6 text-sm text-slate-400">No classes to mark on this day.</p> : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.classes.map((c) => (
                <button key={c.entry_id} onClick={() => setOpen(c.entry_id)}
                  className={`rounded-2xl border p-4 text-left transition hover:border-cyan-300/40 ${c.marked ? 'border-emerald-400/25 bg-emerald-400/[0.05]' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-cyan-300">P{c.period} · {c.time}</span>
                    {c.marked ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-300"><Check size={12} /> Marked</span>
                      : c.started ? <span className="flex items-center gap-1 text-xs font-semibold text-amber-200"><Clock size={12} /> To mark</span>
                      : <span className="text-xs text-slate-500">Later today</span>}
                  </div>
                  <h3 className="mt-1 font-semibold text-white">{c.subject}</h3>
                  <p className="text-xs text-slate-400">{c.section}{c.batch ? ` · ${c.batch}` : ''} · {c.classroom}{c.substitute ? ` · substitute: ${c.teacher}` : ''}</p>
                  {c.counts && <p className="mt-1 text-xs text-slate-400">{c.counts.present} present · {c.counts.late} late · {c.counts.absent} absent</p>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────────
function SectionView() {
  const [sections, setSections] = useState(null);
  const [section, setSection] = useState('');
  const [rep, setRep] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { attendanceApi.mySections().then((s) => { setSections(s); setSection(s[0] || ''); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (section) { setRep(null); attendanceApi.section(section).then(setRep).catch((e) => setError(e.message)); } }, [section]);
  if (error) return <p className="text-rose-300">{error}</p>;
  if (!sections) return <p className="text-slate-400">Loading…</p>;
  if (!sections.length) return <p className="glass rounded-2xl p-6 text-sm text-slate-400">You don't teach any section in the timetable yet.</p>;
  return (
    <section>
      <div className="mb-4 max-w-xs">
        <label className={labelCls}>Section</label>
        <select className={inputCls} value={section} onChange={(e) => setSection(e.target.value)}>
          {sections.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {!rep ? <p className="text-slate-400">Loading…</p> : (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">{rep.class_size} students · {rep.sessions} periods marked</span>
            <span className="rounded-full bg-amber-300/15 px-3 py-1 text-amber-200">{rep.below_target} below {rep.rules.target_pct}%</span>
            <span className="rounded-full bg-rose-400/15 px-3 py-1 text-rose-200">{rep.below_floor} below {rep.rules.floor_pct}%</span>
          </div>
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="glass rounded-2xl p-5">
              <h3 className="section-title mb-3 text-base">By subject</h3>
              {rep.subjects.length === 0 ? <p className="text-sm text-slate-400">Nothing marked yet.</p> : rep.subjects.map((s) => (
                <div key={s.subject} className="flex justify-between border-t border-white/5 py-2 text-sm">
                  <span className="text-slate-200">{s.subject} <span className="text-xs text-slate-500">· {s.sessions} periods</span></span>
                  <b className="text-white">{s.avg_pct == null ? '—' : `${s.avg_pct}%`}</b>
                </div>
              ))}
            </div>
            <div className="glass min-w-0 rounded-2xl p-5">
              <h3 className="section-title mb-3 text-base">Students, lowest first</h3>
              <div className="max-h-[28rem] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-2">Student</th><th>Attended</th><th>%</th><th>To get to {rep.rules.target_pct}%</th></tr></thead>
                  <tbody>
                    {rep.students.map((s) => (
                      <tr key={s.roll_no} className="border-t border-white/5">
                        <td className="py-1.5"><span className="text-white">{s.name}</span><span className="block text-[11px] text-slate-500">{s.roll_no}</span></td>
                        <td className="text-slate-300">{s.attended}/{s.held}</td>
                        <td className={`font-semibold ${TONE[s.status].text}`}>{s.pct == null ? '—' : `${s.pct}%`}</td>
                        <td className="text-xs text-slate-400">{s.need_for_target ? `${s.need_for_target} in a row` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rep.students.length === 0 && <p className="text-sm text-slate-400">Nothing marked yet.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function OverviewView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { attendanceApi.overview().then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="text-rose-300">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading…</p>;
  return (
    <div className="glass overflow-x-auto rounded-2xl p-5">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-slate-500">
          <tr><th className="pb-2">Section</th><th>Students</th><th>Periods marked</th><th>Average</th><th>Below {data.rules.target_pct}%</th><th>Below {data.rules.floor_pct}%</th></tr>
        </thead>
        <tbody>
          {data.sections.map((s) => (
            <tr key={s.section} className="border-t border-white/5 text-slate-200">
              <td className="py-2 font-semibold text-white">{s.section}</td><td>{s.class_size}</td><td>{s.sessions}</td>
              <td>{s.avg_pct == null ? '—' : `${s.avg_pct}%`}</td>
              <td className={s.below_target ? 'font-semibold text-amber-200' : ''}>{s.below_target}</td>
              <td className={s.below_floor ? 'font-semibold text-rose-300' : ''}>{s.below_floor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RulesView() {
  const [r, setR] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { attendanceApi.rules().then(setR).catch((e) => setError(e.message)); }, []);
  if (!r) return <p className="text-slate-400">{error || 'Loading…'}</p>;
  const set = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault(); setMsg(''); setError('');
    try {
      setR(await attendanceApi.saveRules({ target_pct: Number(r.target_pct), floor_pct: Number(r.floor_pct), edit_hours: Number(r.edit_hours),
        semester_start: r.semester_start || null, semester_end: r.semester_end || null }));
      setMsg('Rules saved.');
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={save} className="glass max-w-xl rounded-2xl p-5">
      <h3 className="section-title mb-1 flex items-center gap-2 text-base"><Settings size={15} /> Attendance rules</h3>
      <p className="mb-4 text-xs text-slate-500">Osmania University: 75% required; 65–75% may be condoned; below 65% the student is detained.</p>
      <p className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
        Semesters are automatic: <b>1 July – 31 December</b> and <b>1 January – 30 June</b>. Set dates below only if this
        semester differs. {r.semester_auto ? 'Using the automatic dates now.' : 'Using the dates set here.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelCls}>Required (target) %</label><input type="number" className={inputCls} value={r.target_pct} onChange={set('target_pct')} /></div>
        <div><label className={labelCls}>Condonation floor %</label><input type="number" className={inputCls} value={r.floor_pct} onChange={set('floor_pct')} /></div>
        <div><label className={labelCls}>Semester starts</label><input type="date" className={inputCls} value={r.semester_start || ''} onChange={set('semester_start')} /></div>
        <div><label className={labelCls}>Semester ends</label><input type="date" className={inputCls} value={r.semester_end || ''} onChange={set('semester_end')} /></div>
        <div><label className={labelCls}>Faculty may correct for (hours)</label><input type="number" className={inputCls} value={r.edit_hours} onChange={set('edit_hours')} /></div>
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {msg && <p className="mt-3 text-sm text-emerald-300">{msg}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300"><Save size={15} /> Save rules</button>
        {!r.semester_auto && (
          <button type="button" onClick={async () => {
            setR(await attendanceApi.saveRules({ target_pct: Number(r.target_pct), floor_pct: Number(r.floor_pct), edit_hours: Number(r.edit_hours), semester_start: null, semester_end: null }));
            setMsg('Back to the automatic semester dates.');
          }} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-300/40">Use automatic dates</button>
        )}
      </div>
    </form>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const [roles, setRoles] = useState(null);
  useEffect(() => { authApi.roles().then(setRoles).catch(() => setRoles({})); }, []);
  const role = user?.role;
  const tabs = useMemo(() => {
    if (!roles || role === 'student') return [];
    return [
      role === 'faculty' && { id: 'mark', label: 'Mark attendance' },
      role === 'admin' && { id: 'mark', label: 'Mark (any class)' },
      (role === 'faculty' || role === 'admin') && { id: 'sections', label: 'Section reports' },
      (role === 'admin' || roles.principal || roles.hod) && { id: 'overview', label: 'Overview' },
      role === 'admin' && { id: 'rules', label: 'Rules' },
    ].filter(Boolean);
  }, [roles, role]);
  const [tab, setTab] = useState(null);
  const current = tab || tabs[0]?.id;

  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Attendance" title={role === 'student' ? 'Your attendance, and how many classes you can miss.' : 'Mark attendance and see who is falling short.'} />
      {role === 'student' ? <StudentView /> : !roles ? <p className="text-slate-400">Loading…</p> : (
        <>
          {tabs.length > 1 && <Tabs tabs={tabs} value={current} onChange={setTab} />}
          {current === 'mark' && <MarkView canDepartment={role === 'admin' || roles.hod} />}
          {current === 'sections' && <SectionView />}
          {current === 'overview' && <OverviewView />}
          {current === 'rules' && <RulesView />}
          {!current && <p className="glass rounded-2xl p-6 text-sm text-slate-400">Attendance is marked by faculty and reviewed by HODs and the Principal.</p>}
        </>
      )}
    </PageTransition>
  );
}
