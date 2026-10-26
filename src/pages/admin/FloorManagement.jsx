// FloorManagement.jsx — Floors and rooms from the room list; "in class" comes from the timetable
// at the live time (IST) or at the time chosen in the Time Machine.
import { Building2, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import ClassroomInfoPanel from '../../components/timetable/ClassroomInfoPanel.jsx';
import TimeMachineBar from '../../components/timetable/TimeMachineBar.jsx';
import { buildingsApi, classroomsApi, timetableApi } from '../../utils/api.js';
import { istNow, toMinutes } from '../../components/three/twinExtras.js';
import { floorName } from '../../utils/campus.js';

// Colour and icon per room type
const roomTypes = {
  'Lecture Hall':      { color: '#00E5FF', icon: '🎓' },
  'Lab':               { color: '#00FFB3', icon: '🔬' },
  'Staff Room':        { color: '#F59E0B', icon: '👨‍🏫' },
  'Office':            { color: '#A78BFA', icon: '🏢' },
  'Department Office': { color: '#A78BFA', icon: '🏢' },
  'Administration':    { color: '#38BDF8', icon: '🏛️' },
};
const SCHEDULED_TYPES = ['CLASSROOM', 'LABORATORY'];   // rooms the timetable books

/** "2026-10-26T10:30:00" (a campus wall-clock time) → { dow, minutes }; null → now in IST. */
function clockAt(simulated) {
  if (!simulated) return istNow();
  const [d, t] = simulated.split('T');
  const [y, m, day] = d.split('-').map(Number);
  return { dow: (new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7, minutes: toMinutes(t.slice(0, 5)) };
}

export default function FloorManagement() {
  const [rooms, setRooms]                       = useState(null);
  const [entries, setEntries]                   = useState([]);
  const [bInfo, setBInfo]                       = useState({});
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFloor, setSelectedFloor]       = useState(null);
  const [activeRoomId, setActiveRoomId]         = useState(null);
  const [simulatedDateTime, setSimulatedDateTime] = useState(null);
  const [error, setError]                       = useState('');

  useEffect(() => {
    Promise.all([classroomsApi.list(), timetableApi.list(), buildingsApi.list()])
      .then(([r, tt, bl]) => {
        setRooms(r);
        setEntries(tt);
        setBInfo(Object.fromEntries(bl.map((b) => [b.id, b])));
        setSelectedBuilding((cur) => cur || r[0]?.building || null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const clock = clockAt(simulatedDateTime);
  const buildingIds = useMemo(() => [...new Set((rooms || []).map((r) => r.building))], [rooms]);
  const buildingFloors = useMemo(() => {
    const mine = (rooms || []).filter((r) => r.building === selectedBuilding);
    return [...new Set(mine.map((r) => r.floor))].sort((a, b) => a - b).map((floor) => {
      const list = mine.filter((r) => r.floor === floor).map((r) => {
        const session = entries.find((e) => e.classroom_id === r.id && e.day_of_week === clock.dow
          && clock.minutes >= toMinutes(e.start_time) && clock.minutes < toMinutes(e.end_time));
        return { ...r, scheduled: SCHEDULED_TYPES.includes(r.location_type), occupied: !!session, session };
      });
      const teaching = list.filter((r) => r.scheduled);
      return { floor, rooms: list, totalRooms: teaching.length, occupiedRooms: teaching.filter((r) => r.occupied).length };
    });
  }, [rooms, entries, selectedBuilding, clock.dow, clock.minutes]);
  const bData = { color: bInfo[selectedBuilding]?.color || '#00E5FF', name: bInfo[selectedBuilding]?.name || selectedBuilding };
  const floorData = selectedFloor !== null ? buildingFloors.find((f) => f.floor === selectedFloor) : null;

  return (
    <PageTransition className="min-h-screen px-4 pb-20 pt-28 sm:px-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
            <Layers size={22} className="text-[#00FFB3]" /> Floor Management
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">Rooms by floor. Classrooms and labs show whether a class is timetabled at the selected time.</p>
        </div>
        {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
        {rooms && buildingIds.length === 1 && (
          <p className="mb-4 text-xs text-slate-500">Only the {bData.name} has its rooms entered so far; add rooms for other blocks under Classrooms.</p>
        )}

        <TimeMachineBar onTimeChange={(dt) => setSimulatedDateTime(dt)} />

        {/* Building selector */}
        <div className="mb-6 flex flex-wrap gap-2">
          {buildingIds.map((id) => {
            const b = bInfo[id];
            const name = b?.name || id;
            return (
              <button
                key={id}
                onClick={() => { setSelectedBuilding(id); setSelectedFloor(null); }}
                className="rounded-xl px-4 py-2 text-xs font-semibold transition"
                style={selectedBuilding === id
                  ? { background: (b?.color ?? '#00E5FF') + '1a', color: b?.color ?? '#00E5FF', border: `1px solid ${(b?.color ?? '#00E5FF')}35` }
                  : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {name}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Floor list */}
          <div className="space-y-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {rooms ? `${buildingFloors.length} floors` : 'Loading…'}
            </p>
            {buildingFloors.map((f) => (
              <motion.button
                key={f.floor}
                whileHover={{ x: 4 }}
                onClick={() => setSelectedFloor(selectedFloor === f.floor ? null : f.floor)}
                className="w-full rounded-2xl border p-4 text-left transition"
                style={selectedFloor === f.floor
                  ? { background: (bData?.color ?? '#00E5FF') + '12', borderColor: (bData?.color ?? '#00E5FF') + '40', boxShadow: `0 0 16px ${(bData?.color ?? '#00E5FF')}15` }
                  : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">{floorName(f.floor)}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: (bData?.color ?? '#00E5FF') + '18', color: bData?.color ?? '#00E5FF' }}>
                    {f.occupiedRooms}/{f.totalRooms} in class
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                       style={{ width: `${f.totalRooms ? Math.round((f.occupiedRooms / f.totalRooms) * 100) : 0}%`, background: bData?.color ?? '#00E5FF' }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {f.rooms.length} rooms · {f.totalRooms} classrooms/labs
                </p>
              </motion.button>
            ))}
          </div>

          {/* Room grid */}
          <div>
            {floorData ? (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} key={`${selectedBuilding}-${selectedFloor}`}>
                <div className="mb-4 flex items-center gap-2">
                  <Building2 size={16} className="text-slate-400" />
                  <h2 className="font-bold text-white">{bData.name} — {floorName(selectedFloor)}</h2>
                  <span className="ml-auto text-xs text-slate-500">{floorData.rooms.length} rooms</span>
                </div>

                {/* Legend */}
                <div className="mb-4 flex flex-wrap gap-3">
                  {Object.entries(roomTypes).slice(0, 5).map(([type, meta]) => (
                    <span key={type} className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span className="h-2 w-2 rounded-sm" style={{ background: meta.color }} /> {type}
                    </span>
                  ))}
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="h-2 w-2 rounded-sm bg-white/30" /> Available
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="h-2 w-2 rounded-sm bg-red-500/40" /> Class running
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {floorData.rooms.map((room) => {
                    const rt = roomTypes[room.type] || { color: '#64748b', icon: '📦' };
                    return (
                      <motion.div
                        key={room.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setActiveRoomId(room.id || room.name)}
                        className="rounded-2xl border p-4 cursor-pointer transition"
                        style={{
                          background: room.occupied ? rt.color + '0e' : 'rgba(255,255,255,0.04)',
                          borderColor: room.occupied ? rt.color + '35' : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xl">{rt.icon}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${!room.scheduled ? 'bg-white/5 text-slate-400' : room.occupied ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                            {!room.scheduled ? 'Not timetabled' : room.occupied ? 'Class running' : 'Free'}
                          </span>
                        </div>
                        <p className="font-bold text-white text-sm">{room.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{room.type}</p>
                        {room.session && <p className="mt-1 text-[10px] text-red-300">{room.session.subject_name} · {room.session.section}</p>}
                        {room.capacity > 0 && (
                          <p className="text-[10px] mt-1" style={{ color: rt.color }}>Cap: {room.capacity}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-white/8 text-center"
                   style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div>
                  <Layers size={36} className="mx-auto mb-3 text-slate-700" />
                  <p className="text-sm text-slate-500">Select a floor to view room layout</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {activeRoomId && (
        <ClassroomInfoPanel
          classroomId={activeRoomId}
          simulatedDateTime={simulatedDateTime}
          onClose={() => setActiveRoomId(null)}
        />
      )}
    </PageTransition>
  );
}
