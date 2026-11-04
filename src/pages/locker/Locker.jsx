// Locker.jsx — "My documents": one place for the certificates the college issued, the documents uploaded when
// joining, and the files I add myself. Any document can be shared through an expiring link.
import { BadgeCheck, Check, Clock3, Copy, Download, Eye, GraduationCap, History, Link2, Lock, Share2, Trash2, UploadCloud, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import PageTransition from '../../components/PageTransition.jsx';
import Panel, { PanelNote } from '../../components/ui/Panel.jsx';
import { fmtIst } from '../../components/services/requestUi.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { lockerApi, saveBlob } from '../../utils/api.js';
import { fileIcon, fmtSize, Viewer } from './lockerUi.jsx';
import CollegeDocs from './CollegeDocs.jsx';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'college', label: 'From the college' },
  { key: 'self', label: 'My uploads' },
  { key: 'joining', label: 'Joining' },
];
const EXPIRIES = [{ hours: 1, label: '1 hour' }, { hours: 24, label: '24 hours' }, { hours: 168, label: '7 days' }, { hours: 720, label: '30 days' }];
const ACTIONS = {
  uploaded: 'You added', added_by_college: 'The college added', shared: 'You shared', revoked: 'You withdrew a link to',
  opened_by_link: 'Someone opened', deleted: 'You deleted',
};
const absoluteLink = (path) => `${window.location.origin}${path}`;

const TABS = [{ key: 'mine', label: 'My documents' }, { key: 'college', label: 'College documents' }];

export default function Locker() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'college' ? 'college' : 'mine';
  return (
    <PageTransition className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="CampusLocker" title={tab === 'college' ? 'Everything the college publishes, in one place.' : 'Your documents, safe in one place.'} />
      <div className="mb-6 inline-flex rounded-2xl border p-1" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }} role="tablist" aria-label="CampusLocker sections">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setParams(t.key === 'mine' ? {} : { tab: t.key })}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition"
            style={tab === t.key ? { background: 'var(--brand-grad)', color: '#fff', boxShadow: '0 6px 18px rgba(99,102,241,0.32)' } : { color: 'var(--text-2)' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'college' ? <CollegeDocs /> : <MyDocuments />}
    </PageTransition>
  );
}

function MyDocuments() {
  const [data, setData] = useState(null);
  const [shares, setShares] = useState([]);
  const [activity, setActivity] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewing, setViewing] = useState(null);
  const [sharing, setSharing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const reload = useCallback(() => {
    lockerApi.mine().then(setData).catch((e) => setError(e.message));
    lockerApi.shares().then(setShares).catch(() => setShares([]));
    lockerApi.activity().then(setActivity).catch(() => setActivity([]));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const items = useMemo(() => (data?.items || []).filter((i) => (
    filter === 'all' ? true
      : filter === 'college' ? i.source === 'issued' || i.source === 'college'
      : i.source === filter)), [data, filter]);

  const download = async (item) => {
    try { saveBlob(await lockerApi.blob(item.ref), `${item.title}.${item.content_type === 'application/pdf' ? 'pdf' : item.content_type === 'image/png' ? 'png' : 'jpg'}`); }
    catch (e) { setError(e.message); }
  };
  const remove = async (item) => {
    try { await lockerApi.remove(item.ref.split(':')[1]); setNotice(`“${item.title}” deleted.`); setConfirmDelete(null); reload(); }
    catch (e) { setError(e.message); setConfirmDelete(null); }
  };
  const revoke = async (share) => {
    try { await lockerApi.revoke(share.id); setNotice('That link no longer works.'); reload(); } catch (e) { setError(e.message); }
  };
  const activeShares = shares.filter((s) => s.status === 'active');

  return (
    <div>
      {error && <p role="alert" className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">{error}</p>}
      {notice && <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600"><Check size={15} /> {notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <StoragePanel quota={data?.quota} count={data?.items.length} />
        <UploadPanel categories={data?.categories || []} maxBytes={data?.quota.max_file_bytes} onDone={(msg) => { setNotice(msg); setError(''); reload(); }} onError={setError} />
      </div>

      <div className="mt-8 mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter documents">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            className="rounded-full border px-4 py-1.5 text-sm font-semibold transition"
            style={filter === f.key ? { background: 'var(--brand-grad)', color: '#fff', borderColor: 'transparent' } : { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>
            {f.label}
          </button>
        ))}
      </div>

      {!data ? <PanelNote>Opening your locker…</PanelNote>
        : items.length === 0 ? (
          <div className="ds-card px-6 py-12 text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl text-white" style={{ background: 'var(--brand-grad)' }}><Lock size={24} /></span>
            <p className="font-display text-lg font-bold" style={{ color: 'var(--text)' }}>{filter === 'all' ? 'Your locker is empty' : 'Nothing here yet'}</p>
            <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: 'var(--text-2)' }}>
              {filter === 'all' || filter === 'self'
                ? 'Add your ID proofs, mark sheets and offer letters above. Certificates the college issues appear here by themselves once they are approved.'
                : 'Documents the college issues or adds for you appear here automatically.'}
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <DocCard key={item.ref} item={item} onView={() => setViewing(item)} onDownload={() => download(item)}
                       onShare={() => setSharing(item)} onDelete={() => setConfirmDelete(item)} />
            ))}
          </ul>
        )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Panel title="Share links" icon={Link2} iconColor="#38bdf8"
          badge={activeShares.length > 0 ? <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>{activeShares.length} active</span> : null}>
          {shares.length === 0 ? <PanelNote>No links yet. Open a document’s “Share” button to give someone temporary access to that one file.</PanelNote> : (
            <ul className="space-y-2.5">
              {shares.slice(0, 8).map((s) => (
                <li key={s.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', opacity: s.status === 'active' ? 1 : 0.6 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.title}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                        {s.status === 'active' ? `Expires ${fmtIst(s.expires_at)}` : s.status === 'expired' ? 'Expired' : 'Withdrawn'} · opened {s.views} time{s.views === 1 ? '' : 's'}
                      </p>
                    </div>
                    {s.status === 'active' && (
                      <div className="flex shrink-0 gap-1.5">
                        <CopyButton text={absoluteLink(s.path)} />
                        <button type="button" onClick={() => revoke(s)} className="f-btn-danger !px-2.5 !py-1.5 !text-xs">Withdraw</button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity" icon={History} iconColor="#a78bfa">
          {activity.length === 0 ? <PanelNote>Nothing yet. Every upload, share and link opening is listed here.</PanelNote> : (
            <ol className="relative max-h-[320px] space-y-3.5 overflow-y-auto border-l pl-5 no-scrollbar" style={{ borderColor: 'var(--border-strong)' }}>
              {activity.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2" style={{ borderColor: a.action === 'opened_by_link' ? '#f59e0b' : 'var(--brand-2)', background: 'var(--surface-solid)' }} />
                  <p className="text-[13px]" style={{ color: 'var(--text)' }}>{ACTIONS[a.action] || a.action} <b>{a.title}</b></p>
                  <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{fmtIst(a.at)}{a.detail ? ` · ${a.detail}` : ''}</p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {viewing && <Viewer title={viewing.title} contentType={viewing.content_type} load={() => lockerApi.blob(viewing.ref)} onClose={() => setViewing(null)} download={() => download(viewing)} />}
      {sharing && <ShareDialog item={sharing} onClose={() => { setSharing(null); reload(); }} />}
      {confirmDelete && (
        <Dialog title="Delete this file?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>“{confirmDelete.title}” will be removed for good, and any links to it stop working.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="f-btn-ghost" onClick={() => setConfirmDelete(null)}>Keep it</button>
            <button type="button" className="f-btn-danger" onClick={() => remove(confirmDelete)}><Trash2 size={14} /> Delete</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function StoragePanel({ quota, count }) {
  const used = quota?.used_bytes || 0;
  const limit = quota?.limit_bytes || 1;
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <Panel title="Your space" icon={Lock} iconColor="#34d399">
      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-3xl font-extrabold" style={{ color: 'var(--text)' }}>{quota ? fmtSize(used) : '…'}<span className="ml-1.5 text-sm font-medium" style={{ color: 'var(--text-3)' }}>of {fmtSize(limit)}</span></p>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>{count ?? '…'} document{count === 1 ? '' : 's'}</p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Space used">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, used ? 2 : 0)}%`, background: pct > 85 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'var(--brand-grad)' }} />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
        Only the files you add yourself use this space. Certificates and documents from the college are always free to keep.
      </p>
    </Panel>
  );
}

function UploadPanel({ categories, maxBytes, onDone, onError }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('other');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const pick = (f) => {
    if (!f) return;
    if (maxBytes && f.size > maxBytes) { onError(`That file is ${fmtSize(f.size)}; the limit is ${fmtSize(maxBytes)} per file.`); return; }
    onError('');
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      await lockerApi.upload(file, title, category);
      onDone(`“${title || file.name}” added to your locker.`);
      setFile(null); setTitle(''); setCategory('other');
      if (input.current) input.current.value = '';
    } catch (err) { onError(err.message); } finally { setBusy(false); }
  };

  return (
    <Panel title="Add a document" icon={UploadCloud} iconColor="#38bdf8">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <div role="button" tabIndex={0} aria-label="Choose a file to add"
            onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition"
            style={{ borderColor: over ? 'var(--brand-1)' : 'var(--border-strong)', background: over ? 'color-mix(in srgb, var(--brand-1) 8%, transparent)' : 'var(--surface-2)' }}>
            <UploadCloud size={24} style={{ color: 'var(--brand-text)' }} />
            {file ? (
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{file.name} <span className="font-normal" style={{ color: 'var(--text-3)' }}>· {fmtSize(file.size)}</span></p>
            ) : (
              <>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Drop a file here, or click to choose</p>
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>PDF, JPG or PNG · up to {maxBytes ? fmtSize(maxBytes) : '10 MB'}</p>
              </>
            )}
            <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        </div>
        <div>
          <label className="f-label" htmlFor="lk-title">Name</label>
          <input id="lk-title" className="f-input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Aadhaar card" />
        </div>
        <div>
          <label className="f-label" htmlFor="lk-cat">Type</label>
          <select id="lk-cat" className="f-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="f-btn" disabled={!file || busy}>{busy ? 'Adding…' : 'Add to my locker'}</button>
        </div>
      </form>
    </Panel>
  );
}

function DocCard({ item, onView, onDownload, onShare, onDelete }) {
  const Icon = item.source === 'issued' ? GraduationCap : fileIcon(item.content_type);
  const sourceNote = { issued: 'Issued by the college', college: 'Added by the college', joining: 'Joining document', self: 'Added by you' }[item.source];
  return (
    <li className="ds-card ds-card-hover flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: item.source === 'self' ? 'linear-gradient(135deg,#38bdf8,#3b82f6)' : 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold" style={{ color: 'var(--text)' }} title={item.title}>{item.title}</h3>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{item.category_label}{item.size_bytes ? ` · ${fmtSize(item.size_bytes)}` : ''}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.verified && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
            <BadgeCheck size={12} /> {item.source === 'joining' ? 'Accepted by the college' : 'Verified by the college'}
          </span>
        )}
        {item.shares > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: 'rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.1)', color: '#0284c7' }}>
            <Link2 size={11} /> {item.shares} link{item.shares === 1 ? '' : 's'} live
          </span>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-3)' }}>
        <Clock3 size={11} /> {sourceNote}{item.created_at ? ` · ${fmtIst(item.created_at, false)}` : ''}{item.reference ? ` · ${item.reference}` : ''}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        <button type="button" onClick={onView} className="f-btn-ghost !px-3 !py-1.5 !text-xs"><Eye size={13} /> View</button>
        <button type="button" onClick={onDownload} className="f-btn-ghost !px-3 !py-1.5 !text-xs"><Download size={13} /> Download</button>
        <button type="button" onClick={onShare} className="f-btn !px-3 !py-1.5 !text-xs"><Share2 size={13} /> Share</button>
        {item.can_delete && (
          <button type="button" onClick={onDelete} aria-label={`Delete ${item.title}`} className="f-btn-danger ml-auto !px-2.5 !py-1.5"><Trash2 size={13} /></button>
        )}
      </div>
    </li>
  );
}

function CopyButton({ text, label = 'Copy link' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <button type="button" onClick={copy} className="f-btn-ghost !px-2.5 !py-1.5 !text-xs">
      {done ? <><Check size={13} /> Copied</> : <><Copy size={13} /> {label}</>}
    </button>
  );
}

function Dialog({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'color-mix(in srgb, var(--bg) 62%, transparent)' }}
         onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <div className="ds-card w-full max-w-md p-6" style={{ background: 'var(--surface-solid)' }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold" style={{ color: 'var(--text)' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[var(--surface-hover)]" style={{ color: 'var(--text-2)' }}><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ShareDialog({ item, onClose }) {
  const [hours, setHours] = useState(24);
  const [link, setLink] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true); setError('');
    try { setLink(await lockerApi.share(item.ref, hours)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Dialog title={`Share “${item.title}”`} onClose={onClose}>
      {!link ? (
        <>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Anyone who has the link can view this one document, without signing in, until it expires. You can withdraw the link at any time.</p>
          <fieldset className="mt-4">
            <legend className="f-label">Link works for</legend>
            <div className="flex flex-wrap gap-2">
              {EXPIRIES.map((x) => (
                <button key={x.hours} type="button" aria-pressed={hours === x.hours} onClick={() => setHours(x.hours)}
                  className="rounded-full border px-3.5 py-1.5 text-sm font-semibold transition"
                  style={hours === x.hours ? { background: 'var(--brand-grad)', color: '#fff', borderColor: 'transparent' } : { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>
                  {x.label}
                </button>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="f-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="f-btn" disabled={busy} onClick={make}><Link2 size={14} /> {busy ? 'Making…' : 'Create link'}</button>
          </div>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600"><Check size={15} /> Link ready. It expires {fmtIst(link.expires_at)}.</p>
          <input readOnly aria-label="Share link" className="f-input mt-3 !text-xs" value={absoluteLink(link.path)} onFocus={(e) => e.target.select()} />
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Send it only to people who should see this document.</p>
            <div className="flex gap-2"><CopyButton text={absoluteLink(link.path)} label="Copy" /><button type="button" className="f-btn !py-1.5 !text-xs" onClick={onClose}>Done</button></div>
          </div>
        </>
      )}
    </Dialog>
  );
}
