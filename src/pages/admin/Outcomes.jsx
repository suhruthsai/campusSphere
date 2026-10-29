// Outcome-based education: PO / PSO attainment with the actions that close the loop, each course's file (COs,
// CO-PO mapping, assessments imported as per-question totals, course-exit survey, attainment), the programme's
// outcomes and its attainment rules. NBA criteria 2, 3, 7; NAAC 2.6.
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Download, Loader2, Trash2, Upload } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { obeApi as api } from '../../utils/api.js';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';

const th = 'py-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500';
const td = 'py-2 pr-3 text-slate-200';
const tip = { background: '#04091a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 };
const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(2));
const lvlCls = (v, target = 2) => (v === null || v === undefined ? 'text-slate-500' : v >= target ? 'text-emerald-300' : 'text-amber-300');

function Card({ title, note, children, right }) {
  return (
    <section className="glass min-w-0 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="section-title">{title}</h2>{right}</div>
      {note && <p className="mb-3 mt-1 text-xs text-slate-400">{note}</p>}
      <div className={note ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

// ── PO / PSO attainment ─────────────────────────────────────────────────────────
function Attainment({ prog, years, onOpenCourse }) {
  const [year, setYear] = useState(null);
  const [r, setR] = useState(null);
  const [actions, setActions] = useState([]);
  useEffect(() => { setR(null); api.attainment(prog, year).then((x) => { setR(x); if (!year) setYear(x.year); }); }, [prog, year]);
  useEffect(() => { api.actions(prog).then(setActions); }, [prog]);
  if (!r) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  const target = r.settings.po_target;
  const pos = r.outcomes.filter((o) => o.kind === 'PO');
  const psos = r.outcomes.filter((o) => o.kind === 'PSO');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {years.map((y) => <button key={y} onClick={() => setYear(y)} className={`rounded-full px-3 py-1 text-xs ${y === r.year ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{y}</button>)}
      </div>
      <Card title={`PO and PSO attainment · ${r.year}`} note={`On a 0–3 scale from every mapped CO of the year's ${r.courses.length} courses. Target ${target}. ${r.gaps.length ? `${r.gaps.length} below target.` : 'All at or above target.'}`}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...pos, ...psos]} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="code" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis domain={[0, 3]} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={tip} formatter={(v) => [fmt(v), 'Attainment']} labelFormatter={(c) => `${c} · ${r.outcomes.find((o) => o.code === c)?.title || ''}`} />
              <ReferenceLine y={target} stroke="#F59E0B" strokeDasharray="4 4" />
              <Bar dataKey="attainment" radius={[5, 5, 0, 0]}>
                {[...pos, ...psos].map((o) => <Cell key={o.code} fill={o.attainment === null ? '#334155' : o.met ? (o.kind === 'PSO' ? '#7B61FF' : '#00E5FF') : '#F59E0B'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Courses behind the year" note="Each course's contribution to the POs it maps to. Open one for its course file.">
          <div className="max-h-[26rem] overflow-y-auto pr-1">
            <table className="w-full text-sm">
              <thead><tr><th className={th}>Course</th><th className={th}>Sem</th><th className={th}>CO avg</th><th className={th}>POs</th></tr></thead>
              <tbody>
                {r.courses.map((c) => (
                  <tr key={c.id} className="cursor-pointer border-t border-white/5 hover:bg-white/5" onClick={() => onOpenCourse(c.id)}>
                    <td className={td}>{c.name}<div className="font-mono text-[11px] text-slate-500">{c.code}</div></td>
                    <td className={td}>{c.semester}</td>
                    <td className={`${td} ${lvlCls(c.average, target)}`}>{fmt(c.average)}</td>
                    <td className={`${td} text-xs text-slate-400`}>{Object.keys(c.po).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Closing the loop" note="What was done about each PO / PSO below target, and the effect the next year (NBA 7.1).">
          {actions.length === 0 ? <p className="text-sm text-slate-400">No actions recorded yet.</p> : (
            <ul className="space-y-3 text-sm">
              {actions.map((a) => (
                <li key={a.id} className="rounded-xl bg-white/5 p-3">
                  <p className="flex flex-wrap items-center gap-2 text-slate-200">
                    <span className="font-mono text-cyan-300">{a.outcome}</span>
                    <span className="text-xs text-slate-400">{a.year} · {fmt(a.attained)} against {fmt(a.target)}</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${a.status === 'done' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-200'}`}>{a.status.replace('_', ' ')}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400"><span className="text-slate-500">Found:</span> {a.observation}</p>
                  <p className="mt-1 text-xs text-slate-300"><span className="text-slate-500">Done:</span> {a.action}</p>
                  {a.result && <p className="mt-1 text-xs text-emerald-300">{a.result}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Course file ─────────────────────────────────────────────────────────────────
function CourseFile({ id, onBack }) {
  const [c, setC] = useState(null);
  const [msg, setMsg] = useState('');
  const [sheet, setSheet] = useState({ name: '', kind: 'internal', held_on: '', file: null });
  const load = useCallback(() => api.course(id).then(setC).catch((e) => setMsg(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  if (!c) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  const target = c.settings.po_target;
  const strength = (co, o) => c.mapping.find((m) => m.co === co && m.outcome === o)?.strength || 0;
  const setCell = async (co, o, v) => { try { await api.saveMapping(c.id, [{ co, outcome: o, strength: Number(v) }]); load(); } catch (e) { setMsg(e.message); } };
  const doImport = async (e) => {
    e.preventDefault();
    try { setMsg((await api.importSheet(c.id, sheet)).message); setSheet({ name: '', kind: 'internal', held_on: '', file: null }); load(); } catch (err) { setMsg(err.message); }
  };
  const att = c.attainment;
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"><ChevronLeft size={14} /> All courses</button>
      <div>
        <p className="font-mono text-xs text-cyan-300">{c.code} · Semester {c.semester} · {c.year} · {c.kind}</p>
        <h2 className="font-display text-2xl font-bold text-white">{c.name}</h2>
        <p className="text-sm text-slate-400">Course coordinator: {c.coordinator || '—'} · {c.students ?? '—'} students · {c.credits} credits</p>
      </div>
      {msg && <p className="text-sm text-cyan-300">{msg}</p>}

      <Card title="Course outcomes and attainment" note={`CIE and SEE: share of students reaching ${c.settings.target_pct}% of a CO's marks → level (≥${c.settings.level3_pct}% = 3, ≥${c.settings.level2_pct}% = 2, ≥${c.settings.level1_pct}% = 1). Direct = ${c.settings.internal_weight * 100}% CIE + ${100 - c.settings.internal_weight * 100}% SEE; final = ${c.settings.direct_weight * 100}% direct + ${100 - c.settings.direct_weight * 100}% exit survey.`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>CO</th><th className={th}>CIE</th><th className={th}>SEE</th><th className={th}>Direct</th><th className={th}>Survey</th><th className={th}>Attained</th></tr></thead>
            <tbody>
              {att.cos.map((o) => (
                <tr key={o.code} className="border-t border-white/5 align-top">
                  <td className={`${td} max-w-md`}><span className="font-mono text-cyan-300">{o.code}</span> <span className="text-[11px] text-violet-300">{o.bloom}</span><div className="text-xs text-slate-400">{o.text}</div></td>
                  <td className={td}>{o.internal_pct ?? '—'}{o.internal_pct !== null && '%'} <span className="text-xs text-slate-500">L{o.internal_level ?? '–'}</span></td>
                  <td className={td}>{o.external_pct ?? '—'}{o.external_pct !== null && '%'} <span className="text-xs text-slate-500">L{o.external_level ?? '–'}</span></td>
                  <td className={td}>{fmt(o.direct)}</td>
                  <td className={td}>{o.survey_mean ? `${o.survey_mean}/5` : '—'}</td>
                  <td className={`${td} font-semibold ${lvlCls(o.attainment, target)}`}>{fmt(o.attainment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="CO – PO / PSO mapping" note="1 low, 2 medium, 3 high. The bottom row is this course's attainment of each PO / PSO.">
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead><tr><th className={th}>CO</th>{c.outcomes.map((o) => <th key={o.code} className={`${th} text-center`} title={o.title}>{o.code}</th>)}</tr></thead>
            <tbody>
              {att.cos.map((o) => (
                <tr key={o.code} className="border-t border-white/5">
                  <td className={`${td} font-mono text-cyan-300`}>{o.code}</td>
                  {c.outcomes.map((p) => {
                    const v = strength(o.code, p.code);
                    return (
                      <td key={p.code} className="px-1 py-1 text-center">
                        {c.can_edit ? (
                          <select value={v} onChange={(e) => setCell(o.code, p.code, e.target.value)}
                                  className={`w-10 rounded bg-white/5 px-1 py-0.5 text-center text-xs ${v ? 'text-white' : 'text-slate-600'}`}>
                            {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n || '·'}</option>)}
                          </select>
                        ) : <span className={v ? 'text-white' : 'text-slate-600'}>{v || '·'}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-white/20">
                <td className={`${td} text-xs text-slate-400`}>Attained</td>
                {c.outcomes.map((p) => <td key={p.code} className={`px-1 py-2 text-center text-xs ${lvlCls(att.po[p.code], target)}`}>{att.po[p.code] !== undefined ? fmt(att.po[p.code]) : '·'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Assessments" note="Imported marks sheets. Only each question's totals are kept: CampusSphere stores no student's marks."
            right={<button className={btnGhost} onClick={() => api.template(c.id, `${c.code}-${c.year}-marks-template.xlsx`)}><Download size={13} className="mr-1 inline" />Marks sheet template</button>}>
        <div className="space-y-3">
          {c.assessments.length === 0 && <p className="text-sm text-slate-400">No assessments imported yet.</p>}
          {c.assessments.map((a) => (
            <div key={a.id} className="rounded-xl bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-200"><span className="font-semibold">{a.name}</span> <span className="text-xs text-slate-500">{a.kind === 'external' ? 'SEE' : 'CIE'} · {a.held_on || ''} · {a.students} students</span></span>
                {c.can_edit && <button onClick={() => api.removeAssessment(a.id).then(load)} className="rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.questions.map((q) => (
                  <span key={q.label} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300" title={`Average ${q.mean}/${q.max}`}>
                    {q.label} · <span className="text-cyan-300">{q.co}</span> · {q.attempted ? Math.round((100 * q.reached) / q.attempted) : 0}% reached
                  </span>
                ))}
              </div>
            </div>
          ))}
          {c.can_edit && (
            <form onSubmit={doImport} className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-4">
              <input className={inputCls} required value={sheet.name} onChange={(e) => setSheet((s) => ({ ...s, name: e.target.value }))} placeholder="CIE-1 / SEE / Assignment 2" />
              <select className={inputCls} value={sheet.kind} onChange={(e) => setSheet((s) => ({ ...s, kind: e.target.value }))}><option value="internal">Internal (CIE)</option><option value="external">End-semester (SEE)</option></select>
              <input type="date" className={inputCls} value={sheet.held_on} onChange={(e) => setSheet((s) => ({ ...s, held_on: e.target.value }))} />
              <input type="file" required accept=".xlsx,.csv" className="text-xs text-slate-300" onChange={(e) => setSheet((s) => ({ ...s, file: e.target.files[0] || null }))} />
              <div className="sm:col-span-4"><button className={btnPrimary}><Upload size={13} className="mr-1 inline" />Import marks sheet</button></div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}

function Courses({ prog, years, onOpen }) {
  const [year, setYear] = useState(years[0]);
  const [rows, setRows] = useState(null);
  useEffect(() => { if (year) { setRows(null); api.courses(prog, year).then(setRows); } }, [prog, year]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{years.map((y) => <button key={y} onClick={() => setYear(y)} className={`rounded-full px-3 py-1 text-xs ${y === year ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{y}</button>)}</div>
      {!rows ? <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p> : (
        <Card title={`Course files · ${year}`} note={`${rows.length} courses. Course coordinators keep their own course's COs, mapping and marks.`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th className={th}>Course</th><th className={th}>Sem</th><th className={th}>Coordinator</th><th className={th}>COs</th><th className={th}>Assessments</th><th className={th}>CO avg</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="cursor-pointer border-t border-white/5 hover:bg-white/5" onClick={() => onOpen(c.id)}>
                    <td className={td}>{c.name}<div className="font-mono text-[11px] text-slate-500">{c.code} · {c.kind}</div></td>
                    <td className={td}>{c.semester}</td><td className={td}>{c.coordinator || '—'}</td><td className={td}>{c.cos}</td>
                    <td className={td}>{c.assessments}</td><td className={`${td} ${lvlCls(c.attainment)}`}>{fmt(c.attainment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function OutcomeList({ prog, canManage }) {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => api.outcomes(prog).then(setRows);
  useEffect(() => { load(); }, [prog]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => { try { setMsg((await api.saveOutcome({ programme: prog, ...edit })).message); setEdit(null); load(); } catch (e) { setMsg(e.message); } };
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {['PEO', 'PO', 'PSO'].map((k) => (
        <Card key={k} title={{ PEO: 'Programme Educational Objectives', PO: 'Programme Outcomes', PSO: 'Programme Specific Outcomes' }[k]}>
          <ul className="space-y-2.5 text-sm">
            {rows.filter((r) => r.kind === k).map((r) => (
              <li key={r.code} className={canManage ? 'cursor-pointer rounded-lg p-1 hover:bg-white/5' : ''} onClick={() => canManage && setEdit({ kind: r.kind, code: r.code, title: r.title || '', text: r.text })}>
                <span className="font-mono text-cyan-300">{r.code}</span>{r.title && <span className="ml-1 font-semibold text-slate-200">{r.title}</span>}
                <p className="text-xs text-slate-400">{r.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {edit && (
        <div className="glass space-y-2 rounded-2xl p-5 lg:col-span-3">
          <p className={labelCls}>Edit {edit.code}</p>
          <input className={inputCls} value={edit.title} onChange={(e) => setEdit((s) => ({ ...s, title: e.target.value }))} placeholder="Short title" />
          <textarea rows={3} className={inputCls} value={edit.text} onChange={(e) => setEdit((s) => ({ ...s, text: e.target.value }))} />
          <div className="flex gap-2"><button className={btnPrimary} onClick={save}>Save</button><button className={btnGhost} onClick={() => setEdit(null)}>Cancel</button>{msg && <span className="text-sm text-cyan-300">{msg}</span>}</div>
        </div>
      )}
    </div>
  );
}

export default function Outcomes() {
  const [prog, setProg] = useState('IT');
  const [access, setAccess] = useState(null);
  const [years, setYears] = useState([]);
  const [tab, setTab] = useState('attainment');
  const [course, setCourse] = useState(null);
  useEffect(() => { api.access(prog).then(setAccess).catch(() => setAccess({ view: false })); api.years(prog).then((y) => setYears(y.years)).catch(() => {}); }, [prog]);
  if (!access) return null;
  if (!access.view) return <PageTransition className="mx-auto max-w-5xl px-4 pt-28 text-slate-400">The IQAC, NBA coordinators, HODs, course coordinators and management can see outcome attainment.</PageTransition>;
  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Outcome-based education" title={`${prog}: outcomes and attainment`} />
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white" value={prog} onChange={(e) => { setProg(e.target.value); setCourse(null); }}>
          <option value="IT">IT</option><option value="CIVIL">Civil</option>
        </select>
        {[['attainment', 'PO attainment'], ['courses', 'Course files'], ['outcomes', 'PEOs, POs, PSOs']].map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setCourse(null); }} className={`rounded-full px-4 py-1.5 text-sm ${tab === k && !course ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{l}</button>
        ))}
      </div>
      {years.length === 0 && tab !== 'outcomes' ? <p className="text-sm text-slate-400">No course offerings recorded for {prog} yet.</p>
        : course ? <CourseFile id={course} onBack={() => setCourse(null)} />
        : tab === 'attainment' ? <Attainment prog={prog} years={years} onOpenCourse={setCourse} />
        : tab === 'courses' ? <Courses prog={prog} years={years} onOpen={setCourse} />
        : <OutcomeList prog={prog} canManage={access.manage} />}
    </PageTransition>
  );
}
