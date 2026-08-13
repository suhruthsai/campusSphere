// LabManagement.jsx — Lab status, equipment, reservations, maintenance
import {
  AlertCircle, CheckCircle, Clock, Cpu, PlusCircle, Wrench, X, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import PageTransition from '../components/PageTransition.jsx';
import { labs, labStatuses } from '../data/labs.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_ICONS = {
  available: CheckCircle,
  occupied:  Clock,
  maintenance: Wrench,
  closed: AlertCircle,
};

export default function LabManagement() {
  const { user } = useAuth();
  const [selectedLab, setSelectedLab]   = useState(null);
  const [activeTab, setActiveTab]       = useState('equipment');
  const [reserveModal, setReserveModal] = useState(null);
  const [resForm, setResForm]           = useState({ date: '', slot: '09:00–11:00', purpose: '' });
  const [labList, setLabList]           = useState(labs);

  const TABS = ['equipment', 'reservations', 'maintenance'];

  const handleReserve = () => {
    if (!resForm.date || !resForm.purpose) return;
    const newRes = {
      id: 'r' + Date.now(),
      bookedBy: user?.name || 'You',
      date: resForm.date,
      slot: resForm.slot,
      purpose: resForm.purpose,
    };
    setLabList((prev) =>
      prev.map((l) =>
        l.id === reserveModal.id
          ? { ...l, reservations: [...l.reservations, newRes] }
          : l,
      ),
    );
    if (selectedLab?.id === reserveModal.id) {
      setSelectedLab((prev) => ({ ...prev, reservations: [...prev.reservations, newRes] }));
    }
    setReserveModal(null);
    setResForm({ date: '', slot: '09:00–11:00', purpose: '' });
  };

  return (
    <PageTransition className="min-h-screen px-4 pb-20 pt-28 sm:px-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
              <Zap size={22} className="text-[#F472B6]" /> Lab Management
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">{labs.length} laboratories · Suhruth University</p>
          </div>
        </div>

        {/* Summary row */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Available',   value: labList.filter((l) => l.status === 'available').length,   color: '#00FFB3' },
            { label: 'Occupied',    value: labList.filter((l) => l.status === 'occupied').length,    color: '#00E5FF' },
            { label: 'Maintenance', value: labList.filter((l) => l.status === 'maintenance').length, color: '#F59E0B' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/8 p-4 text-center"
                 style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="font-display text-3xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
              <p className="mt-0.5 text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          {/* Lab cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {labList.map((lab) => {
              const ls = labStatuses[lab.status] || labStatuses.available;
              const StatusIcon = STATUS_ICONS[lab.status] || CheckCircle;
              const isSelected = selectedLab?.id === lab.id;

              return (
                <motion.div
                  key={lab.id}
                  whileHover={{ y: -2, scale: 1.01 }}
                  onClick={() => { setSelectedLab(lab); setActiveTab('equipment'); }}
                  className="cursor-pointer rounded-2xl border p-5 transition"
                  style={isSelected
                    ? { background: lab.color + '0e', borderColor: lab.color + '40', boxShadow: `0 0 20px ${lab.color}15` }
                    : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  {/* Status indicator bar */}
                  <div className="mb-3 h-0.5 w-full rounded-full" style={{ background: lab.color + '40' }} />

                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-white">{lab.name}</p>
                      <p className="text-xs text-slate-500">{lab.building} · Floor {lab.floor}</p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: ls.color + '18', color: ls.color }}>
                      <StatusIcon size={10} /> {ls.label}
                    </span>
                  </div>

                  {/* Occupancy */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-500">Occupancy</span>
                      <span style={{ color: lab.color }}>{lab.occupancy}/{lab.capacity}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                           style={{ width: `${Math.round((lab.occupancy / lab.capacity) * 100)}%`, background: lab.color }} />
                    </div>
                  </div>

                  {/* Equipment count */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Cpu size={11} /> {lab.equipment.length} equipment types
                    </span>
                    <span className="text-slate-500">{lab.reservations.length} bookings</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div>
            {selectedLab ? (
              <motion.div key={selectedLab.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                          className="rounded-2xl border border-white/10 overflow-hidden"
                          style={{ background: 'rgba(4,9,26,0.85)', backdropFilter: 'blur(20px)' }}>
                {/* Coloured header */}
                <div className="p-5 border-b border-white/8"
                     style={{ background: selectedLab.color + '08' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-white">{selectedLab.name}</h2>
                      <p className="text-xs text-slate-400">{selectedLab.building}</p>
                    </div>
                    <button onClick={() => setReserveModal(selectedLab)}
                            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-[#020814]"
                            style={{ background: `linear-gradient(135deg,${selectedLab.color},${selectedLab.color}cc)` }}>
                      <PlusCircle size={11} /> Reserve
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/8">
                  {TABS.map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                            className="flex-1 py-2.5 text-xs font-semibold capitalize transition"
                            style={activeTab === tab
                              ? { color: selectedLab.color, borderBottom: `2px solid ${selectedLab.color}` }
                              : { color: '#64748b' }}>
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="p-4 max-h-96 overflow-y-auto no-scrollbar">
                  {/* Equipment tab */}
                  {activeTab === 'equipment' && (
                    <div className="space-y-2">
                      {selectedLab.equipment.map((eq) => (
                        <div key={eq.id} className="flex items-center justify-between rounded-xl border border-white/6 bg-white/4 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Cpu size={14} className="text-slate-400 shrink-0" />
                            <span className="text-sm text-white">{eq.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400">×{eq.count}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${eq.status === 'operational' ? 'bg-green-500/15 text-green-400' : eq.status === 'maintenance' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>
                              {eq.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reservations tab */}
                  {activeTab === 'reservations' && (
                    <div className="space-y-2">
                      {selectedLab.reservations.length === 0 && (
                        <p className="text-center py-8 text-sm text-slate-600">No reservations yet.</p>
                      )}
                      {selectedLab.reservations.map((r) => (
                        <div key={r.id} className="rounded-xl border border-white/6 bg-white/4 p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">{r.purpose}</p>
                              <p className="text-xs text-slate-400">{r.bookedBy}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-400">{r.date}</p>
                              <p className="text-[10px]" style={{ color: selectedLab.color }}>{r.slot}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Maintenance tab */}
                  {activeTab === 'maintenance' && (
                    <div className="space-y-2">
                      {selectedLab.maintenanceLogs.length === 0 && (
                        <p className="text-center py-8 text-sm text-slate-600">No maintenance logs.</p>
                      )}
                      {selectedLab.maintenanceLogs.map((m) => (
                        <div key={m.id} className="rounded-xl border border-white/6 bg-white/4 p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">{m.task}</p>
                              <p className="text-xs text-slate-400">By {m.technician}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-400">{m.date}</p>
                              <span className={`text-[10px] font-semibold ${m.status === 'completed' ? 'text-green-400' : m.status === 'scheduled' ? 'text-amber-400' : 'text-blue-400'}`}>
                                {m.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-white/8 text-center"
                   style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div>
                  <Zap size={36} className="mx-auto mb-3 text-slate-700" />
                  <p className="text-sm text-slate-500">Select a lab to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reserve Modal */}
      <AnimatePresence>
        {reserveModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center p-4"
                      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                        className="w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl"
                        style={{ background: 'rgba(4,9,26,0.95)', backdropFilter: 'blur(32px)' }}>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-white">Reserve — {reserveModal.name}</h2>
                <button onClick={() => setReserveModal(null)}
                        className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white transition">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Date</label>
                    <input type="date" value={resForm.date} onChange={(e) => setResForm((f) => ({ ...f, date: e.target.value }))}
                           className="w-full rounded-xl border border-white/10 bg-[#04091a] px-3 py-2.5 text-sm text-slate-300 outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Time Slot</label>
                    <select value={resForm.slot} onChange={(e) => setResForm((f) => ({ ...f, slot: e.target.value }))}
                            className="w-full rounded-xl border border-white/10 bg-[#04091a] px-3 py-2.5 text-sm text-slate-300 outline-none">
                      {['09:00–11:00', '11:00–13:00', '14:00–16:00', '16:00–18:00'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Purpose</label>
                  <input value={resForm.purpose} onChange={(e) => setResForm((f) => ({ ...f, purpose: e.target.value }))}
                         placeholder="e.g. AI Project — Group 4"
                         className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none" style={{ borderColor: reserveModal.color + '30' }} />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => setReserveModal(null)}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:bg-white/10 transition">
                    Cancel
                  </button>
                  <button onClick={handleReserve} disabled={!resForm.date || !resForm.purpose}
                          className="rounded-xl px-4 py-2 text-xs font-bold text-[#020814] disabled:opacity-50"
                          style={{ background: `linear-gradient(135deg,${reserveModal.color},${reserveModal.color}cc)` }}>
                    Confirm Reservation
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
