// Admin: Mitra's college knowledge base. What has been crawled from mvsrec.edu.in and when, a Refresh
// button, a test search ("what would Mitra find?"), PDF uploads for documents the crawler can't read
// (Drive files, scans), and the questions people ask Mitra, so missing answers show up.
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText, RefreshCw, Search, Upload } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';
import { knowledgeApi } from '../../utils/api.js';

const when = (iso) => (iso ? new Date(`${iso}`.endsWith('Z') ? iso : `${iso}Z`).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const SOURCE = { site: 'Website page', drive: 'Drive file (name + link)', upload: 'Uploaded PDF' };
const KIND = { html: 'page', pdf: 'PDF', link: 'name + link only' };

function Status({ status, onRefresh, busy }) {
  const docs = status?.documents || {};
  const last = status?.last_crawl;
  return (
    <section className="grid gap-3 sm:grid-cols-4">
      {[['Website pages', docs.site || 0], ['Drive files listed', docs.drive || 0], ['Uploaded PDFs', docs.upload || 0], ['Searchable passages', status?.chunks || 0]].map(([k, v]) => (
        <div key={k} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="text-xs text-slate-400">{k}</p>
          <p className="font-display text-2xl font-bold text-white">{v.toLocaleString('en-IN')}</p>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 px-4 py-3 sm:col-span-4">
        <div className="text-sm text-slate-300">
          {status?.running ? <span className="text-cyan-300">Crawling the college website now…</span>
            : last ? <>Last crawl <b className="text-white">{when(last.finished_at || last.started_at)}</b> ({last.trigger}):{' '}
              <span className={last.status === 'failed' ? 'text-rose-300' : ''}>{last.status}</span>, {last.pages} documents, {last.changed} new or changed, {last.removed} removed
              {last.note && <span className="block text-xs text-amber-200">{last.note}</span>}</>
              : 'Not crawled yet.'}
          {status?.next_crawl && !status.running && <span className="block text-xs text-slate-400">Next automatic crawl: {when(status.next_crawl)} (weekly)</span>}
        </div>
        <button className={btnPrimary} onClick={onRefresh} disabled={busy || status?.running}>
          <RefreshCw size={14} className={`mr-1.5 inline ${status?.running ? 'animate-spin' : ''}`} />Refresh knowledge
        </button>
      </div>
    </section>
  );
}

function TestSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);
  const run = async (e) => {
    e.preventDefault();
    if (q.trim()) setHits(await knowledgeApi.search(q.trim()).catch(() => []));
  };
  return (
    <section className="space-y-3 pt-4">
      <h2 className="section-title">What would Mitra find?</h2>
      <form onSubmit={run} className="flex gap-2">
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. hostel fee for girls" aria-label="Test search" />
        <button className={btnGhost}><Search size={14} className="mr-1 inline" />Search</button>
      </form>
      {hits && (hits.length === 0 ? <p className="text-sm text-amber-200">Nothing matches: Mitra would say the website doesn't cover this.</p> : (
        <ol className="space-y-2">
          {hits.map((h) => (
            <li key={h.id} className="rounded-xl border border-white/5 px-4 py-2.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                {h.title}{h.heading && <span className="text-xs font-normal text-slate-400">› {h.heading}</span>}
                <span className="text-xs font-normal text-slate-500">score {h.score}</span>
                {!h.url.startsWith('upload://') && <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300" aria-label="Open source"><ExternalLink size={12} /></a>}
              </p>
              <p className="mt-1 line-clamp-3 text-xs text-slate-400">{h.text}</p>
            </li>
          ))}
        </ol>
      ))}
    </section>
  );
}

function UploadPdf({ onDone }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg('');
    try {
      const doc = await knowledgeApi.upload(file, title, link);
      setMsg(`Added "${doc.title}" (${doc.chars.toLocaleString('en-IN')} characters). Mitra can answer from it now.`);
      setFile(null); setTitle(''); setLink('');
      e.target.reset();
      onDone();
    } catch (x) {
      setMsg(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 pt-4">
      <h2 className="section-title">Add a document</h2>
      <p className="text-sm text-slate-400">
        Google Drive files linked from the website (fee structure, notices, brochure) can't be read by the crawler, and scanned
        notices have no text. Download an important one and upload it here so Mitra can answer from it. Paste its Drive link so
        people can open the original.
      </p>
      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-white/5 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className={labelCls}>PDF</label>
          <input type="file" accept="application/pdf" required onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-300" /></div>
        <div><label className={labelCls}>Title</label><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fee structure 2025-26" maxLength={200} /></div>
        <div><label className={labelCls}>Original link (optional)</label><input className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/file/d/…" /></div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className={btnPrimary} disabled={busy || !file}><Upload size={14} className="mr-1.5 inline" />{busy ? 'Reading…' : 'Add to knowledge'}</button>
          {msg && <span className="text-sm text-slate-300">{msg}</span>}
        </div>
      </form>
    </section>
  );
}

function Asked() {
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [rows, setRows] = useState(null);
  useEffect(() => { knowledgeApi.asked(onlyMissing).then(setRows).catch(() => setRows([])); }, [onlyMissing]);
  return (
    <section className="space-y-3 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">What people ask Mitra</h2>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Only questions the website couldn't answer
        </label>
      </div>
      <p className="text-sm text-slate-400">Her English search for each question (no names or accounts are kept). Unanswered ones show what to add to the website or upload here.</p>
      {!rows ? <p className="text-sm text-slate-400">Loading…</p> : rows.length === 0 ? <p className="text-sm text-slate-400">Nothing yet.</p> : (
        <ul className="divide-y divide-white/5 rounded-xl border border-white/5">
          {rows.map((r) => (
            <li key={r.question} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="text-slate-200">{r.question}</span>
              <span className="shrink-0 text-xs text-slate-400">{r.times}× · last {when(r.last_asked)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Documents({ reloadKey }) {
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const load = useCallback(() => {
    knowledgeApi.documents({ ...(source && { source }), ...(q && { q }), limit: 300 }).then(setRows).catch(() => setRows([]));
  }, [source, q]);
  useEffect(() => { load(); }, [load, reloadKey]);
  const remove = async (d) => {
    if (window.confirm(`Remove "${d.title}" from Mitra's knowledge?`)) { await knowledgeApi.remove(d.id); load(); }
  };
  return (
    <section className="space-y-3 pt-4">
      <h2 className="section-title">Documents</h2>
      <div className="flex flex-wrap gap-2">
        <select className={`${inputCls} w-auto`} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="">All sources</option>
          {Object.entries(SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className={`${inputCls} max-w-xs`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title" aria-label="Filter by title" />
      </div>
      {!rows ? <p className="text-sm text-slate-400">Loading…</p> : (
        <ul className="divide-y divide-white/5 rounded-xl border border-white/5">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm text-white"><FileText size={13} className="shrink-0 text-cyan-300" />{d.title}</p>
                <p className="text-xs text-slate-500">{SOURCE[d.source]} · {KIND[d.kind]} · {d.passages} passages · checked {when(d.checked_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                {!d.url.startsWith('upload://') && <a href={d.url} target="_blank" rel="noopener noreferrer" className={btnGhost}>Open</a>}
                {d.source === 'upload' && <button className={btnGhost} onClick={() => remove(d)}>Remove</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function KnowledgeBase() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loadStatus = useCallback(() => knowledgeApi.status().then(setStatus).catch(() => {}), []);
  useEffect(() => { loadStatus(); }, [loadStatus]);
  // While a crawl runs, keep the numbers moving
  useEffect(() => {
    if (!status?.running) return undefined;
    const t = setInterval(loadStatus, 5000);
    return () => clearInterval(t);
  }, [status?.running, loadStatus]);

  const refresh = async () => {
    setBusy(true);
    try { await knowledgeApi.refresh(); } catch { /* already running */ }
    setBusy(false);
    loadStatus();
  };

  return (
    <PageTransition className="mx-auto min-h-screen max-w-5xl space-y-4 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Mitra · college knowledge" title="What Mitra knows about the college." />
      <p className="text-sm text-slate-400">
        Mitra answers college questions only from the official website (mvsrec.edu.in), crawled automatically every week, and the
        documents uploaded here. Each answer shows its source.
      </p>
      <Status status={status} onRefresh={refresh} busy={busy} />
      <TestSearch />
      <UploadPdf onDone={() => { loadStatus(); setReloadKey((k) => k + 1); }} />
      <Asked />
      <Documents reloadKey={reloadKey} />
    </PageTransition>
  );
}
