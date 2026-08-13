// IndoorNavigation.jsx — Module 20 (Indoor Navigation)
// Functions: Floor Maps, Room Navigation, Staircase / Lift Navigation

import { Building, Layers, MapPin, MoveUpRight, ArrowUpRight, Zap, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import MonitoringLayout, { MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { indoorNavigationData } from '../../data/navigation.js';

export default function IndoorNavigation() {
  const [selectedBuilding, setSelectedBuilding] = useState('CSE Block');
  const [selectedFloor, setSelectedFloor]       = useState(0);
  const [navMode, setNavMode]                   = useState('lift'); // lift vs stairs
  const [selectedRoom, setSelectedRoom]         = useState(null);

  const currentBuildingFloors = indoorNavigationData.buildingsFloorMaps[selectedBuilding] || indoorNavigationData.buildingsFloorMaps['CSE Block'];
  const currentFloorMap = currentBuildingFloors.find((f) => f.floor === selectedFloor) || currentBuildingFloors[0];

  return (
    <MonitoringLayout
      title="Indoor Navigation System"
      subtitle="Building floor plans, room-to-room routing, & staircase / lift navigation"
      icon={<Layers size={22} />}
      accentColor="#7B61FF"
      liveLabel="Floor Mapping Active"
      kpis={[
        { label: 'Active Building',  value: selectedBuilding, icon: '🏢', unit: '' },
        { label: 'Selected Floor',  value: currentFloorMap.name, icon: '🗺️', unit: '' },
        { label: 'Total Rooms',     value: currentFloorMap.rooms.length, icon: '🚪', unit: '' },
        { label: 'Elevator Status', value: 'Operational', icon: '🛗', unit: '' },
      ]}
    >
      {/* ── Building & Mode Selection Header ───────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-400 uppercase">Select Building:</label>
          <select
            value={selectedBuilding}
            onChange={(e) => {
              setSelectedBuilding(e.target.value);
              setSelectedFloor(0);
            }}
            className="rounded-xl border border-white/15 bg-[#141a22] px-3 py-1.5 text-xs text-white outline-none"
          >
            {Object.keys(indoorNavigationData.buildingsFloorMaps).map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Staircase vs Lift Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Vertical Transport:</span>
          <button
            onClick={() => setNavMode('lift')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              navMode === 'lift' ? 'bg-[#7B61FF] text-white' : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            🛗 Lift / Elevator (Fast)
          </button>
          <button
            onClick={() => setNavMode('stairs')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              navMode === 'stairs' ? 'bg-[#00FFB3] text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            🧗 Staircase (Active)
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── Interactive 2D Floor Plan Canvas Viewer ───────────────────── */}
        <div className="lg:col-span-2">
          <MCard title={`${selectedBuilding} — ${currentFloorMap.name}`} accent="#7B61FF">
            {/* Floor selector tabs */}
            <div className="mb-4 flex gap-2">
              {currentBuildingFloors.map((f) => (
                <button
                  key={f.floor}
                  onClick={() => setSelectedFloor(f.floor)}
                  className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
                    selectedFloor === f.floor ? 'bg-[#7B61FF] text-white' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {/* 2D Interactive Room Map Grid Container */}
            <div className="relative h-96 w-full rounded-2xl border border-white/10 bg-[#070e1c] p-4 overflow-hidden">
              {currentFloorMap.rooms.map((room) => {
                const isSelected = selectedRoom?.name === room.name;
                const isLift = room.type === 'Lift';
                const isStairs = room.type === 'Stairs';

                return (
                  <motion.div
                    key={room.name}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedRoom(room)}
                    style={{
                      position: 'absolute',
                      left: `${room.x}%`,
                      top: `${room.y}%`,
                      width: `${room.w}%`,
                      height: `${room.h}%`,
                    }}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition cursor-pointer ${
                      isSelected
                        ? 'border-[#00E5FF] bg-[#00E5FF]/20 shadow-[0_0_20px_rgba(0,229,255,0.3)]'
                        : isLift
                        ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                        : isStairs
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : room.status === 'Occupied'
                        ? 'border-red-500/30 bg-red-500/10 text-red-300'
                        : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-[11px] font-bold truncate max-w-full">{room.name}</p>
                    <span className="text-[9px] opacity-75">{room.type}</span>
                  </motion.div>
                );
              })}
            </div>
          </MCard>
        </div>

        {/* ── Room Details & Indoor Route Guidance ──────────────────────── */}
        <div className="space-y-4">
          <MCard title="Room Details" accent="#00E5FF">
            {selectedRoom ? (
              <div>
                <h3 className="text-sm font-bold text-white">{selectedRoom.name}</h3>
                <p className="text-xs text-[#00E5FF] font-mono mb-2">{selectedRoom.type} · Floor {selectedFloor}</p>
                <div className="flex justify-between border-t border-white/10 pt-2 text-xs text-slate-400">
                  <span>Status</span>
                  <span className={`font-semibold ${selectedRoom.status === 'Occupied' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedRoom.status}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Click any room on the floor map to view room details, occupancy status, and indoor routing directions.
              </p>
            )}
          </MCard>

          {/* Vertical Transport Guidance */}
          <MCard title="Indoor Navigation Guidance" accent={navMode === 'lift' ? '#7B61FF' : '#00FFB3'}>
            <div className="space-y-2 text-xs">
              <div className="rounded-xl border border-white/8 bg-white/4 p-3">
                <p className="font-bold text-white mb-1">
                  {navMode === 'lift' ? '🛗 Elevator A Route' : '🧗 East Staircase Route'}
                </p>
                <p className="text-slate-400 text-[11px]">
                  {navMode === 'lift'
                    ? 'Wait time: ~15 seconds · Capacity: 10 Persons · Wheelchair Ramp Ready'
                    : 'Steps: 24 steps per floor · Burn 12 calories · Clear Emergency Exit Path'}
                </p>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/4 p-3 text-slate-300">
                <p className="font-bold text-[#00E5FF] mb-1">Floor-to-Floor Step:</p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                  <li>Enter {selectedBuilding} Ground Lobby</li>
                  <li>Head towards {navMode === 'lift' ? 'Elevator A' : 'East Staircase'}</li>
                  <li>Proceed to Floor {selectedFloor}</li>
                  <li>Turn right down the corridor to your room</li>
                </ol>
              </div>
            </div>
          </MCard>
        </div>
      </div>
    </MonitoringLayout>
  );
}
