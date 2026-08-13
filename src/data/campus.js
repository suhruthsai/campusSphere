// ─── Suhruth University — Campus Data ────────────────────────────────────────
//
// Coordinate system (top-view):
//   X: left (negative) → right (positive)
//   Z: top  (negative) → bottom (positive)
//
// Campus zones:
//   Left strip  x ≈ -7.5  → sports ground, basketball, parking
//   Top row     z ≈ -5.0  → R&D, Canteen, CAD Lab, Exam Dept, S&H, Garden
//   Middle row  z ≈ -1.5  → ECE, CSE, Mech&EEE, Civil&IT
//   Walk area   z ≈  0.8  → horizontal pedestrian walkway
//   Bottom row  z ≈  4.2  → Library, Auditorium
//   Right edge  x ≈  6.8  → Main Gate

export const buildings = [
  // ── TOP ROW ─────────────────────────────────────────────────────────────────
  {
    id: 'rnd',
    name: 'R&D Block',
    type: 'Research & Development',
    departments: ['Research', 'Innovation Lab', 'Projects'],
    occupancy: 72,
    energy: 'Optimized',
    floors: 2,
    x: -5.8,
    z: -5.0,
    height: 1.2,
    color: '#00FFB3',
  },
  {
    id: 'canteen',
    name: 'Canteen',
    type: 'Food & Student Life',
    departments: ['Cafeteria', 'Snacks', 'Student Hub'],
    occupancy: 95,
    energy: 'High demand',
    floors: 2,
    x: -4.0,
    z: -5.0,
    height: 1.2,
    color: '#FB923C',
  },
  {
    id: 'cad-lab',
    name: 'CAD Lab',
    type: 'Computer Aided Design',
    departments: ['Design Studio', 'Simulation', 'Fabrication'],
    occupancy: 68,
    energy: 'Moderate',
    floors: 2,
    x: -2.4,
    z: -5.0,
    height: 1.2,
    color: '#38BDF8',
  },
  {
    id: 'exam-dept',
    name: 'Examination Dept',
    type: 'Academic Administration',
    departments: ['Exam Cell', 'Results', 'Records'],
    occupancy: 40,
    energy: 'Low',
    floors: 2,
    x: -0.8,
    z: -5.0,
    height: 1.2,
    color: '#F472B6',
  },
  {
    id: 'sh-block',
    name: 'S&H Block',
    type: 'Science & Humanities',
    departments: ['Physics', 'Chemistry', 'Mathematics', 'English'],
    occupancy: 78,
    energy: 'Active',
    floors: 2,
    x: 1.2,
    z: -5.0,
    height: 1.2,
    color: '#A78BFA',
  },

  // ── MIDDLE ROW — DEPARTMENT BLOCKS ──────────────────────────────────────────
  {
    id: 'ece',
    name: 'ECE Block',
    type: 'Electronics & Communication Engg',
    departments: ['ECE Dept', 'Communication Lab', 'VLSI Lab'],
    occupancy: 85,
    energy: 'Peak active',
    floors: 2,
    x: -4.5,
    z: -1.5,
    height: 1.2,
    color: '#00E5FF',
  },
  {
    id: 'cse',
    name: 'CSE Block',
    type: 'Computer Science & Engineering',
    departments: ['CSE Dept', 'Coding Lab', 'AI Research Lab'],
    occupancy: 92,
    energy: 'Peak learning',
    floors: 2,
    x: -2.6,
    z: -1.5,
    height: 1.2,
    color: '#7B61FF',
  },
  {
    id: 'mech-eee',
    name: 'Mech & EEE Block',
    type: 'Mechanical & Electrical Engg',
    departments: ['Mech Dept', 'EEE Dept', 'Workshop'],
    occupancy: 74,
    energy: 'High usage',
    floors: 2,
    x: -0.7,
    z: -1.5,
    height: 1.2,
    color: '#F59E0B',
  },
  {
    id: 'civil-it',
    name: 'Civil & IT Block',
    type: 'Civil & Information Technology',
    departments: ['Civil Dept', 'IT Dept', 'Survey Lab'],
    occupancy: 68,
    energy: 'Moderate',
    floors: 2,
    x: 1.4,
    z: -1.5,
    height: 1.2,
    color: '#34D399',
  },

  // ── BOTTOM ROW ──────────────────────────────────────────────────────────────
  {
    id: 'library',
    name: 'Library',
    type: 'Knowledge Commons',
    departments: ['Book Stacks', 'Digital Archive', 'Reading Hall'],
    occupancy: 60,
    energy: 'Low demand',
    floors: 2,
    x: -2.0,
    z: 4.2,
    height: 1.2,
    color: '#818CF8',
  },
  {
    id: 'auditorium',
    name: 'Auditorium',
    type: 'Events & Performances',
    departments: ['Main Stage', 'Events Hall', 'Conference Rooms'],
    occupancy: 45,
    energy: 'Event active',
    floors: 2,
    x: 3.2,
    z: 4.2,
    height: 1.4,
    color: '#F97316',
    shape: 'oval',
  },
];

// ── Suhruth University campus locations ────────────────────────────────────
export const locations = [
  'CSE Block — AI Research Lab',
  'ECE Block — VLSI Lab',
  'CAD Lab — Design Studio',
  'Library — Reading Hall',
  'Canteen — Ground Floor',
  'Auditorium — Main Stage',
  'R&D Block — Innovation Lab',
  'S&H Block — Physics Lab',
  'Mech & EEE — Workshop',
  'Civil & IT — Survey Lab',
  'Main Gate — Entry',
  'Basketball Court',
  'Sports Ground',
];

// ── Home page stats ────────────────────────────────────────────────────────
export const stats = [
  { label: 'Campus buildings', value: 11, suffix: '' },
  { label: 'Live sensors',     value: 480, suffix: '' },
  { label: 'Students enrolled', value: 3, suffix: 'k+' },
  { label: 'Route accuracy',   value: 97, suffix: '%' },
];

// ── Events ────────────────────────────────────────────────────────────────
export const events = [
  { title: 'Tech Symposium 2026',    date: 'Aug 10', venue: 'Auditorium',    registrations: 620, status: 'Open' },
  { title: 'CSE Code Sprint',        date: 'Aug 14', venue: 'CSE Block',     registrations: 284, status: 'Open' },
  { title: 'ECE Project Expo',       date: 'Aug 20', venue: 'ECE Block',     registrations: 318, status: 'Filling fast' },
  { title: 'Cultural Night',         date: 'Aug 25', venue: 'Auditorium',    registrations: 890, status: 'Open' },
];

// ── Student timetable ─────────────────────────────────────────────────────
export const timetable = [
  { time: '09:00', course: 'Data Structures',       room: 'CSE Block — Room 102',  progress: 90 },
  { time: '11:00', course: 'Digital Electronics',   room: 'ECE Block — Lab 201',   progress: 84 },
  { time: '14:00', course: 'Engineering Drawing',   room: 'CAD Lab — Studio 1',    progress: 76 },
  { time: '16:00', course: 'Technical English',     room: 'S&H Block — Room 301',  progress: 68 },
];

// ── Department stats ─────────────────────────────────────────────────────
export const departmentStats = [
  { name: 'CSE & IT',   students: 980,  occupancy: 92 },
  { name: 'ECE',        students: 720,  occupancy: 85 },
  { name: 'Mech & EEE', students: 640,  occupancy: 74 },
  { name: 'Civil',      students: 480,  occupancy: 68 },
];
