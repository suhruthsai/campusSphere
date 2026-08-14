// ── CampusSphere — Floors & Physical Layout Data ─────────────────────────────

export const floors = [
  // ── Civil & IT Block ───────────────────────────────────────────────────────
  {
    building: 'Civil & IT Block', floor: 0, totalRooms: 11, occupiedRooms: 8,
    rooms: [
      { id: 'ADMINISTRATION', name: 'Administration', type: 'Administration', capacity: 20, occupied: false, department: 'Admin' },
      { id: 'CE-IT-18', name: 'IoT Lab (CE-IT-18)', type: 'Lab', capacity: 35, occupied: true, department: 'IT' },
      { id: 'SUR-LAB-CE', name: 'Surveying Lab (Civil)', type: 'Lab', capacity: 40, occupied: true, department: 'Civil' },
      { id: 'EG-LAB-CE', name: 'Engineering Geology Lab', type: 'Lab', capacity: 35, occupied: true, department: 'Civil' },
      { id: 'FM-LAB-CE', name: 'Fluid Mechanics Lab', type: 'Lab', capacity: 35, occupied: true, department: 'Civil' },
      { id: 'TE-LAB', name: 'Transportation Engineering Lab', type: 'Lab', capacity: 35, occupied: true, department: 'Civil' },
      { id: 'EE-LAB', name: 'Environmental Engineering Lab', type: 'Lab', capacity: 35, occupied: true, department: 'Civil' },
      { id: 'CT-LAB', name: 'Concrete Technology Lab', type: 'Lab', capacity: 35, occupied: true, department: 'Civil' },
      { id: 'ADA-LAB', name: 'Ada Lab (CRT)', type: 'Lab', capacity: 40, occupied: true, department: 'IT' },
      { id: 'CB-01', name: 'Charles Babbage Lab (CB-01)', type: 'Lab', capacity: 40, occupied: true, department: 'IT' },
      { id: 'CSE-LAB-IV', name: 'CSE Lab-IV (CEP Lab)', type: 'Lab', capacity: 35, occupied: true, department: 'Civil' },
    ]
  },
  {
    building: 'Civil & IT Block', floor: 1, totalRooms: 7, occupiedRooms: 4,
    rooms: [
      { id: 'CE-IT-101', name: 'Classroom CE-IT-101 (IT-2A)', type: 'Lecture Hall', capacity: 65, occupied: true, department: 'IT' },
      { id: 'CE-IT-102', name: 'Classroom CE-IT-102 (IT-2B)', type: 'Lecture Hall', capacity: 65, occupied: true, department: 'IT' },
      { id: 'CE-IT-104', name: 'Computer Lab (CE-IT-104)', type: 'Lab', capacity: 40, occupied: true, department: 'IT' },
      { id: 'PRINCIPAL-OFFICE', name: 'Principal / Directors Office', type: 'Office', capacity: 15, occupied: false, department: 'Admin' },
      { id: 'IT-STAFF-ROOM', name: 'IT Staff Room', type: 'Staff Room', capacity: 25, occupied: true, department: 'IT' },
      { id: 'CIVIL-DEPT-OFFICE', name: 'Civil Department Office', type: 'Office', capacity: 15, occupied: true, department: 'Civil' },
      { id: 'IQAC-ROOM', name: 'IQAC Room', type: 'Office', capacity: 20, occupied: false, department: 'Admin' },
    ]
  },
  {
    building: 'Civil & IT Block', floor: 2, totalRooms: 10, occupiedRooms: 9,
    rooms: [
      { id: 'CE-IT-201', name: 'Classroom CE-IT-201 (IT-2C)', type: 'Lecture Hall', capacity: 65, occupied: true, department: 'IT' },
      { id: 'CE-IT-202', name: 'Classroom CE-IT-202 (IT-3A)', type: 'Lecture Hall', capacity: 65, occupied: true, department: 'IT' },
      { id: 'CE-IT-203', name: 'Classroom CE-IT-203 (IT-4C/4B)', type: 'Lecture Hall', capacity: 65, occupied: true, department: 'IT' },
      { id: 'CE-IT-211', name: 'CN & NS / DS / AI Lab (CE-IT-211)', type: 'Lab', capacity: 35, occupied: true, department: 'IT' },
      { id: 'CE-IT-212', name: 'Classroom CE-IT-212 (IT-3B)', type: 'Lecture Hall', capacity: 65, occupied: true, department: 'IT' },
      { id: 'CE-IT-213', name: 'Classroom CE-IT-213 (IT-3C)', type: 'Lecture Hall', capacity: 65, occupied: true, department: 'IT' },
      { id: 'CE-IT-214', name: 'Electronics Laboratory (CE-IT-214)', type: 'Lab', capacity: 35, occupied: true, department: 'IT' },
      { id: 'CE-204', name: 'Classroom CE-204 (Civil-7)', type: 'Lecture Hall', capacity: 65, occupied: true, department: 'Civil' },
      { id: 'CE-205', name: 'Classroom CE-205 (Civil-5)', type: 'Lecture Hall', capacity: 65, occupied: true, department: 'Civil' },
      { id: 'CE-206', name: 'Classroom CE-206 (Civil-3)', type: 'Lecture Hall', capacity: 65, occupied: true, department: 'Civil' },
    ]
  },
];

export const roomTypes = {
  'Lecture Hall':  { color: '#00E5FF', icon: '🎓' },
  'Seminar Room':  { color: '#7B61FF', icon: '📊' },
  'Lab':           { color: '#00FFB3', icon: '🔬' },
  'Conference Room':{ color: '#F472B6', icon: '🤝' },
  'Staff Room':    { color: '#F59E0B', icon: '👨‍🏫' },
  'Office':        { color: '#A78BFA', icon: '🏢' },
  'Administration':{ color: '#38BDF8', icon: '🏛️' },
  'Storage':       { color: '#64748b', icon: '📦' },
  'Technical':     { color: '#ef4444', icon: '⚙️' },
  'Study Area':    { color: '#34D399', icon: '📚' },
};
