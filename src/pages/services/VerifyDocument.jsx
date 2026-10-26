// Public page behind the certificate QR code: anyone can confirm a document is genuine.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, ShieldX } from 'lucide-react';
import { servicesApi } from '../../utils/api.js';
import { fmtIst, inputCls, btnPrimary } from '../../components/services/requestUi.jsx';

export default function VerifyDocument() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [input, setInput] = useState(code || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    setResult(null);
    setError('');
    servicesApi.verify(code).then(setResult).catch((e) => setError(e.message));
  }, [code]);

  return (
    <div className="min-h-screen bg-[#070b12] px-4 py-12 text-white">
      <div className="mx-auto max-w-xl">
        <p className="text-center font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-300">Document verification</p>
        <h1 className="mt-2 text-center font-serif text-3xl font-bold">MVSR Engineering College</h1>
        <p className="text-center text-sm text-slate-400">Nadergul, Hyderabad</p>

        <form className="mt-8 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) navigate(`/verify/${input.trim().toUpperCase()}`); }}>
          <input className={inputCls} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Verification code from the document" maxLength={20} />
          <button className={btnPrimary} type="submit">Verify</button>
        </form>

        {error && <p className="mt-6 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
        {code && !result && !error && <p className="mt-6 text-center text-sm text-slate-400">Checking…</p>}

        {result?.valid === false && (
          <div className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-6 text-center">
            <ShieldX className="mx-auto h-10 w-10 text-rose-300" />
            <p className="mt-2 text-lg font-bold text-rose-200">Not a valid document</p>
            <p className="mt-1 text-sm text-slate-300">No approved document matches code <span className="font-mono">{code}</span>. It may be mistyped, withdrawn or forged.</p>
          </div>
        )}

        {result?.valid && (
          <div className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-6">
            <div className="flex items-center gap-3">
              <BadgeCheck className="h-10 w-10 text-emerald-300" />
              <div>
                <p className="text-lg font-bold text-emerald-200">Genuine document</p>
                <p className="text-sm text-slate-300">Issued by MVSR Engineering College</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ['Document', result.document], ['Reference', result.ref_no],
                ['Student', result.student_name], ['Roll no.', result.roll_no],
                ['Course', `${result.program} (${result.department})`], ['Academic year', result.academic_year],
                ['Purpose', result.purpose], ['Issued', fmtIst(result.issued_at)],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-[11px] uppercase tracking-wider text-slate-500">{k}</dt><dd className="text-slate-100">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Approved by</p>
              <ul className="space-y-1 text-sm text-slate-200">
                {result.approved_by.map((a) => <li key={a.role}>✓ {a.role} — {a.name}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
