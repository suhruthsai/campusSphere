// CollegeDocs.jsx — "College documents": what the college website publishes (syllabus, academic calendar, fee
// structure, admission lists, exam notices, scholarships, policies), read from mvsrec.edu.in so students don't hunt
// for them. PDFs hosted by the college are kept in the app; Google Drive documents open at Drive.
import { BadgeCheck, CloudDownload, Download, ExternalLink, Eye, FileText, Globe2, Loader2, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Panel, { PanelNote } from '../../components/ui/Panel.jsx';
import { fmtIst } from '../../components/services/requestUi.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { lockerApi, saveBlob } from '../../utils/api.js';
import { fmtSize, Viewer } from './lockerUi.jsx';

const PAGE = 60;

export default function CollegeDocs() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(() => lockerApi.college().then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  // While the admin's refresh runs, look again every few seconds
  useEffect(() => {
    if (!data?.running) return undefined;
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [data?.running, load]);
  useEffect(() => { setShown(PAGE); }, [q, cat]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.items || []).filter((i) => (cat === 'all' || i.category === cat)
      && (!needle || `${i.title} ${i.page_title || ''} ${i.category_label}`.toLowerCase().includes(needle)));
  }, [data, q, cat]);
  const featured = (data?.items || []).filter((i) => i.featured);

  const download = async (doc) => {
    try { saveBlob(await lockerApi.collegeBlob(doc.id), `${doc.title.replace(/[^\w .-]/g, '').slice(0, 80) || 'college-document'}.pdf`); }
    catch (e) { setError(e.message); }
  };
  const refresh = async () => {
    setError('');
    try { const r = await lockerApi.collegeRefresh(); setNote(r.message); load(); } catch (e) { setError(e.message); }
  };

  if (!data && !error) return <PanelNote>Opening the college library…</PanelNote>;
  return (
    <div>
      {error && <p role="alert" className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">{error}</p>}
      {note && <p role="status" className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{note}</p>}

      {data && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: 'var(--text-2)' }}>
              <span className="inline-flex items-center gap-1.5"><Globe2 size={15} style={{ color: 'var(--brand-text)' }} /> <b style={{ color: 'var(--text)' }}>{data.total}</b> documents read from <a href={data.source} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--brand-text)' }}>mvsrec.edu.in</a></span>
              <span className="inline-flex items-center gap-1.5"><CloudDownload size={14} /> {data.stored} kept in CampusSphere</span>
              {data.updated_at && <span className="text-xs" style={{ color: 'var(--text-3)' }}>Updated {fmtIst(data.updated_at)}</span>}
            </p>
            {user?.role === 'admin' && (
              <button type="button" onClick={refresh} disabled={data.running} className="f-btn-ghost !py-1.5 !text-xs">
                {data.running ? <><Loader2 size={13} className="animate-spin" /> Reading the website…</> : <><RefreshCw size={13} /> Refresh from the website</>}
              </button>
            )}
          </div>

          {data.total === 0 ? (
            <div className="ds-card px-6 py-12 text-center">
              <Globe2 className="mx-auto mb-3" size={30} style={{ color: 'var(--brand-text)' }} />
              <p className="font-display text-lg font-bold" style={{ color: 'var(--text)' }}>{data.running ? 'Reading the college website…' : 'No college documents yet'}</p>
              <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: 'var(--text-2)' }}>
                {data.running ? 'This takes a few minutes the first time. Check back shortly.' : 'The library fills itself from the college website. An admin can start a refresh from here.'}
              </p>
            </div>
          ) : (
            <>
              {featured.length > 0 && cat === 'all' && !q && (
                <Panel title="Needed for admission" icon={BadgeCheck} iconColor="#34d399" className="mb-5">
                  <ul className="space-y-2">
                    {featured.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.07)' }}>
                        <p className="min-w-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>{d.title}</p>
                        <Actions doc={d} onView={() => setViewing(d)} onDownload={() => download(d)} />
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              <div className="relative mb-4 max-w-xl">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search college documents" placeholder="Search syllabus, fee structure, calendar, circulars…" className="ds-input !rounded-xl !py-2.5 !pl-10 text-sm" />
              </div>
              <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Document type">
                {[{ key: 'all', label: 'All', count: data.total }, ...data.categories].map((c) => (
                  <button key={c.key} type="button" role="tab" aria-selected={cat === c.key} onClick={() => setCat(c.key)}
                    className="rounded-full border px-3.5 py-1.5 text-sm font-semibold transition"
                    style={cat === c.key ? { background: 'var(--brand-grad)', color: '#fff', borderColor: 'transparent' } : { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>
                    {c.label} <span className="opacity-70">{c.count}</span>
                  </button>
                ))}
              </div>

              {items.length === 0 ? <PanelNote>No document matches “{q}”.</PanelNote> : (
                <ul className="space-y-2.5">
                  {items.slice(0, shown).map((d) => (
                    <li key={d.id} className="ds-card flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: d.kind === 'file' ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'linear-gradient(135deg,#38bdf8,#3b82f6)' }}>
                        {d.kind === 'file' ? <FileText size={18} /> : <ExternalLink size={17} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold" style={{ color: 'var(--text)' }} title={d.title}>{d.title}</p>
                        <p className="flex flex-wrap items-center gap-x-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
                          <span>{d.category_label}</span>
                          {d.published_on && <span>· {d.published_on}</span>}
                          {d.page_title && <span className="truncate">· from “{d.page_title}”</span>}
                          {d.size_bytes ? <span>· {fmtSize(d.size_bytes)}</span> : null}
                        </p>
                      </div>
                      <span className="rounded-full border px-2 py-0.5 text-[10.5px] font-semibold" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                        {d.kind === 'file' ? 'Kept in CampusSphere' : d.host === 'drive' ? 'Opens on Google Drive' : 'Opens on the college site'}
                      </span>
                      <Actions doc={d} onView={() => setViewing(d)} onDownload={() => download(d)} />
                    </li>
                  ))}
                </ul>
              )}
              {items.length > shown && (
                <div className="mt-4 text-center"><button type="button" className="f-btn-ghost" onClick={() => setShown((n) => n + PAGE)}>Show more ({items.length - shown} left)</button></div>
              )}
              <p className="mt-6 text-[11px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                These are the college’s own published documents, listed from its website. Google Drive documents can’t be copied by software, so they open at Drive. If something looks out of date, check the website.
              </p>
            </>
          )}
        </>
      )}
      {viewing && <Viewer title={viewing.title} contentType="application/pdf" load={() => lockerApi.collegeBlob(viewing.id)} onClose={() => setViewing(null)} download={() => download(viewing)} />}
    </div>
  );
}

function Actions({ doc, onView, onDownload }) {
  if (doc.kind === 'link') {
    return (
      <a href={doc.open_url} target="_blank" rel="noopener noreferrer" className="f-btn !px-3 !py-1.5 !text-xs">
        <ExternalLink size={13} /> Open
      </a>
    );
  }
  return (
    <div className="flex gap-1.5">
      <button type="button" onClick={onView} className="f-btn !px-3 !py-1.5 !text-xs"><Eye size={13} /> View</button>
      <button type="button" onClick={onDownload} aria-label={`Download ${doc.title}`} className="f-btn-ghost !px-2.5 !py-1.5 !text-xs"><Download size={13} /></button>
    </div>
  );
}
