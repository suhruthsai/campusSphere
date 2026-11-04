// JoiningDocRules.jsx — admin: which documents a new joinee must give, who has to give them, whether the college
// keeps the original, how many photocopy sets to bring, and the earliest date a certificate may carry.
import { useCallback, useEffect, useState } from 'react';
import { FilePlus2, FileText } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import Panel, { PanelNote } from '../../components/ui/Panel.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';
import { joiningApi } from '../../utils/api.js';

const WHO = [['always', 'Every joinee'], ['not_oc', 'Not OC / EWS (caste certificate)'], ['ews', 'EWS category'], ['reimbursement', 'Applying for fee reimbursement'], ['other_board', 'Intermediate outside Telangana']];
const blank = { label: '', hint: '', when: 'always', original: false, images_only: false, copies: 3, copy_unit: 'sets', issued_after: '', active: true };
const bodyOf = (r) => ({ label: r.label, hint: r.hint || null, when: r.when, original: !!r.original, images_only: !!r.images_only, copies: Number(r.copies) || 0,
  copy_unit: r.copy_unit || 'sets', issued_after: r.issued_after || null, active: !!r.active, sort_order: r.sort_order || 0 });

function Fields({ r, set, idp }) {
  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-3"><label className={labelCls} htmlFor={`${idp}-l`}>Document</label><input id={`${idp}-l`} className={inputCls} value={r.label} onChange={(e) => set({ label: e.target.value })} maxLength={140} /></div>
      <div className="sm:col-span-3"><label className={labelCls} htmlFor={`${idp}-w`}>Who must give it</label>
        <select id={`${idp}-w`} className={inputCls} value={r.when} onChange={(e) => set({ when: e.target.value })}>{WHO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="sm:col-span-6"><label className={labelCls} htmlFor={`${idp}-h`}>Note shown to the student</label><input id={`${idp}-h`} className={inputCls} value={r.hint || ''} onChange={(e) => set({ hint: e.target.value })} maxLength={300} /></div>
      <div><label className={labelCls} htmlFor={`${idp}-c`}>Copies to bring</label><input id={`${idp}-c`} type="number" min="0" max="10" className={inputCls} value={r.copies} onChange={(e) => set({ copies: e.target.value })} /></div>
      <div><label className={labelCls} htmlFor={`${idp}-u`}>Counted in</label>
        <select id={`${idp}-u`} className={inputCls} value={r.copy_unit} onChange={(e) => set({ copy_unit: e.target.value })}><option value="sets">Photocopy sets</option><option value="photos">Photos</option></select></div>
      <div className="sm:col-span-2"><label className={labelCls} htmlFor={`${idp}-d`}>Certificate must be issued on or after</label><input id={`${idp}-d`} type="date" className={inputCls} value={r.issued_after || ''} onChange={(e) => set({ issued_after: e.target.value })} /></div>
      <div className="flex flex-wrap items-end gap-4 pb-2 text-sm sm:col-span-2" style={{ color: 'var(--text)' }}>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!r.original} onChange={(e) => set({ original: e.target.checked })} /> College keeps the original</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!r.images_only} onChange={(e) => set({ images_only: e.target.checked })} /> Image only</label>
      </div>
    </div>
  );
}

function RuleCard({ rule, onSaved, onError }) {
  const [r, setR] = useState(rule);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setR(rule); setDirty(false); }, [rule]);
  const set = (patch) => { setR((x) => ({ ...x, ...patch })); setDirty(true); };
  const save = async (over = {}) => { try { onSaved(await joiningApi.saveDocRule(rule.id, bodyOf({ ...r, ...over }))); } catch (e) { onError(e.message); } };
  return (
    <li className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', opacity: r.active ? 1 : 0.7 }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text)' }}><FileText size={15} style={{ color: 'var(--brand-text)' }} /> {rule.label}
          {!r.active && <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>Switched off</span>}</p>
        <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
          <input type="checkbox" checked={!!r.active} onChange={(e) => { set({ active: e.target.checked }); save({ active: e.target.checked }); }} /> Collected at joining
        </label>
      </div>
      <Fields r={r} set={set} idp={`r${rule.id}`} />
      {dirty && <button type="button" className={`${btnPrimary} mt-3`} onClick={() => save()}>Save changes</button>}
    </li>
  );
}

export default function JoiningDocRules() {
  const [rules, setRules] = useState(null);
  const [draft, setDraft] = useState(blank);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const load = useCallback(() => joiningApi.docRules().then(setRules).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const saved = () => { setError(''); setNote('Saved.'); load(); };
  const add = async (e) => {
    e.preventDefault();
    try { await joiningApi.addDocRule(bodyOf(draft)); setDraft(blank); saved(); } catch (err) { setError(err.message); setNote(''); }
  };
  return (
    <PageTransition className="mx-auto min-h-screen max-w-5xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Joining · documents" title="Which documents a new student must bring." />
      <p className="max-w-3xl text-sm" style={{ color: 'var(--text-2)' }}>
        Edit this list when the admission notice changes. Students see it on their Joining page, and the Admissions desk uses it to tick off originals and photocopy sets.
        Set “issued on or after” for certificates that must be of the current year (income, EWS): a student who enters an older date is asked for a fresh one.
        Documents already uploaded stay on file when you switch a document off.
      </p>
      {error && <p role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">{error}</p>}
      {note && <p role="status" className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{note}</p>}

      <Panel title="Add a document" icon={FilePlus2} iconColor="#34d399">
        <form onSubmit={add} className="space-y-3">
          <Fields r={draft} set={(p) => setDraft((d) => ({ ...d, ...p }))} idp="new" />
          <button className={btnPrimary} disabled={draft.label.trim().length < 3}>Add to the list</button>
        </form>
      </Panel>

      {!rules ? <PanelNote>Loading…</PanelNote> : <ul className="space-y-3">{rules.map((r) => <RuleCard key={r.id} rule={r} onSaved={saved} onError={(m) => { setError(m); setNote(''); }} />)}</ul>}
    </PageTransition>
  );
}
