// Accreditation workspace: every NAAC metric / NBA criterion across the assessment period — each year's value,
// the evidence behind it, readiness for filing — plus the Extended Profile, the accreditation team and the
// college's facts. For the IQAC, criterion in-charges, NBA coordinators and management (the API checks).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, ExternalLink, FileText, Link2, Loader2, Lock, Paperclip, Trash2, Unlock, X } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { accreditationApi as api } from '../../utils/api.js';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';

// Cell look per status. Values resting on demonstration data look like this year's live reading.
const CELL = {
  missing:        { cls: 'bg-white/5 text-slate-600', label: 'No value' },
  needs_evidence: { cls: 'bg-amber-400/20 text-amber-200', label: 'Needs evidence' },
  ready:          { cls: 'bg-emerald-400/20 text-emerald-200', label: 'Ready' },
  locked:         { cls: 'bg-emerald-500/30 text-emerald-100', label: 'Locked' },
  live:           { cls: 'bg-cyan-400/15 text-cyan-200', label: 'Live reading' },
  generated:      { cls: 'bg-cyan-400/15 text-cyan-200', label: 'Live reading' },
};
const UNIT = { pct: '%', count: '', ratio: '', days: ' days', lakh: ' lakh', options: '', text: '', yes_no: '' };
const ROLE_LABEL = { iqac_coordinator: 'IQAC Coordinator', criterion_incharge: 'Criterion in-charge', nba_coordinator: 'NBA coordinator', metric_owner: 'Metric owner' };

function cellText(c, unit) {
  if (c.value !== null && c.value !== undefined) return `${+c.value.toFixed(2)}${UNIT[unit] || ''}`;
  if (c.text) return c.status === 'live' || c.status === 'generated' ? 'live' : (c.text.length > 8 ? '✓' : c.text);
  return '—';
}

function Summary({ s }) {
  const tiles = [
    ['Ready to file', `${s.ready_pct}%`, `${s.ready} of ${s.cells} metric-years`, 'text-emerald-300'],
    ['Need evidence', s.needs_evidence, 'value entered, no document', 'text-amber-300'],
    ['No value yet', s.missing, 'quantitative metric-years', 'text-slate-300'],
    ['Written answers', s.qualitative_written, 'qualitative metrics drafted', 'text-violet-300'],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(([label, v, sub, tone]) => (
        <div key={label} className="glass rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`mt-1 font-display text-2xl font-bold ${tone}`}>{v}</p>
          <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
        </div>
      ))}
    </div>
  );
}

function MetricRows({ rows, years, onOpen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-slate-500">
            <th className="py-2 pr-3 text-left font-medium">Metric</th>
            {years.map((y, i) => <th key={y} className="px-1 py-2 text-center font-medium">{i === 0 ? `${y} (now)` : y}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="cursor-pointer border-t border-white/5 hover:bg-white/5" onClick={() => onOpen(r.code)}>
              <td className="max-w-[26rem] py-2 pr-3">
                <span className="mr-2 font-mono text-xs text-cyan-300">{r.code}</span>
                <span className="text-slate-200">{r.title}</span>
                <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${r.kind === 'QnM' ? 'bg-sky-400/10 text-sky-300' : 'bg-violet-400/10 text-violet-300'}`}>
                  {r.kind === 'QnM' ? 'Quantitative' : 'Qualitative'}
                </span>
              </td>
              {years.map((y) => {
                const c = r.cells.find((x) => x.year === y);
                if (!c) return <td key={y} className="px-1 text-center text-slate-700">·</td>;
                const look = CELL[c.status] || CELL.missing;
                return (
                  <td key={y} className="px-1 py-1.5 text-center">
                    <span title={look.label + (c.evidence ? ` · ${c.evidence} document(s)` : '')}
                          className={`inline-flex min-w-[3.5rem] items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] ${look.cls}`}>
                      {c.status === 'locked' && <Lock size={10} />}{cellText(c, r.unit)}{c.evidence > 0 && <Paperclip size={10} />}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YearEditor({ m, cell, framework, programme, onSaved }) {
  const qual = m.kind === 'QlM' || m.unit === 'text';
  const [value, setValue] = useState(cell.value ?? '');
  const [text, setText] = useState(cell.status === 'live' || cell.status === 'generated' ? '' : (cell.text || ''));
  const [note, setNote] = useState(cell.note || '');
  const [msg, setMsg] = useState('');
  const save = async () => {
    try {
      await api.wsValue({ framework, code: m.code, programme, year: cell.year, note: note || null,
        value: qual || m.unit === 'options' ? null : (value === '' ? null : Number(value)), text: qual || m.unit === 'options' ? text : null });
      setMsg('Saved'); onSaved();
    } catch (e) { setMsg(e.message); }
  };
  const lock = async (locked) => { try { await api.wsLock({ framework, code: m.code, programme, year: cell.year, locked }); onSaved(); } catch (e) { setMsg(e.message); } };
  return (
    <div className="space-y-2">
      {m.unit === 'options' ? (
        <select className={inputCls} value={text} disabled={cell.locked} onChange={(e) => setText(e.target.value)}>
          <option value="">Select the option that applies</option>
          {['A', 'B', 'C', 'D', 'E'].map((o) => <option key={o} value={o}>Option {o}</option>)}
        </select>
      ) : qual ? (
        <textarea rows={6} className={inputCls} disabled={cell.locked} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="The answer as it will appear in the report (NAAC allows about 500 words)" />
      ) : (
        <input type="number" step="any" className={inputCls} disabled={cell.locked} value={value} onChange={(e) => setValue(e.target.value)}
               placeholder={`Value${UNIT[m.unit] ? ` (${UNIT[m.unit].trim()})` : ''}`} />
      )}
      <input className={inputCls} disabled={cell.locked} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note: how it was computed, which list it comes from" />
      <div className="flex flex-wrap items-center gap-2">
        {!cell.locked && <button className={btnPrimary} onClick={save}>Save {cell.year}</button>}
        {m.can_lock && cell.origin && cell.origin !== 'live' && (
          <button className={btnGhost} onClick={() => lock(!cell.locked)}>{cell.locked ? <><Unlock size={13} className="mr-1 inline" />Unlock</> : <><Lock size={13} className="mr-1 inline" />Lock as reviewed</>}</button>
        )}
        {msg && <span className="text-xs text-cyan-300">{msg}</span>}
      </div>
    </div>
  );
}

function Evidence({ m, year, items, framework, programme, onChanged }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [signed, setSigned] = useState(false);
  const [msg, setMsg] = useState('');
  const upload = async () => {
    try {
      if (file) await api.wsUpload({ framework, code: m.code, programme, year, title: title || file.name, signed, file });
      else if (url) await api.wsLink({ framework, code: m.code, programme, year, title: title || url, url });
      else return;
      setTitle(''); setFile(null); setUrl(''); setMsg('Added'); onChanged();
    } catch (e) { setMsg(e.message); }
  };
  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-xs text-slate-500">No documents for {year} yet.</p>}
      {items.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-slate-200">
            {e.kind === 'link' ? <Link2 size={14} className="shrink-0 text-cyan-300" /> : <FileText size={14} className="shrink-0 text-cyan-300" />}
            <span className="truncate">{e.title}</span>
            {e.signed && <span className="rounded bg-emerald-400/15 px-1.5 text-[10px] text-emerald-300">Signed</span>}
            {e.version > 1 && <span className="text-[10px] text-slate-500">v{e.version}</span>}
            {e.source && <span className="text-[10px] text-slate-500">· {e.source}</span>}
          </span>
          <span className="flex shrink-0 gap-1">
            {e.kind === 'link'
              ? <a href={e.url} target="_blank" rel="noreferrer" className="rounded p-1 text-slate-400 hover:text-white"><ExternalLink size={14} /></a>
              : <button onClick={() => api.wsEvidenceFile(e.id, e.original)} className="rounded p-1 text-slate-400 hover:text-white"><ExternalLink size={14} /></button>}
            {m.can_edit && <button onClick={() => api.wsRemoveEvidence(e.id).then(onChanged)} className="rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>}
          </span>
        </div>
      ))}
      {m.can_edit && (
        <div className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-2">
          <input className={`${inputCls} sm:col-span-2`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title (e.g. Result analysis 2024-25, signed)" />
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx" className="text-xs text-slate-300" onChange={(e) => { setFile(e.target.files[0] || null); setUrl(''); }} />
          <input className={inputCls} value={url} onChange={(e) => { setUrl(e.target.value); setFile(null); }} placeholder="…or a published link (https://)" />
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} />Signed and sealed by the Principal</label>
          <div className="flex items-center gap-2"><button className={btnGhost} onClick={upload} disabled={!file && !url}>Attach</button>{msg && <span className="text-xs text-cyan-300">{msg}</span>}</div>
        </div>
      )}
    </div>
  );
}

function MetricPanel({ framework, programme, code, onClose, onChanged }) {
  const [m, setM] = useState(null);
  const [year, setYear] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.wsMetric(framework, code, programme).then((d) => { setM(d); setYear((y) => y || d.cells[1]?.year || d.cells[0]?.year); }).catch((e) => setError(e.message)), [framework, code, programme]);
  useEffect(() => { load(); }, [load]);
  const refresh = () => { load(); onChanged(); };
  const cell = m?.cells.find((c) => c.year === year);
  // On the page body: the animated page container would otherwise keep the panel under the top bar
  return createPortal(
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/50" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#060b18] p-5" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-right rounded p-1 text-slate-400 hover:text-white"><X size={18} /></button>
        {error && <p className="text-rose-300">{error}</p>}
        {!m ? <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p> : (
          <div className="space-y-5">
            <div>
              <p className="font-mono text-xs text-cyan-300">{framework.toUpperCase()} {m.code}{programme ? ` · ${programme}` : ''} · Criterion {m.criterion}</p>
              <h2 className="mt-1 font-display text-xl font-bold text-white">{m.title}</h2>
              <p className="mt-1 text-xs text-slate-400">{m.kind === 'QnM' ? 'Quantitative: checked by NAAC\'s data validation (DVV) against the documents' : 'Qualitative: judged by the peer team from the write-up and the visit'}</p>
            </div>
            {m.evidence.length > 0 && (
              <section>
                <p className={labelCls}>What the peer team asks for</p>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-300">{m.evidence.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
            )}
            {m.live && (
              <section className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm">
                <p className="text-[11px] uppercase tracking-wider text-cyan-300">CampusSphere reads now</p>
                <p className="mt-1 text-slate-100">{m.live.value}</p>
                {m.live.detail && <p className="mt-1 text-xs text-slate-400">{m.live.detail}</p>}
              </section>
            )}
            <section>
              <p className={labelCls}>Year</p>
              <div className="flex flex-wrap gap-1.5">
                {m.cells.map((c) => (
                  <button key={c.year} onClick={() => setYear(c.year)}
                          className={`rounded-lg px-2.5 py-1 text-xs ${c.year === year ? 'ring-1 ring-cyan-300' : ''} ${(CELL[c.status] || CELL.missing).cls}`}>
                    {c.year}{c.year === m.current_year ? ' (now)' : ''}
                  </button>
                ))}
              </div>
            </section>
            {cell && (
              <>
                <section>
                  <p className={labelCls}>Value for {cell.year} · <span className="normal-case text-slate-500">{(CELL[cell.status] || CELL.missing).label}{cell.origin && cell.origin !== 'live' && cell.origin !== 'generated' ? ` · ${cell.origin}` : ''}</span></p>
                  {m.can_edit ? <YearEditor key={`${code}-${cell.year}-${cell.entered_at}`} m={m} cell={cell} framework={framework} programme={programme} onSaved={refresh} />
                    : <p className="text-sm text-slate-300">{cellText(cell, m.unit)}</p>}
                </section>
                <section>
                  <p className={labelCls}>Evidence for {cell.year}</p>
                  <Evidence m={m} year={cell.year} items={m.evidence_by_year[cell.year] || []} framework={framework} programme={programme} onChanged={refresh} />
                </section>
              </>
            )}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

function Team({ canManage }) {
  const [team, setTeam] = useState([]);
  const [people, setPeople] = useState([]);
  const [f, setF] = useState({ role: 'iqac_coordinator', user_id: '', criterion: '1', programme: 'IT', framework: 'naac', code: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { api.wsTeam().then(setTeam); if (canManage) api.wsPeople().then(setPeople); }, [canManage]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const add = async (e) => { e.preventDefault(); try { setTeam(await api.wsTeamAdd(f)); setMsg('Added'); } catch (err) { setMsg(err.message); } };
  const scope = (r) => r.role === 'criterion_incharge' ? `Criterion ${r.criterion}` : r.role === 'nba_coordinator' ? `${r.programme} programme` : r.role === 'metric_owner' ? `${r.framework?.toUpperCase()} ${r.code}` : 'All criteria';
  return (
    <div className="space-y-5">
      <section className="glass rounded-2xl p-5">
        <h2 className="section-title mb-3">Accreditation team</h2>
        {team.length === 0 ? <p className="text-sm text-slate-400">Nobody assigned yet. Start with the IQAC Coordinator, then a criterion in-charge for each NAAC criterion and an NBA coordinator per programme.</p> : (
          <table className="w-full text-sm">
            <tbody>
              {team.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="py-2 text-slate-200">{ROLE_LABEL[r.role]}</td><td className="text-slate-300">{scope(r)}</td>
                  <td className="text-slate-200">{r.name} <span className="text-xs text-slate-500">{r.department}</span></td>
                  <td className="text-right">{canManage && <button onClick={() => api.wsTeamRemove(r.id).then(setTeam)} className="rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {canManage && (
        <form onSubmit={add} className="glass grid gap-3 rounded-2xl p-5 sm:grid-cols-6">
          <div className="sm:col-span-2"><label className={labelCls}>Role</label>
            <select className={inputCls} value={f.role} onChange={set('role')}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="sm:col-span-4"><label className={labelCls}>Person</label>
            <select className={inputCls} value={f.user_id} onChange={set('user_id')} required>
              <option value="">Select a faculty / staff account</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.department}</option>)}
            </select></div>
          {f.role === 'criterion_incharge' && <div className="sm:col-span-2"><label className={labelCls}>NAAC criterion</label>
            <select className={inputCls} value={f.criterion} onChange={set('criterion')}>{[1, 2, 3, 4, 5, 6, 7].map((c) => <option key={c} value={String(c)}>Criterion {c}</option>)}</select></div>}
          {f.role === 'nba_coordinator' && <div className="sm:col-span-2"><label className={labelCls}>Programme</label>
            <select className={inputCls} value={f.programme} onChange={set('programme')}><option>IT</option><option>CIVIL</option></select></div>}
          {f.role === 'metric_owner' && <>
            <div className="sm:col-span-2"><label className={labelCls}>Framework</label><select className={inputCls} value={f.framework} onChange={set('framework')}><option value="naac">NAAC</option><option value="nba">NBA</option></select></div>
            <div className="sm:col-span-2"><label className={labelCls}>Metric code</label><input className={inputCls} value={f.code} onChange={set('code')} placeholder="2.6.3" /></div>
          </>}
          <div className="flex items-end gap-2 sm:col-span-6"><button className={btnPrimary}>Assign</button>{msg && <span className="text-sm text-cyan-300">{msg}</span>}</div>
        </form>
      )}
    </div>
  );
}

const FACT_LABELS = {
  naac_status: 'NAAC accreditation', nba_status: 'NBA accreditation', autonomous: 'Autonomous status', affiliation: 'Affiliation',
  aicte: 'AICTE approval', nirf: 'NIRF', iqac_coordinator: 'IQAC Coordinator', principal: 'Principal', established: 'Established',
  aqar: 'AQAR reports', ssr: 'Self Study Report', iqac_minutes: 'IQAC minutes', programmes: 'Programmes offered', address: 'Address',
};

function Facts({ canEdit }) {
  const [facts, setFacts] = useState(null);
  const load = () => api.wsFacts().then(setFacts);
  useEffect(() => { load(); }, []);
  if (!facts) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p>;
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="section-title">College facts</h2>
      <p className="mb-3 mt-1 text-xs text-slate-400">Read from the college website by CampusSphere's crawler. The IQAC confirms each one before it goes into a report.</p>
      {facts.length === 0 ? <p className="text-sm text-slate-400">No facts recorded yet.</p> : (
        <div className="divide-y divide-white/5">
          {facts.map((f) => (
            <div key={f.key} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr_auto] sm:gap-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">{FACT_LABELS[f.key] || f.key.replace(/_/g, ' ')}</p>
              <div className="min-w-0 text-sm text-slate-200">
                <p className="whitespace-pre-line break-words">{f.value}</p>
                {f.source_url && <a href={f.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline"><ExternalLink size={11} /> source</a>}
              </div>
              <div className="text-xs">
                {f.verified ? <span className="rounded bg-emerald-400/15 px-2 py-0.5 text-emerald-300">Confirmed</span>
                  : canEdit ? <button className="rounded bg-amber-400/15 px-2 py-0.5 text-amber-200 hover:bg-amber-400/25" onClick={() => api.wsFactSet({ ...f, verified: true }).then(load)}>Confirm</button>
                  : <span className="rounded bg-amber-400/15 px-2 py-0.5 text-amber-200">To confirm</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AccreditationWorkspace() {
  const [access, setAccess] = useState(null);
  const [framework, setFramework] = useState('naac');
  const [programme, setProgramme] = useState('IT');
  const [tab, setTab] = useState('metrics');
  const [grid, setGrid] = useState(null);
  const [open, setOpen] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const prog = framework === 'nba' ? programme : '';
  const load = useCallback(() => { setError(''); return api.wsGrid(framework, prog).then(setGrid).catch((e) => setError(e.message)); }, [framework, prog]);
  useEffect(() => { api.wsAccess().then(setAccess).catch(() => setAccess({ view: false })); }, []);
  useEffect(() => { if (access?.view) { setGrid(null); load(); } }, [access, load]);
  const years = useMemo(() => grid?.years || [], [grid]);

  if (!access) return null;
  if (!access.view) return <PageTransition className="mx-auto max-w-5xl px-4 pt-28 text-slate-400">The IQAC, criterion in-charges, NBA coordinators and management can open the accreditation workspace.</PageTransition>;

  const snapshot = async () => { try { setMsg((await api.wsSnapshot(framework, prog)).message); load(); } catch (e) { setMsg(e.message); } };

  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Accreditation workspace" title={framework === 'naac' ? 'NAAC: every metric, every year' : `NBA: ${programme} programme`} />
      <div className="flex flex-wrap items-center gap-2">
        {[['naac', 'NAAC'], ['nba', 'NBA']].map(([k, l]) => (
          <button key={k} onClick={() => setFramework(k)} className={`rounded-full px-4 py-1.5 text-sm ${framework === k ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{l}</button>
        ))}
        {framework === 'nba' && (
          <select className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white" value={programme} onChange={(e) => setProgramme(e.target.value)}>
            <option value="IT">IT</option><option value="CIVIL">Civil</option>
          </select>
        )}
        <span className="mx-2 h-5 w-px bg-white/10" />
        {[['metrics', 'Metrics'], ...(framework === 'naac' ? [['profile', 'Extended Profile']] : []), ['team', 'Team'], ['facts', 'College facts']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-violet-400/20 text-violet-200' : 'bg-white/5 text-slate-400'}`}>{l}</button>
        ))}
        {access.edit_all && tab === 'metrics' && <button className={`${btnGhost} ml-auto`} onClick={snapshot}>Store this year's live readings</button>}
      </div>
      {msg && <p className="text-sm text-cyan-300">{msg}</p>}
      {error && <p className="text-rose-300">{error}</p>}

      {tab === 'team' && <Team canManage={access.manage_team} />}
      {tab === 'facts' && <Facts canEdit={access.edit_all} />}
      {(tab === 'metrics' || tab === 'profile') && (!grid ? <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</p> : (
        <>
          <p className="text-xs text-slate-500">{grid.version}. Assessment period: {grid.assessment_years[grid.assessment_years.length - 1]} to {grid.assessment_years[0]}; {grid.current_year} is the year in progress.</p>
          <Summary s={grid.summary} />
          {tab === 'profile' ? (
            <section className="glass rounded-2xl p-5">
              <h2 className="section-title mb-3">Extended Profile</h2>
              <p className="mb-3 text-xs text-slate-400">The institution's basic numbers per year. NAAC checks every metric against these, so they must agree.</p>
              <MetricRows rows={grid.profile} years={years} onOpen={setOpen} />
            </section>
          ) : grid.criteria.map((c) => (
            <section key={c.code} className="glass rounded-2xl p-5">
              <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setExpanded((s) => ({ ...s, [c.code]: !s[c.code] }))}>
                <span className="flex items-center gap-2">
                  {expanded[c.code] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="section-title">Criterion {c.code} · {c.title}</span>
                  <span className="text-xs text-slate-500">{c.marks} marks · {c.metrics.length} metrics</span>
                </span>
                <span className="flex items-center gap-3 text-xs">
                  <span className="w-28"><span className="block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-emerald-400" style={{ width: `${c.summary.ready_pct}%` }} /></span></span>
                  <span className="w-20 text-right text-slate-300">{c.summary.ready_pct}% ready</span>
                </span>
              </button>
              {expanded[c.code] && <div className="mt-4"><MetricRows rows={c.metrics} years={years} onOpen={setOpen} /></div>}
            </section>
          ))}
        </>
      ))}
      {open && <MetricPanel framework={framework} programme={prog} code={open} onClose={() => setOpen(null)} onChanged={load} />}
    </PageTransition>
  );
}
