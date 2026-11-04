// LockerOffice.jsx — the Admin Office adds an official document (mark memo, fee receipt, certificate) to a
// student's locker. The student sees it marked "Added by the college" and cannot delete it.
import { BadgeCheck, Check, Search, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import Panel from '../../components/ui/Panel.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { lockerApi } from '../../utils/api.js';
import { fmtSize } from './lockerUi.jsx';

const CATEGORIES = [['marksheet', 'Mark sheet'], ['certificate', 'Certificate'], ['receipt', 'Fee receipt'], ['id_proof', 'ID proof'], ['offer_letter', 'Offer letter'], ['other', 'Other']];

export default function LockerOffice() {
  const [roll, setRoll] = useState('');
  const [student, setStudent] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('marksheet');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const input = useRef(null);

  const find = async (e) => {
    e.preventDefault();
    setStudent(null); setLookupError(''); setDone('');
    try { setStudent(await lockerApi.lookup(roll.trim())); } catch (err) { setLookupError(err.message); }
  };
  const add = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setDone('');
    try {
      const res = await lockerApi.officeAdd(student.roll_no, file, title, category);
      setDone(`Added “${title || file.name}” to ${res.student}’s locker.`);
      setFile(null); setTitle('');
      if (input.current) input.current.value = '';
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <PageTransition className="mx-auto min-h-screen max-w-3xl px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Admin Office · student lockers" title="Add an official document to a student’s locker." />

      <Panel title="1 · Find the student" icon={Search} iconColor="#38bdf8">
        <form onSubmit={find} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className="f-label" htmlFor="lo-roll">Roll number</label>
            <input id="lo-roll" className="f-input" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="e.g. 1602-23-733-001" required />
          </div>
          <button type="submit" className="f-btn">Find student</button>
        </form>
        {lookupError && <p role="alert" className="mt-3 text-sm text-rose-500">{lookupError}</p>}
        {student && (
          <p className="mt-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: 'var(--text)' }}>
            <BadgeCheck size={16} className="text-emerald-500" /> <b>{student.name}</b> · {student.roll_no} · {student.department}{student.year ? `, year ${student.year}` : ''}
          </p>
        )}
      </Panel>

      {student && (
        <Panel title="2 · Add the document" icon={UploadCloud} iconColor="#a78bfa" className="mt-5">
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="f-label" htmlFor="lo-file">File (PDF, JPG or PNG, up to 10 MB)</label>
              <input id="lo-file" ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" style={{ color: 'var(--text-2)' }} required
                onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '')); }} />
              {file && <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>{file.name} · {fmtSize(file.size)}</p>}
            </div>
            <div>
              <label className="f-label" htmlFor="lo-title">Name shown to the student</label>
              <input id="lo-title" className="f-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Semester 5 mark memo" required />
            </div>
            <div>
              <label className="f-label" htmlFor="lo-cat">Type</label>
              <select id="lo-cat" className="f-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="f-btn" disabled={!file || busy}>{busy ? 'Adding…' : 'Add to the locker'}</button>
            </div>
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
          {done && <p role="status" className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-600"><Check size={15} /> {done}</p>}
        </Panel>
      )}
    </PageTransition>
  );
}
