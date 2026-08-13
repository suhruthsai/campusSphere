// ── Mock floor + room data for Suhruth University ────────────────────────────

export const floors = [
  // ── CSE Block ─────────────────────────────────────────────────────────────
  {
    building: 'CSE Block', floor: 1, totalRooms: 6, occupiedRooms: 4,
    rooms: [
      { id: 'r001', name: 'CSE-101', type: 'Lecture Hall',     capacity: 60, occupied: true,  department: 'CSE' },
      { id: 'r002', name: 'CSE-102', type: 'Seminar Room',     capacity: 40, occupied: false, department: 'CSE' },
      { id: 'r003', name: 'Coding Lab', type: 'Lab',           capacity: 40, occupied: true,  department: 'CSE' },
      { id: 'r004', name: 'Faculty Room', type: 'Staff Room',  capacity: 10, occupied: true,  department: 'CSE' },
      { id: 'r005', name: 'HOD Office', type: 'Office',        capacity: 4,  occupied: true,  department: 'CSE' },
      { id: 'r006', name: 'Store Room', type: 'Storage',       capacity: 0,  occupied: false, department: 'CSE' },
    ],
  },
  {
    building: 'CSE Block', floor: 2, totalRooms: 5, occupiedRooms: 3,
    rooms: [
      { id: 'r007', name: 'CSE-201', type: 'Lecture Hall',     capacity: 60, occupied: true,  department: 'CSE' },
      { id: 'r008', name: 'CSE-202', type: 'Conference Room',  capacity: 30, occupied: false, department: 'CSE' },
      { id: 'r009', name: 'AI Research Lab', type: 'Lab',      capacity: 30, occupied: true,  department: 'CSE' },
      { id: 'r010', name: 'Research Room',   type: 'Lab',      capacity: 12, occupied: true,  department: 'CSE' },
      { id: 'r011', name: 'Server Room',     type: 'Technical', capacity: 0, occupied: false, department: 'CSE' },
    ],
  },

  // ── ECE Block ─────────────────────────────────────────────────────────────
  {
    building: 'ECE Block', floor: 1, totalRooms: 6, occupiedRooms: 4,
    rooms: [
      { id: 'r012', name: 'ECE-101', type: 'Lecture Hall',     capacity: 60, occupied: true,  department: 'ECE' },
      { id: 'r013', name: 'ECE-102', type: 'Lecture Hall',     capacity: 60, occupied: false, department: 'ECE' },
      { id: 'r014', name: 'Communication Lab', type: 'Lab',    capacity: 30, occupied: true,  department: 'ECE' },
      { id: 'r015', name: 'Faculty Room', type: 'Staff Room',  capacity: 10, occupied: true,  department: 'ECE' },
      { id: 'r016', name: 'HOD Office', type: 'Office',        capacity: 4,  occupied: true,  department: 'ECE' },
      { id: 'r017', name: 'Store Room', type: 'Storage',       capacity: 0,  occupied: false, department: 'ECE' },
    ],
  },
  {
    building: 'ECE Block', floor: 2, totalRooms: 4, occupiedRooms: 2,
    rooms: [
      { id: 'r018', name: 'ECE-201', type: 'Seminar Room',     capacity: 40, occupied: true,  department: 'ECE' },
      { id: 'r019', name: 'VLSI Lab', type: 'Lab',             capacity: 25, occupied: false, department: 'ECE' },
      { id: 'r020', name: 'Project Lab', type: 'Lab',          capacity: 20, occupied: true,  department: 'ECE' },
      { id: 'r021', name: 'Instrument Store', type: 'Storage', capacity: 0,  occupied: false, department: 'ECE' },
    ],
  },

  // ── Mech & EEE Block ─────────────────────────────────────────────────────
  {
    building: 'Mech & EEE Block', floor: 1, totalRooms: 6, occupiedRooms: 5,
    rooms: [
      { id: 'r022', name: 'ME-101',  type: 'Lecture Hall', capacity: 60, occupied: true,  department: 'Mech' },
      { id: 'r023', name: 'EEE-101', type: 'Lecture Hall', capacity: 60, occupied: false, department: 'EEE'  },
      { id: 'r024', name: 'Workshop', type: 'Lab',         capacity: 35, occupied: true,  department: 'Mech' },
      { id: 'r025', name: 'EEE Lab',  type: 'Lab',         capacity: 30, occupied: true,  department: 'EEE'  },
      { id: 'r026', name: 'Mech Faculty Room', type: 'Staff Room', capacity: 12, occupied: true, department: 'Mech' },
      { id: 'r027', name: 'EEE Faculty Room',  type: 'Staff Room', capacity: 10, occupied: true, department: 'EEE'  },
    ],
  },
  {
    building: 'Mech & EEE Block', floor: 2, totalRooms: 4, occupiedRooms: 2,
    rooms: [
      { id: 'r028', name: 'ME-201', type: 'Lecture Hall',   capacity: 60, occupied: true,  department: 'Mech' },
      { id: 'r029', name: 'Thermal Lab', type: 'Lab',        capacity: 20, occupied: false, department: 'Mech' },
      { id: 'r030', name: 'Power Electronics Lab', type: 'Lab', capacity: 25, occupied: true, department: 'EEE' },
      { id: 'r031', name: 'Drawing Hall', type: 'Lab',       capacity: 40, occupied: false, department: 'Mech' },
    ],
  },

  // ── Library ───────────────────────────────────────────────────────────────
  {
    building: 'Library', floor: 1, totalRooms: 4, occupiedRooms: 3,
    rooms: [
      { id: 'r032', name: 'Reading Hall', type: 'Study Area', capacity: 80, occupied: true,  department: 'Library' },
      { id: 'r033', name: 'Digital Archive', type: 'Lab',     capacity: 20, occupied: true,  department: 'Library' },
      { id: 'r034', name: 'Discussion Room', type: 'Seminar', capacity: 15, occupied: true,  department: 'Library' },
      { id: 'r035', name: 'Book Stacks', type: 'Storage',     capacity: 0,  occupied: false, department: 'Library' },
    ],
  },
  {
    building: 'Library', floor: 2, totalRooms: 3, occupiedRooms: 1,
    rooms: [
      { id: 'r036', name: 'Reading Hall 2', type: 'Study Area', capacity: 60, occupied: false, department: 'Library' },
      { id: 'r037', name: 'Media Studio', type: 'Lab',           capacity: 15, occupied: true,  department: 'Library' },
      { id: 'r038', name: 'Rare Books Section', type: 'Storage', capacity: 0,  occupied: false, department: 'Library' },
    ],
  },
];

export const roomTypes = {
  'Lecture Hall':  { color: '#00E5FF', icon: '🎓' },
  'Seminar Room':  { color: '#7B61FF', icon: '📊' },
  'Lab':           { color: '#00FFB3', icon: '🔬' },
  'Conference Room':{ color: '#F472B6', icon: '🤝' },
  'Staff Room':    { color: '#F59E0B', icon: '👨‍🏫' },
  'Office':        { color: '#A78BFA', icon: '🏢' },
  'Storage':       { color: '#64748b', icon: '📦' },
  'Technical':     { color: '#ef4444', icon: '⚙️' },
  'Study Area':    { color: '#34D399', icon: '📚' },
};
