// Small pieces shared by the locker pages: sizes, file icons, and the in-page document viewer.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileImage, FileText, X } from 'lucide-react';

export const fmtSize = (bytes) => {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const fileIcon = (contentType) => (contentType && contentType.startsWith('image/') ? FileImage : FileText);

/** Shows a PDF or image inside the page. `load` returns a Blob. */
export function Viewer({ title, contentType, load, onClose, download }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let objectUrl;
    let alive = true;
    load().then((blob) => { if (alive) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch((e) => alive && setError(e.message));
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'color-mix(in srgb, var(--bg) 70%, transparent)' }}
         onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <div className="ds-card flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden" style={{ background: 'var(--surface-solid)' }}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <p className="min-w-0 truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{title}</p>
          <div className="flex items-center gap-2">
            {download && url && <button type="button" onClick={download} className="f-btn-ghost !px-3 !py-1.5 !text-xs">Download</button>}
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[var(--surface-hover)]" style={{ color: 'var(--text-2)' }}><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto" style={{ background: 'var(--surface-2)' }}>
          {error && <p className="p-5 text-sm text-rose-500">{error}</p>}
          {!url && !error && <p className="p-5 text-sm" style={{ color: 'var(--text-2)' }}>Opening…</p>}
          {url && (contentType === 'application/pdf'
            ? <iframe title={title} src={url} className="h-full w-full" />
            : <img alt={title} src={url} className="mx-auto max-h-full max-w-full object-contain p-3" />)}
        </div>
      </div>
    </div>,
    document.body,
  );
}
