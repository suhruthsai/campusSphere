// UserManagement.jsx — Full CRUD user management
import {
  Download, Edit2, PlusCircle, Search, Trash2, Upload, Users, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import { roleColors } from '../../utils/auth.js';
import { authApi } from '../../utils/api.js';

const TABS = ['All', 'Student', 'Faculty', 'Staff', 'Admin'];
const DEPARTMENTS = ['All', 'CSE', 'ECE', 'Mech', 'EEE', 'Civil', 'IT', 'S&H', 'Administration', 'Library', 'Canteen', 'Maintenance'];

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
        // Backend currently only has update_status implemented in auth.py, but for a real system we'd update full profile.
        // For now, let's at least update status and simulate the rest locally until PUT /users/:id is ready
        if (form.status !== editUser.status) {
          await authApi.setStatus(editUser.id, form.status);
        }
        setUserList((prev) => prev.map((u) => u.id === editUser.id ? { ...u, ...form, avatar: form.name.split(' ').map((w) => w[0]).join('').slice(0,2).toUpperCase() } : u));
      } else {
        const payload = { ...form, password: 'Password123' }; // default password for admin creation
        await authApi.register(payload);
        loadUsers(); // reload from backend to get generated ID
      }
      setModalOpen(false);
    } catch (e) {
      alert(e.message || 'Error saving user');
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
            <p className="mt-0.5 text-sm text-slate-400">{userList.length} total users · Suhruth University</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => alert('CSV export triggered (mock)')}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 transition">
              <Download size={13} /> Export
            </button>
            <button onClick={() => alert('CSV import triggered (mock)')}
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
                      <td className="px-4 py-3 text-slate-500 font-mono">{u.rollNo || u.staffId || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-slate-700/50 text-slate-400'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.lastActive}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(u)}
                                  className="rounded-lg border border-white/8 bg-white/4 p-1.5 text-slate-400 hover:text-[#00E5FF] transition">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => setDeleteTarget(u)}
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
                  { label: 'Role', key: 'role', options: ['student','faculty','staff','admin'] },
                  { label: 'Department', key: 'department', options: ['CSE','ECE','Mech','EEE','Civil','IT','S&H','Administration','Library','Canteen','Maintenance'] },
                  { label: 'Status', key: 'status', options: ['active','inactive'] },
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
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
