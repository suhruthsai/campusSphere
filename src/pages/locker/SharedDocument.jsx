// SharedDocument.jsx — the page behind a CampusLocker share link. No account needed: whoever holds a live link
// can view that one document (and only that one) until it expires or its owner withdraws it.
import { Clock3, Download, ShieldCheck, ShieldX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicFrame from '../../components/layout/PublicFrame.jsx';
import { fmtIst } from '../../components/services/requestUi.jsx';
import { lockerApi, saveBlob } from '../../utils/api.js';

export default function SharedDocument() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [url, setUrl] = useState(null);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    let objectUrl;
    let alive = true;
    setInfo(null); setError(''); setUrl(null); setFileError('');
    lockerApi.sharedInfo(token)
      .then((meta) => {
        if (!alive) return null;
        setInfo(meta);
        return lockerApi.sharedBlob(token);
      })
      .then((blob) => { if (alive && blob) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } })
      .catch((e) => { if (alive) (info ? setFileError : setError)(e.message); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const isPdf = info?.content_type === 'application/pdf';
  const save = () => url && fetch(url).then((r) => r.blob()).then((b) => saveBlob(b, `${info.title}.${isPdf ? 'pdf' : info.content_type === 'image/png' ? 'png' : 'jpg'}`));

  return (
    <PublicFrame>
      <div className="mx-auto max-w-3xl">
        <p className="ds-eyebrow text-center">Shared document</p>
        <h1 className="mt-2 text-center font-display text-3xl font-extrabold" style={{ color: 'var(--text)' }}>MVSR Engineering College</h1>

        {error && (
          <div className="ds-card mx-auto mt-8 max-w-xl p-8 text-center" role="alert">
            <ShieldX className="mx-auto h-11 w-11 text-rose-500" />
            <p className="mt-3 font-display text-lg font-bold" style={{ color: 'var(--text)' }}>This document isn’t available</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>{error}. Ask the person who sent it to share a new link.</p>
          </div>
        )}

        {!error && !info && <p className="mt-10 text-center text-sm" style={{ color: 'var(--text-2)' }}>Checking the link…</p>}

        {info && (
          <div className="ds-card mt-8 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold" style={{ color: 'var(--text)' }}>{info.title}</h2>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-2)' }}>
                  <span className="inline-flex items-center gap-1"><ShieldCheck size={13} className="text-emerald-500" /> Shared by {info.shared_by}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 size={12} /> Link valid until {fmtIst(info.expires_at)}</span>
                </p>
              </div>
              {url && <button type="button" onClick={save} className="f-btn"><Download size={15} /> Download</button>}
            </div>
            <div style={{ background: 'var(--surface-2)' }}>
              {fileError && <p className="p-6 text-sm text-rose-500">{fileError}</p>}
              {!url && !fileError && <p className="p-8 text-center text-sm" style={{ color: 'var(--text-2)' }}>Opening the document…</p>}
              {url && (isPdf
                ? <iframe title={info.title} src={url} className="h-[70vh] w-full" />
                : <img alt={info.title} src={url} className="mx-auto max-h-[70vh] max-w-full object-contain p-3" />)}
            </div>
          </div>
        )}
        <p className="mt-6 text-center text-[11px]" style={{ color: 'var(--text-3)' }}>
          This page shows one document. It is not proof of identity unless the document itself says so; to check a college certificate, use the verification code printed on it.
        </p>
      </div>
    </PublicFrame>
  );
}
