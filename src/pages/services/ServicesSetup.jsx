// Admin setup for Student Services: who approves (class in-charge, AHOD, HOD, principal, CoE),
// who clears no-dues, students' mentors and details, and an overview of every request.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, UserCog } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import {
  DEPARTMENTS, StatusBadge, btnGhost, btnPrimary, fmtIst, fmtWaiting, inputCls, labelCls, whereNow,
} from '../../components/services/requestUi.jsx';
import { leavingApi, servicesApi } from '../../utils/api.js';

const ROLES = [
  { id: 'class_incharge', label: 'Class In-charge', scope: 'section' },
  { id: 'ahod', label: 'Associate HOD', scope: 'department' },
  { id: 'hod', label: 'HOD', scope: 'department' },
  { id: 'principal', label: 'Principal', scope: 'college' },
  { id: 'coe', label: 'Controller of Examinations', scope: 'college' },
];

function Assignments({ people }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ role: 'class_incharge', user_id: '', department: 'CSE', year: '', section: '' });
  const [msg, setMsg] = useState('');
  const load = useCallback(() => servicesApi.assignments().then(setRows).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const scope = ROLES.find((r) => r.id === form.role).scope;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const res = await servicesApi.assign({
        role: form.role, user_id: form.user_id,
        department: scope === 'college' ? null : form.department,
        year: scope === 'section' ? Number(form.year) : null,
        section: scope === 'section' ? form.section : null,
      });
      setMsg(res.message);
      load();
    } catch (err) { setMsg(err.message); }
  };
  const remove = async (id) => { await servicesApi.unassign(id).catch((e) => setMsg(e.message)); load(); };

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="section-title mb-1">Approvers</h2>
      <p className="mb-4 text-xs text-slate-400">Mentors are set per student below. Assigning a role again for the same scope replaces the previous person.</p>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className={labelCls}>Role</label>
          <select className={inputCls} value={form.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-4">
          <label className={labelCls}>Person</label>
          <select className={inputCls} value={form.user_id} onChange={set('user_id')} required>
            <option value="">Select a faculty / staff account</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.department} · {p.email}</option>)}
          </select>
        </div>
        {scope !== 'college' && (
          <div className="sm:col-span-2">
            <label className={labelCls}>Department</label>
            <select className={inputCls} value={form.department} onChange={set('department')}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        )}
        {scope === 'section' && (
          <>
            <div className="sm:col-span-2">
              <label className={labelCls}>Year</label>
              <select className={inputCls} value={form.year} onChange={set('year')} required>
                <option value="">Select</option>
                {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Section</label>
              <input className={inputCls} value={form.section} onChange={set('section')} required maxLength={10} placeholder="A" />
            </div>
          </>
        )}
        <div className="flex items-end sm:col-span-6">
          <button className={btnPrimary} type="submit">Assign</button>
          {msg && <span className="ml-3 text-sm text-slate-300">{msg}</span>}
        </div>
      </form>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="py-2">Role</th><th>Scope</th><th>Person</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 text-slate-200">
                <td className="py-2">{r.role_label}</td>
                <td>{r.department == null ? 'College' : r.role === 'class_incharge' ? `${r.department} · Year ${r.year} · Sec ${r.section}` : r.department}</td>
                <td>{r.user_name}</td>
                <td className="text-right"><button onClick={() => remove(r.id)} aria-label="Remove" className="rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 size={15} /></button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="py-3 text-slate-500">No approvers assigned yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClearanceOfficers({ people }) {
  const [rows, setRows] = useState([]);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState({ unit: 'library', user_id: '', department: 'CSE' });
  const [msg, setMsg] = useState('');
  const load = useCallback(() => leavingApi.officers().then(setRows).catch((e) => setMsg(e.message)), []);
  useEffect(() => {
    leavingApi.config().then((c) => setUnits(c.units)).catch((e) => setMsg(e.message));
    load();
  }, [load]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const res = await leavingApi.addOfficer({ ...form, department: form.unit === 'department' ? form.department : null });
      setMsg(res.message);
      load();
    } catch (err) { setMsg(err.message); }
  };
  const remove = async (id) => { await leavingApi.removeOfficer(id).catch((e) => setMsg(e.message)); load(); };
  const missing = units.filter((u) => u.key !== 'department' && !rows.some((r) => r.unit === u.key));

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="section-title mb-1">No-dues clearance officers</h2>
      <p className="mb-4 text-xs text-slate-400">
        Who clears leaving students for each section. The department unit is per department (usually the HOD or lab in-charge).
        {missing.length > 0 && <span className="text-amber-300"> Not assigned yet: {missing.map((u) => u.label).join(', ')}. Only admins can clear those.</span>}
      </p>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className={labelCls}>Section</label>
          <select className={inputCls} value={form.unit} onChange={set('unit')}>
            {units.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
          </select>
        </div>
        {form.unit === 'department' && (
          <div className="sm:col-span-1">
            <label className={labelCls}>Department</label>
            <select className={inputCls} value={form.department} onChange={set('department')}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        )}
        <div className={form.unit === 'department' ? 'sm:col-span-3' : 'sm:col-span-4'}>
          <label className={labelCls}>Person</label>
          <select className={inputCls} value={form.user_id} onChange={set('user_id')} required>
            <option value="">Select a faculty / staff account</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.department} · {p.email}</option>)}
          </select>
        </div>
        <div className="flex items-end sm:col-span-6">
          <button className={btnPrimary} type="submit">Assign</button>
          {msg && <span className="ml-3 text-sm text-slate-300">{msg}</span>}
        </div>
      </form>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="py-2">Section</th><th>Person</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 text-slate-200">
                <td className="py-2">{r.unit_label}{r.department ? ` · ${r.department}` : ''}</td>
                <td>{r.user_name}</td>
                <td className="text-right"><button onClick={() => remove(r.id)} aria-label="Remove" className="rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 size={15} /></button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="py-3 text-slate-500">No clearance officers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StudentEditor({ student, people, onSaved, onCancel }) {
  const [form, setForm] = useState({
    roll_no: student.roll_no || '', department: student.department || 'CSE', program: student.program || 'B.E.',
    year: student.year || '', section: student.section || '', parent_name: student.parent_name || '',
    gender: student.gender || '', mentor_id: student.mentor_id || '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    try {
      await servicesApi.setStudentProfile(student.user_id, { ...form, year: Number(form.year), mentor_id: form.mentor_id || null });
      onSaved();
    } catch (x) { setErr(x.message); }
  };
  return (
    <form onSubmit={save} className="grid gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-3 sm:grid-cols-4">
      <input className={inputCls} value={form.roll_no} onChange={set('roll_no')} placeholder="Roll no." required />
      <select className={inputCls} value={form.department} onChange={set('department')}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
      <select className={inputCls} value={form.year} onChange={set('year')} required><option value="">Year</option>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y}</option>)}</select>
      <input className={inputCls} value={form.section} onChange={set('section')} placeholder="Section" required maxLength={10} />
      <input className={`${inputCls} sm:col-span-2`} value={form.parent_name} onChange={set('parent_name')} placeholder="Parent's name" required />
      <select className={inputCls} value={form.gender} onChange={set('gender')} required><option value="">Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select>
      <select className={inputCls} value={form.mentor_id} onChange={set('mentor_id')}><option value="">No mentor</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      {err && <p className="text-sm text-rose-300 sm:col-span-4">{err}</p>}
      <div className="flex gap-2 sm:col-span-4"><button className={btnPrimary} type="submit">Save</button><button type="button" className={btnGhost} onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function Students({ people }) {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => servicesApi.students().then(setRows), []);
  useEffect(() => { load(); }, [load]);
  const shown = useMemo(() => (rows || []).filter((r) => `${r.name} ${r.roll_no} ${r.email}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Students &amp; mentors</h2>
        <input className={`${inputCls} max-w-xs`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or roll no." />
      </div>
      {!rows ? <p className="text-sm text-slate-400">Loading…</p> : (
        <div className="space-y-2">
          {shown.map((s) => (
            <div key={s.user_id}>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-white">{s.name} <span className="font-normal text-slate-500">· {s.roll_no || 'no roll no.'}</span></p>
                  <p className="text-xs text-slate-400">
                    {s.department} {s.year ? `· Year ${s.year} · Sec ${s.section}` : ''} · Mentor: {s.mentor_name || <span className="text-amber-300">not assigned</span>}
                    {!s.complete && <span className="ml-1 text-amber-300">· profile incomplete</span>}
                  </p>
                </div>
                <button className={btnGhost} onClick={() => setEditing(editing === s.user_id ? null : s.user_id)}><UserCog size={14} /> Edit</button>
              </div>
              {editing === s.user_id && (
                <div className="mt-2"><StudentEditor student={s} people={people} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /></div>
              )}
            </div>
          ))}
          {shown.length === 0 && <p className="text-sm text-slate-500">No students found.</p>}
        </div>
      )}
    </section>
  );
}

function Overview() {
  const [rows, setRows] = useState(null);
  useEffect(() => { servicesApi.allRequests().then(setRows); }, []);
  if (!rows) return null;
  const count = (st) => rows.filter((r) => r.status === st).length;
  const open = rows.filter((r) => r.status === 'in_review');
  const unpaid = count('awaiting_payment');
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="section-title mb-3">All requests</h2>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['In review', count('in_review')], ['Overdue', open.filter((r) => r.overdue).length], ['With Exam Cell', count('processing')], ['Issued', count('approved')]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/10 p-3"><p className="text-2xl font-bold text-white">{v}</p><p className="text-xs text-slate-400">{k}</p></div>
        ))}
      </div>
      {unpaid > 0 && <p className="-mt-2 mb-3 text-xs text-amber-300">{unpaid} request{unpaid > 1 ? 's are' : ' is'} waiting for the student to pay the fee.</p>}
      <div className="space-y-2">
        {rows.slice(0, 30).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 px-3 py-2 text-sm">
            <div>
              <p className="text-white">{r.doc_name} · <span className="text-slate-300">{r.student.name}</span> <span className="font-mono text-[11px] text-slate-500">{r.ref_no}</span></p>
              <p className="text-xs text-slate-400">{whereNow(r)}{r.status === 'in_review' ? ` · ${fmtWaiting(r.waiting_hours)}` : ''} · {fmtIst(r.created_at, false)}</p>
            </div>
            <div className="flex items-center gap-2">{r.overdue && <span className="text-[11px] font-semibold text-rose-300">Overdue</span>}<StatusBadge status={r.status} /></div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-500">No requests yet.</p>}
      </div>
    </section>
  );
}

export default function ServicesSetup() {
  const [people, setPeople] = useState([]);
  useEffect(() => { servicesApi.approverUsers().then(setPeople); }, []);
  return (
    <PageTransition className="mx-auto min-h-screen max-w-6xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="Student services · setup" title="Who signs what, and how it's going." />
      <Assignments people={people} />
      <ClearanceOfficers people={people} />
      <Students people={people} />
      <Overview />
    </PageTransition>
  );
}
