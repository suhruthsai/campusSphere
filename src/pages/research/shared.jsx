// Shared bits of the Faculty & research pages: item kinds, the add-item form, and an item row.
import { useState } from 'react';
import { CheckCircle2, ExternalLink, Paperclip, Trash2 } from 'lucide-react';
import { researchApi as api } from '../../utils/api.js';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';

export const KINDS = {
  journal: 'Journal paper', conference: 'Conference paper', book: 'Book', chapter: 'Book chapter', patent: 'Patent',
  project: 'Funded project', consultancy: 'Consultancy', fdp_attended: 'FDP / STTP attended', fdp_organised: 'FDP / STTP organised',
  resource_person: 'Resource person', phd_guided: 'PhD guided', award: 'Award',
};
const INDEXING = { scopus: 'Scopus', wos: 'Web of Science', ugc_care: 'UGC-CARE', other: 'Other' };
export const yearNow = () => { const d = new Date(); const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };

export function AddItem({ facultyId, onDone }) {
  const [f, setF] = useState({ kind: 'journal', title: '', venue: '', indexing: 'scopus', year: yearNow(), on_date: '', amount_lakh: '', status: '', days: '', link: '' });
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const data = { kind: f.kind, title: f.title, year: f.year };
    if (facultyId) data.faculty_id = facultyId;
    ['venue', 'on_date', 'status', 'link'].forEach((k) => { if (f[k]) data[k] = f[k]; });
    if (f.kind === 'journal') data.indexing = f.indexing;
    if (f.amount_lakh) data.amount_lakh = Number(f.amount_lakh);
    if (f.days) data.days = Number(f.days);
    try {
      const item = await api.addItem(data);
      if (file) await api.upload(item.id, file);
      setMsg('Added: your HOD verifies it against the evidence.');
      setF((s) => ({ ...s, title: '', venue: '', amount_lakh: '', days: '', link: '', on_date: '' }));
      setFile(null);
      onDone?.();
    } catch (err) { setMsg(err.message); }
  };
  const money = ['project', 'consultancy'].includes(f.kind);
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-2"><label className={labelCls}>Type</label>
        <select className={inputCls} value={f.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="sm:col-span-4"><label className={labelCls}>Title</label><input className={inputCls} required minLength={3} value={f.title} onChange={set('title')} /></div>
      <div className="sm:col-span-2"><label className={labelCls}>{money ? 'Funding agency / client' : 'Journal / conference / publisher / organiser'}</label><input className={inputCls} value={f.venue} onChange={set('venue')} /></div>
      {f.kind === 'journal' && <div><label className={labelCls}>Indexed in</label><select className={inputCls} value={f.indexing} onChange={set('indexing')}>{Object.entries(INDEXING).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>}
      <div><label className={labelCls}>Academic year</label><input className={inputCls} required pattern="\d{4}-\d{2}" value={f.year} onChange={set('year')} /></div>
      <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={f.on_date} onChange={set('on_date')} /></div>
      {money && <div><label className={labelCls}>Amount (₹ lakh)</label><input type="number" step="0.01" required className={inputCls} value={f.amount_lakh} onChange={set('amount_lakh')} /></div>}
      {f.kind.startsWith('fdp') && <div><label className={labelCls}>Days</label><input type="number" className={inputCls} value={f.days} onChange={set('days')} /></div>}
      <div className="sm:col-span-3"><label className={labelCls}>DOI / link</label><input className={inputCls} value={f.link} onChange={set('link')} placeholder="https://doi.org/…" /></div>
      <div className="sm:col-span-3"><label className={labelCls}>Evidence file (certificate, first page, sanction letter)</label>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" className="text-xs text-slate-300" onChange={(e) => setFile(e.target.files[0] || null)} /></div>
      <div className="flex items-center gap-3 sm:col-span-6"><button className={btnPrimary}>Add</button>{msg && <span className="text-sm text-cyan-300">{msg}</span>}</div>
    </form>
  );
}

export function ItemRow({ i, canVerify, canDelete, onChanged, showFaculty }) {
  const [msg, setMsg] = useState('');
  const run = async (fn) => { try { await fn(); setMsg(''); onChanged(); } catch (e) { setMsg(e.message); } };
  return (
    <tr className="border-t border-white/5 align-top">
      <td className="py-2 pr-3 text-slate-200">
        <span className="text-[11px] uppercase tracking-wider text-cyan-300">{KINDS[i.kind]}</span>
        <div>{i.title}</div>
        <div className="text-[11px] text-slate-500">{[i.venue, i.indexing && INDEXING[i.indexing], i.amount_lakh && `₹${i.amount_lakh} L`, i.days && `${i.days} days`, i.status].filter(Boolean).join(' · ')}</div>
        {msg && <div className="text-xs text-amber-300">{msg}</div>}
      </td>
      {showFaculty && <td className="py-2 pr-3 text-sm text-slate-300">{i.faculty}</td>}
      <td className="py-2 pr-3 text-sm text-slate-400">{i.year}</td>
      <td className="py-2 pr-3 text-xs">
        {i.link && <a href={i.link} target="_blank" rel="noreferrer" className="mr-2 inline-flex items-center gap-1 text-cyan-300"><ExternalLink size={12} />link</a>}
        {i.evidence_name && <button onClick={() => api.evidence(i.id, i.evidence_name)} className="inline-flex items-center gap-1 text-cyan-300"><Paperclip size={12} />file</button>}
        {!i.has_evidence && <span className="text-amber-300/80">no evidence</span>}
      </td>
      <td className="py-2 text-right text-xs whitespace-nowrap">
        {i.verified ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 size={12} />verified</span> : <span className="text-slate-500">awaiting</span>}
        {canVerify && <button className={`${btnGhost} ml-2 !px-2 !py-1 text-xs`} onClick={() => run(() => api.verify(i.id, !i.verified))}>{i.verified ? 'Unverify' : 'Verify'}</button>}
        {canDelete && !i.verified && <button onClick={() => run(() => api.removeItem(i.id))} className="ml-1 rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 size={13} /></button>}
      </td>
    </tr>
  );
}
