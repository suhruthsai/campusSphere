// BuildingManagement.jsx — Add/Edit/Delete buildings, health, equipment
import {
  AlertCircle, Building2, CheckCircle, ChevronDown, ChevronUp,
  Edit2, PlusCircle, Trash2, X, Wrench,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import { buildingsApi } from '../../utils/api.js';

const HEALTH_OPTIONS = ['Good', 'Warning', 'Critical'];
const HEALTH_STYLE = {
  Good:     { bg: 'rgba(0,255,179,0.12)',  text: '#00FFB3', icon: CheckCircle },
  Warning:  { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', icon: AlertCircle },
  Critical: { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', icon: AlertCircle },
};

// Attach initial health and equipment to buildings
const enrichBuilding = (b, i) => ({
  ...b,
  equipment: [
    { name: 'Projectors',   count: (i % 3) + 2 },
    { name: 'AC Units',     count: (i % 4) + 3 },
    { name: 'CCTV Cameras', count: (i % 2) + 4 },
  ],
});

const EMPTY_FORM = { name: '', type: '', floors: 2, color: '#00E5FF', health: 'Good' };

export default function BuildingManagement() {
  const [buildingList, setBuildingList] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [expanded, setExpanded]         = useState(null);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editBuilding, setEditBuilding] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);

  const loadBuildings = async () => {
    try {
      setLoading(true);
      const res = await buildingsApi.list();
      setBuildingList(res.map((b, i) => enrichBuilding(b, i)));
    } catch (e) {
      console.error(e);
      alert('Failed to load buildings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuildings();
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openAdd  = ()  => { setEditBuilding(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (b) => { setEditBuilding(b); setForm({ name: b.name, type: b.type, floors: b.floors, color: b.color, health: b.health }); setModalOpen(true); };

  const save = () => {
    if (!form.name) return;
    if (editBuilding) {
      setBuildingList((prev) => prev.map((b) => b.id === editBuilding.id ? { ...b, ...form } : b));
    } else {
      const nb = { id: 'bx' + Date.now(), ...form, x: 0, z: 0, height: 1.2, occupancy: 0, energy: 'Normal', departments: [], capacity: Number(form.floors) * 120, equipment: [] };
      setBuildingList((prev) => [...prev, nb]);
    }
    setModalOpen(false);
  };

  const confirmDelete = () => {
    setBuildingList((prev) => prev.filter((b) => b.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <PageTransition className="min-h-screen px-4 pb-20 pt-28 sm:px-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
              <Building2 size={22} className="text-[#7B61FF]" /> Building Management
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">{buildingList.length} campus buildings · Suhruth University</p>
          </div>
          <button onClick={openAdd}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-[#020814] transition"
                  style={{ background: 'linear-gradient(135deg,#7B61FF,#7B61FFcc)' }}>
            <PlusCircle size={13} /> Add Building
          </button>
        </div>

        {/* Summary stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Total Buildings', value: buildingList.length, color: '#00E5FF' },
            { label: 'Good Health',     value: buildingList.filter((b) => b.health === 'Good').length,    color: '#00FFB3' },
            { label: 'Need Attention',  value: buildingList.filter((b) => b.health !== 'Good').length,   color: '#F59E0B' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/8 p-4 text-center"
                 style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="font-display text-3xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
              <p className="mt-0.5 text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Building cards */}
        <div className="space-y-3">
          {buildingList.map((b) => {
            const hs  = HEALTH_STYLE[b.health] || HEALTH_STYLE.Good;
            const HIcon = hs.icon;
            const isExpanded = expanded === b.id;

            return (
              <motion.div key={b.id}
                          layout
                          className="overflow-hidden rounded-2xl border border-white/8"
                          style={{ background: 'rgba(4,9,26,0.7)', backdropFilter: 'blur(16px)' }}>
                {/* Card header */}
                <div className="flex items-center gap-4 p-4">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: b.color, boxShadow: `0 0 8px ${b.color}` }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{b.name}</p>
                    <p className="text-xs text-slate-500 truncate">{b.type}</p>
                  </div>

                  {/* Occupancy bar */}
                  <div className="hidden sm:block w-28">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-500">Occupancy</span>
                      <span style={{ color: b.color }}>{b.occupancy}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${b.occupancy}%`, background: b.color }} />
                    </div>
                  </div>

                  {/* Health badge */}
                  <span className="hidden sm:flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
                        style={{ background: hs.bg, color: hs.text }}>
                    <HIcon size={10} /> {b.health}
                  </span>

                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(b)}
                            className="rounded-lg border border-white/8 bg-white/4 p-1.5 text-slate-400 hover:text-[#7B61FF] transition">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => setDeleteTarget(b)}
                            className="rounded-lg border border-white/8 bg-white/4 p-1.5 text-slate-400 hover:text-red-400 transition">
                      <Trash2 size={12} />
                    </button>
                    <button onClick={() => setExpanded(isExpanded ? null : b.id)}
                            className="rounded-lg border border-white/8 bg-white/4 p-1.5 text-slate-400 hover:text-white transition">
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="border-t border-white/6 px-4 pb-4">
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {/* Departments */}
                        <div>
                          <p className="mb-2 text-slate-500 font-medium">Departments</p>
                          <div className="flex flex-wrap gap-1">
                            {(b.departments?.length ? b.departments : [b.type]).map((d) => (
                              <span key={d} className="rounded-full px-2 py-0.5 text-[10px]"
                                    style={{ background: b.color + '14', color: b.color }}>
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Stats */}
                        <div>
                          <p className="mb-2 text-slate-500 font-medium">Capacity</p>
                          <p className="text-white font-bold">{b.capacity || (b.floors * 120)} persons</p>
                          <p className="text-slate-500 text-[10px]">{b.floors} floors</p>
                        </div>

                        {/* Equipment */}
                        <div>
                          <p className="mb-2 text-slate-500 font-medium flex items-center gap-1">
                            <Wrench size={10} /> Equipment
                          </p>
                          <div className="space-y-1">
                            {(b.equipment || []).map((eq) => (
                              <div key={eq.name} className="flex justify-between">
                                <span className="text-slate-400">{eq.name}</span>
                                <span className="text-white font-medium">{eq.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <Modal title={editBuilding ? 'Edit Building' : 'Add Building'} onClose={() => setModalOpen(false)}>
            <div className="space-y-4">
              {[
                { label: 'Building Name', key: 'name', type: 'text', placeholder: 'e.g. ECE Block' },
                { label: 'Type / Description', key: 'type', type: 'text', placeholder: 'e.g. Electronics & Communication Engg' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-slate-400">{label}</label>
                  <input type={type} value={form[key]} onChange={set(key)} placeholder={placeholder}
                         className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-[#7B61FF]/50" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Floors</label>
                  <input type="number" min={1} max={20} value={form.floors} onChange={set('floors')}
                         className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-[#7B61FF]/50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Health Status</label>
                  <select value={form.health} onChange={set('health')}
                          className="w-full rounded-xl border border-white/10 bg-[#04091a] px-3 py-2.5 text-sm text-slate-300 outline-none">
                    {HEALTH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Accent Colour</label>
                <input type="color" value={form.color} onChange={set('color')}
                       className="h-9 w-full rounded-xl border border-white/10 bg-white/5 p-1 cursor-pointer" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setModalOpen(false)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:bg-white/10 transition">
                  Cancel
                </button>
                <button onClick={save}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-[#020814]"
                        style={{ background: 'linear-gradient(135deg,#7B61FF,#7B61FFcc)' }}>
                  {editBuilding ? 'Save Changes' : 'Add Building'}
                </button>
              </div>
            </div>
          </Modal>
        )}
        {deleteTarget && (
          <Modal title="Delete Building" onClose={() => setDeleteTarget(null)}>
            <p className="mb-4 text-sm text-slate-300">
              Delete <strong className="text-white">{deleteTarget.name}</strong>? All floor and room data will be removed.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:bg-white/10 transition">Cancel</button>
              <button onClick={confirmDelete}
                      className="rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 transition">Delete</button>
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
                style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
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
