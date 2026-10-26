// UserManagement.jsx — Full CRUD user management
import {
  Download, Edit2, KeyRound, PlusCircle, Search, Trash2, Upload, Users, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import { roleColors } from '../../utils/auth.js';
import { authApi, saveBlob } from '../../utils/api.js';

const TABS = ['All', 'Student', 'Faculty', 'Staff', 'Admin'];
const DEPARTMENTS = ['All', 'CSE', 'ECE', 'MECH', 'EEE', 'CIVIL', 'IT', 'S&H', 'Administration', 'Examinations', 'Library', 'Canteen', 'Maintenance'];
const ROLES = ['student', 'faculty', 'staff', 'admin'];

/** One-time random password; the admin passes it on to the user. */
const tempPassword = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);

/** Quote a CSV cell (commas, quotes, newlines). */
const csvCell = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');

/** Minimal CSV reader: handles quoted cells; returns rows of cells. */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const EMPTY_FORM = { name: '', email: '', role: 'student', department: 'CSE', status: 'active' };

export default function UserManagement() {
  const [userList, setUserList]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('All');
  const [search, setSearch]           = useState('');
  const [deptFilter, setDeptFilter]   = useState('All');
  const [modalOpen, setModalOpen]     = useState(false);
  const [editUser, setEditUser]       = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  // Fetch users from API
  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await authApi.users({ limit: 500 });
      // The backend returns avatar? if not we compute it
      setUserList(res.users.map(u => ({
        ...u, 
        avatar: u.name.split(' ').map((w) => w[0]).join('').slice(0,2).toUpperCase()
      })));
    } catch (e) {
      console.error(e);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Filter
  const filtered = userList.filter((u) => {
    const matchRole  = activeTab === 'All' || u.role === activeTab.toLowerCase();
    const matchDept  = deptFilter === 'All' || u.department === deptFilter;
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchDept && matchSearch;
  });

  const openAdd = () => { setEditUser(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ name: u.name, email: u.email, role: u.role, department: u.department, status: u.status }); setModalOpen(true); };

  const saveUser = async () => {
    if (!form.name || !form.email) return;
    try {
      if (editUser) {
        await authApi.updateUser(editUser.id, form);
        loadUsers();
      } else {
        const password = tempPassword();
        const { status, ...payload } = form;
        await authApi.register({ ...payload, password });
        alert(`User created.\n\nTemporary password for ${form.email}:\n${password}\n\nCopy it now — it won't be shown again.`);
        loadUsers(); // reload from backend to get generated ID
      }
      setModalOpen(false);
    } catch (e) {
      alert(e.message || 'Error saving user');
    }
  };

  const resetPassword = async (u) => {
    if (!window.confirm(`Give ${u.name} a new temporary password? Their current password stops working.`)) return;
    try {
      const res = await authApi.resetPassword(u.id);
      alert(`Temporary password for ${res.email}:\n${res.temporary_password}\n\nCopy it now — it won't be shown again. They can change it under My account.`);
    } catch (e) {
      alert(e.message || 'Could not reset the password');
    }
  };

  const confirmDelete = async () => {
    try {
      await authApi.deleteUser(deleteTarget.id);
      setUserList((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      alert(e.message || 'Error deleting user');
    }
  };

  // Export the users currently shown (after tab / department / search filters)
  const exportCsv = () => {
    const rows = [['name', 'email', 'role', 'department', 'roll_no', 'status', 'joined_at'],
      ...filtered.map((u) => [u.name, u.email, u.role, u.department, u.roll_no || '', u.status, u.joined_at || ''])];
    saveBlob(new Blob([toCsv(rows)], { type: 'text/csv' }), `campussphere-users-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Import: CSV with columns name,email,role,department. Each new account gets a temporary password,
  // and a CSV of those passwords is downloaded for the admin to hand out.
  const importCsv = async (file) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
    const col = (k) => head.indexOf(k);
    if (col('name') < 0 || col('email') < 0) {
      setImportResult({ created: 0, failed: [{ row: 1, reason: 'The first row must have the columns name,email,role,department' }] });
      return;
    }
    const created = [], failed = [];
    for (const [i, r] of rows.entries()) {
      const get = (k) => (col(k) >= 0 ? (r[col(k)] || '').trim() : '');
      const role = (get('role') || 'student').toLowerCase();
      if (!ROLES.includes(role)) { failed.push({ row: i + 2, reason: `Unknown role "${role}"` }); continue; }
      const password = tempPassword();
      try {
        await authApi.register({ name: get('name'), email: get('email'), role, department: get('department') || 'CSE', password });
        created.push([get('name'), get('email'), role, password]);
      } catch (e) {
        failed.push({ row: i + 2, reason: `${get('email') || 'no email'}: ${e.message}` });
      }
    }
    if (created.length) {
      saveBlob(new Blob([toCsv([['name', 'email', 'role', 'temporary_password'], ...created])], { type: 'text/csv' }),
        `new-accounts-${new Date().toISOString().slice(0, 10)}.csv`);
    }
    setImportResult({ created: created.length, failed });
    loadUsers();
  };

  const counts = { All: userList.length, Student: userList.filter((u) => u.role==='student').length, Faculty: userList.filter((u) => u.role==='faculty').length, Staff: userList.filter((u) => u.role==='staff').length, Admin: userList.filter((u) => u.role==='admin').length };

  return (
    <PageTransition className="min-h-screen px-4 pb-20 pt-28 sm:px-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
              <Users size={22} className="text-[#00E5FF]" /> User Management
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">{userList.length} total users · MVSR Engineering College</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} title="Download the users shown below as CSV"
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 transition">
              <Download size={13} /> Export
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                   onChange={(e) => { importCsv(e.target.files[0]); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} title="Create accounts from a CSV: name,email,role,department"
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 transition">
              <Upload size={13} /> Import
            </button>
            <button onClick={openAdd}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-[#020814] transition"
                    style={{ background: 'linear-gradient(135deg,#00E5FF,#00E5FFcc)' }}>
              <PlusCircle size={13} /> Add User
            </button>
          </div>
        </div>

        {importResult && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
            <div className="flex justify-between">
              <p><b className="text-white">{importResult.created}</b> account{importResult.created === 1 ? '' : 's'} created
                {importResult.created > 0 && ' · their temporary passwords were downloaded as a CSV'}.</p>
              <button onClick={() => setImportResult(null)} aria-label="Dismiss" className="text-slate-500 hover:text-white"><X size={13} /></button>
            </div>
            {importResult.failed.map((f) => <p key={f.row} className="mt-1 text-rose-300">Row {f.row}: {f.reason}</p>)}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold transition"
                    style={activeTab === tab
                      ? { background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
              {tab} <span className="ml-1 opacity-60">{counts[tab]}</span>
            </button>
          ))}
        </div>

        {/* Search + filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="Search name or email…"
                   className="rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-xs text-white outline-none focus:border-[#00E5FF]/40 w-60" />
          </div>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#04091a] py-2.5 px-3 text-xs text-slate-300 outline-none">
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-white/8" style={{ background: 'rgba(4,9,26,0.7)', backdropFilter: 'blur(16px)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8">
                  {['User', 'Role', 'Department', 'ID / Roll No', 'Status', 'Last Active', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const rc = roleColors[u.role];
                  return (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/4 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/8 text-xs font-bold text-slate-300">
                            {u.avatar}
                          </span>
                          <div>
                            <p className="font-semibold text-white">{u.name}</p>
                            <p className="text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize"
                              style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{u.department}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{u.roll_no || u.staff_id || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.status === 'active' ? 'bg-green-500/15 text-green-400' : u.status === 'pending' ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-700/50 text-slate-400'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.last_active || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(u)} title="Edit" aria-label={`Edit ${u.name}`}
                                  className="rounded-lg border border-white/8 bg-white/4 p-1.5 text-slate-400 hover:text-[#00E5FF] transition">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => resetPassword(u)} title="Reset password" aria-label={`Reset password for ${u.name}`}
                                  className="rounded-lg border border-white/8 bg-white/4 p-1.5 text-slate-400 hover:text-amber-300 transition">
                            <KeyRound size={12} />
                          </button>
                          <button onClick={() => setDeleteTarget(u)} title="Delete" aria-label={`Delete ${u.name}`}
                                  className="rounded-lg border border-white/8 bg-white/4 p-1.5 text-slate-400 hover:text-red-400 transition">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-600">
                    {loading ? 'Loading users from database...' : 'No users match your filters.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <Modal title={editUser ? 'Edit User' : 'Add New User'} onClose={() => setModalOpen(false)}>
            <div className="space-y-4">
              {[
                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Full name' },
                { label: 'Email',     key: 'email', type: 'email', placeholder: 'Email address' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-slate-400">{label}</label>
                  <input type={type} value={form[key]} onChange={set(key)} placeholder={placeholder}
                         className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-[#00E5FF]/40" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Role', key: 'role', options: ROLES },
                  { label: 'Department', key: 'department', options: [...new Set([...DEPARTMENTS.slice(1), form.department].filter(Boolean))] },
                  { label: 'Status', key: 'status', options: ['active','pending','inactive','suspended'] },
                ].map(({ label, key, options }) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-slate-400">{label}</label>
                    <select value={form[key]} onChange={set(key)}
                            className="w-full rounded-xl border border-white/10 bg-[#04091a] px-3 py-2.5 text-sm text-slate-300 outline-none">
                      {options.map((o) => <option key={o} value={o} className="capitalize">{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setModalOpen(false)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:bg-white/10 transition">
                  Cancel
                </button>
                <button onClick={saveUser}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-[#020814]"
                        style={{ background: 'linear-gradient(135deg,#00E5FF,#00E5FFcc)' }}>
                  {editUser ? 'Save Changes' : 'Add User'}
                </button>
              </div>
            </div>
          </Modal>
        )}
        {deleteTarget && (
          <Modal title="Delete User" onClose={() => setDeleteTarget(null)}>
            <p className="mb-4 text-sm text-slate-300">
              Are you sure you want to delete <strong className="text-white">{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:bg-white/10 transition">
                Cancel
              </button>
              <button onClick={confirmDelete}
                      className="rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 transition">
                Delete
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 16 }}
                  className="w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl"
                  style={{ background: 'rgba(4,9,26,0.95)', backdropFilter: 'blur(32px)' }}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white transition">
            <X size={14} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
