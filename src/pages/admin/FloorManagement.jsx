// FloorManagement.jsx — Floor + room viewer
import { Building2, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import ClassroomInfoPanel from '../../components/timetable/ClassroomInfoPanel.jsx';
import TimeMachineBar from '../../components/timetable/TimeMachineBar.jsx';
import { buildings } from '../../data/campus.js';
import { floors, roomTypes } from '../../data/floors.js';

const buildingNames = [...new Set(floors.map((f) => f.building))];

export default function FloorManagement() {
  const [selectedBuilding, setSelectedBuilding] = useState(buildingNames[0]);
  const [selectedFloor, setSelectedFloor]       = useState(null);
  const [activeRoomId, setActiveRoomId]         = useState(null);
  const [simulatedDateTime, setSimulatedDateTime] = useState(null);

  const buildingFloors = floors.filter((f) => f.building === selectedBuilding);
  const bData = buildings.find((b) => b.name === selectedBuilding);
  const floorData = selectedFloor !== null ? buildingFloors.find((f) => f.floor === selectedFloor) : null;

  return (
    <PageTransition className="min-h-screen px-4 pb-20 pt-28 sm:px-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
            <Layers size={22} className="text-[#00FFB3]" /> Floor Management
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">Navigate floor plans and room allocation</p>
        </div>

        <TimeMachineBar onTimeChange={(dt) => setSimulatedDateTime(dt)} />

        {/* Building selector */}
        <div className="mb-6 flex flex-wrap gap-2">
          {buildingNames.map((name) => {
            const b = buildings.find((bld) => bld.name === name);
            return (
              <button
                key={name}
                onClick={() => { setSelectedBuilding(name); setSelectedFloor(null); }}
                className="rounded-xl px-4 py-2 text-xs font-semibold transition"
                style={selectedBuilding === name
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
              {buildingFloors.length} Floors
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
                  <span className="font-bold text-white text-sm">Floor {f.floor}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: (bData?.color ?? '#00E5FF') + '18', color: bData?.color ?? '#00E5FF' }}>
                    {f.occupiedRooms}/{f.totalRooms} occupied
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                       style={{ width: `${Math.round((f.occupiedRooms / f.totalRooms) * 100)}%`, background: bData?.color ?? '#00E5FF' }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {Math.round((f.occupiedRooms / f.totalRooms) * 100)}% occupancy
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
                  <h2 className="font-bold text-white">{selectedBuilding} — Floor {selectedFloor}</h2>
                  <span className="ml-auto text-xs text-slate-500">{floorData.totalRooms} rooms</span>
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
                    <span className="h-2 w-2 rounded-sm bg-red-500/40" /> Occupied
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {floorData.rooms.map((room) => {
                    const rt = roomTypes[room.type] || { color: '#64748b', icon: '📦' };
                    return (
                      <motion.div
                        key={room.name}
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
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${room.occupied ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                            {room.occupied ? 'Occupied' : 'Free'}
                          </span>
                        </div>
                        <p className="font-bold text-white text-sm">{room.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{room.type}</p>
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
