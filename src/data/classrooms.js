// ─── CampusSphere — Civil & IT Block Classrooms & Locations ──────────────────

export const classrooms = [
  // ── First Floor Classrooms & Offices ──────────────────────────────────────
  { id: 'CE-IT-101', name: 'Classroom CE-IT-101', building: 'Civil & IT Block', floor: 1, capacity: 65, equipment: ['Projector', 'Audio Mic', 'Whiteboard'], occupancy: 60, status: 'occupied', type: 'Lecture Hall', section: 'IT-2A' },
  { id: 'CE-IT-102', name: 'Classroom CE-IT-102', building: 'Civil & IT Block', floor: 1, capacity: 65, equipment: ['Projector', 'Audio Mic', 'Whiteboard'], occupancy: 58, status: 'occupied', type: 'Lecture Hall', section: 'IT-2B' },
  { id: 'CE-IT-104', name: 'Computer Lab (CE-IT-104)', building: 'Civil & IT Block', floor: 1, capacity: 40, equipment: ['40 Desktop PCs', 'Gigabit Switch', 'Projector'], occupancy: 38, status: 'occupied', type: 'Lab', section: 'IT Dept' },
  { id: 'PRINCIPAL-OFFICE', name: 'Principal / Directors Office', building: 'Civil & IT Block', floor: 1, capacity: 15, equipment: ['Executive Table', 'Conference Display', 'AC'], occupancy: 4, status: 'available', type: 'Office' },
  { id: 'IT-STAFF-ROOM', name: 'IT Staff Room', building: 'Civil & IT Block', floor: 1, capacity: 25, equipment: ['Faculty Desks', 'Workstations'], occupancy: 12, status: 'available', type: 'Staff Room' },
  { id: 'CIVIL-DEPT-OFFICE', name: 'Civil Department Office', building: 'Civil & IT Block', floor: 1, capacity: 15, equipment: ['HOD Desk', 'Staff Cabins'], occupancy: 6, status: 'available', type: 'Department Office' },
  { id: 'IQAC-ROOM', name: 'IQAC Room', building: 'Civil & IT Block', floor: 1, capacity: 20, equipment: ['Conference System', 'Projector'], occupancy: 5, status: 'available', type: 'Office' },

  // ── Second Floor Classrooms & Labs ─────────────────────────────────────────
  { id: 'CE-IT-201', name: 'Classroom CE-IT-201', building: 'Civil & IT Block', floor: 2, capacity: 65, equipment: ['Projector', 'Audio Setup', 'Whiteboard'], occupancy: 62, status: 'occupied', type: 'Lecture Hall', section: 'IT-2C' },
  { id: 'CE-IT-202', name: 'Classroom CE-IT-202', building: 'Civil & IT Block', floor: 2, capacity: 65, equipment: ['Projector', 'Smart Board', 'Audio Mic'], occupancy: 64, status: 'occupied', type: 'Lecture Hall', section: 'IT-3A' },
  { id: 'CE-IT-203', name: 'Classroom CE-IT-203', building: 'Civil & IT Block', floor: 2, capacity: 65, equipment: ['Projector', 'Sound System', 'Whiteboard'], occupancy: 55, status: 'occupied', type: 'Lecture Hall', section: 'IT-4C' },
  { id: 'CE-IT-211', name: 'CN & NS / DS / AI Lab (CE-IT-211)', building: 'Civil & IT Block', floor: 2, capacity: 35, equipment: ['Cisco Routers', 'High-End PCs', 'Projector'], occupancy: 32, status: 'occupied', type: 'Lab', section: 'IT Labs' },
  { id: 'CE-IT-212', name: 'Classroom CE-IT-212', building: 'Civil & IT Block', floor: 2, capacity: 65, equipment: ['Projector', 'Sound System', 'Whiteboard'], occupancy: 59, status: 'occupied', type: 'Lecture Hall', section: 'IT-3B' },
  { id: 'CE-IT-213', name: 'Classroom CE-IT-213', building: 'Civil & IT Block', floor: 2, capacity: 65, equipment: ['Projector', 'Smart Board', 'Whiteboard'], occupancy: 61, status: 'occupied', type: 'Lecture Hall', section: 'IT-3C' },
  { id: 'CE-IT-214', name: 'Electronics Laboratory (CE-IT-214)', building: 'Civil & IT Block', floor: 2, capacity: 35, equipment: ['DSO', 'Function Generators', 'Power Supplies'], occupancy: 30, status: 'occupied', type: 'Lab', section: 'EDS Lab' },
  { id: 'CE-204', name: 'Classroom CE-204', building: 'Civil & IT Block', floor: 2, capacity: 65, equipment: ['Projector', 'Whiteboard', 'Audio Mic'], occupancy: 54, status: 'occupied', type: 'Lecture Hall', section: 'Civil-7' },
  { id: 'CE-205', name: 'Classroom CE-205', building: 'Civil & IT Block', floor: 2, capacity: 65, equipment: ['Projector', 'Smart Board', 'Sound System'], occupancy: 60, status: 'occupied', type: 'Lecture Hall', section: 'Civil-5' },
  { id: 'CE-206', name: 'Classroom CE-206', building: 'Civil & IT Block', floor: 2, capacity: 65, equipment: ['Projector', 'Whiteboard', 'Drawing Easels'], occupancy: 58, status: 'occupied', type: 'Lecture Hall', section: 'Civil-3' },

  // ── Ground Floor Laboratories & Admin ──────────────────────────────────────
  { id: 'ADMINISTRATION', name: 'Administration', building: 'Civil & IT Block', floor: 0, capacity: 20, equipment: ['Admin Desks', 'Computer Terminals'], occupancy: 8, status: 'available', type: 'Administration' },
  { id: 'CE-IT-18', name: 'IoT Lab (CE-IT-18)', building: 'Civil & IT Block', floor: 0, capacity: 35, equipment: ['Raspberry Pi', 'Arduino', 'Sensors'], occupancy: 28, status: 'occupied', type: 'Lab' },
  { id: 'SUR-LAB-CE', name: 'Surveying Lab (Civil)', building: 'Civil & IT Block', floor: 0, capacity: 40, equipment: ['Total Station', 'Theodolite'], occupancy: 35, status: 'occupied', type: 'Lab' },
  { id: 'EG-LAB-CE', name: 'Engineering Geology Lab (Civil)', building: 'Civil & IT Block', floor: 0, capacity: 35, equipment: ['Rock Specimens', 'Microscopes'], occupancy: 30, status: 'occupied', type: 'Lab' },
  { id: 'FM-LAB-CE', name: 'Fluid Mechanics Lab (Civil)', building: 'Civil & IT Block', floor: 0, capacity: 35, equipment: ['Venturimeter', 'Orifice Meter'], occupancy: 32, status: 'occupied', type: 'Lab' },
  { id: 'TE-LAB', name: 'Transportation Engineering Lab', building: 'Civil & IT Block', floor: 0, capacity: 35, equipment: ['Ductility Machine', 'Marshall Test'], occupancy: 30, status: 'occupied', type: 'Lab' },
  { id: 'EE-LAB', name: 'Environmental Engineering Lab', building: 'Civil & IT Block', floor: 0, capacity: 35, equipment: ['BOD Incubator', 'pH Meter'], occupancy: 30, status: 'occupied', type: 'Lab' },
  { id: 'CT-LAB', name: 'Concrete Technology Lab', building: 'Civil & IT Block', floor: 0, capacity: 35, equipment: ['CTM', 'Slump Cone'], occupancy: 30, status: 'occupied', type: 'Lab' },
  { id: 'ADA-LAB', name: 'Ada Lab (CRT)', building: 'Civil & IT Block', floor: 0, capacity: 40, equipment: ['Workstations', 'Projector'], occupancy: 40, status: 'occupied', type: 'Lab' },
  { id: 'CB-01', name: 'Charles Babbage Lab (CB-01)', building: 'Civil & IT Block', floor: 0, capacity: 40, equipment: ['Workstations', 'High-Speed Net'], occupancy: 40, status: 'occupied', type: 'Lab' },
  { id: 'CSE-LAB-IV', name: 'CSE Lab-IV (CEP Lab)', building: 'Civil & IT Block', floor: 0, capacity: 35, equipment: ['Workstations', 'Compilers'], occupancy: 35, status: 'occupied', type: 'Lab' },
];

export const timeSlots = [
  '09:30 - 10:30 (P1)',
  '10:30 - 11:30 (P2)',
  '11:40 - 12:40 (P3)',
  '12:40 - 13:40 (P4)',
  '14:15 - 15:15 (P5)',
  '15:15 - 16:15 (P6)',
];

export const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
