// ── Mock classroom data for Suhruth University ────────────────────────────────

export const classrooms = [
  // ── CSE Block ─────────────────────────────────────────────────────────────
  { id: 'cr001', name: 'CSE-101', building: 'CSE Block',   floor: 1, capacity: 60, equipment: ['Projector', 'AC', 'Whiteboard', 'Wi-Fi'], occupancy: 52, status: 'occupied',  type: 'Lecture Hall' },
  { id: 'cr002', name: 'CSE-102', building: 'CSE Block',   floor: 1, capacity: 40, equipment: ['Projector', 'AC', 'Smart Board'],          occupancy: 0,  status: 'available', type: 'Seminar Room' },
  { id: 'cr003', name: 'CSE-201', building: 'CSE Block',   floor: 2, capacity: 60, equipment: ['Projector', 'AC', 'Whiteboard'],           occupancy: 55, status: 'occupied',  type: 'Lecture Hall' },
  { id: 'cr004', name: 'CSE-202', building: 'CSE Block',   floor: 2, capacity: 30, equipment: ['AC', 'Smart Board', 'Video Conf'],         occupancy: 0,  status: 'available', type: 'Conference Room' },

  // ── ECE Block ─────────────────────────────────────────────────────────────
  { id: 'cr005', name: 'ECE-101', building: 'ECE Block',   floor: 1, capacity: 60, equipment: ['Projector', 'AC', 'Whiteboard'],           occupancy: 48, status: 'occupied',  type: 'Lecture Hall' },
  { id: 'cr006', name: 'ECE-102', building: 'ECE Block',   floor: 1, capacity: 60, equipment: ['Projector', 'AC', 'Wi-Fi'],                occupancy: 0,  status: 'available', type: 'Lecture Hall' },
  { id: 'cr007', name: 'ECE-201', building: 'ECE Block',   floor: 2, capacity: 40, equipment: ['Projector', 'AC', 'Smart Board'],          occupancy: 32, status: 'occupied',  type: 'Seminar Room' },

  // ── Mech & EEE Block ─────────────────────────────────────────────────────
  { id: 'cr008', name: 'ME-101',  building: 'Mech & EEE Block', floor: 1, capacity: 60, equipment: ['Projector', 'AC', 'Whiteboard'],      occupancy: 44, status: 'occupied',  type: 'Lecture Hall' },
  { id: 'cr009', name: 'EEE-101', building: 'Mech & EEE Block', floor: 1, capacity: 60, equipment: ['Projector', 'AC', 'Whiteboard'],      occupancy: 0,  status: 'available', type: 'Lecture Hall' },
  { id: 'cr010', name: 'ME-201',  building: 'Mech & EEE Block', floor: 2, capacity: 60, equipment: ['Projector', 'AC', 'Whiteboard'],      occupancy: 36, status: 'occupied',  type: 'Lecture Hall' },

  // ── Civil & IT Block ─────────────────────────────────────────────────────
  { id: 'cr011', name: 'CV-101',  building: 'Civil & IT Block', floor: 1, capacity: 60, equipment: ['Projector', 'AC', 'Smart Board'],     occupancy: 42, status: 'occupied',  type: 'Lecture Hall' },
  { id: 'cr012', name: 'IT-101',  building: 'Civil & IT Block', floor: 1, capacity: 60, equipment: ['Projector', 'AC', 'Whiteboard'],      occupancy: 0,  status: 'available', type: 'Lecture Hall' },
  { id: 'cr013', name: 'IT-201',  building: 'Civil & IT Block', floor: 2, capacity: 40, equipment: ['Projector', 'AC', 'Wi-Fi'],           occupancy: 28, status: 'occupied',  type: 'Seminar Room' },

  // ── S&H Block ─────────────────────────────────────────────────────────────
  { id: 'cr014', name: 'SH-101',  building: 'S&H Block',  floor: 1, capacity: 80, equipment: ['Projector', 'AC', 'Whiteboard', 'Wi-Fi'],  occupancy: 70, status: 'occupied',  type: 'Lecture Hall' },
  { id: 'cr015', name: 'SH-201',  building: 'S&H Block',  floor: 2, capacity: 60, equipment: ['Projector', 'AC', 'Whiteboard'],           occupancy: 0,  status: 'available', type: 'Lecture Hall' },

  // ── Exam Dept & R&D ──────────────────────────────────────────────────────
  { id: 'cr016', name: 'Exam Hall A', building: 'Examination Dept', floor: 1, capacity: 120, equipment: ['Projector', 'CCTV', 'AC'],      occupancy: 0,  status: 'maintenance', type: 'Exam Hall' },
  { id: 'cr017', name: 'Seminar Hall', building: 'R&D Block',       floor: 2, capacity: 50,  equipment: ['Projector', 'Video Conf', 'AC'], occupancy: 18, status: 'occupied',   type: 'Seminar Room' },
];

// 7-day availability schedule (slots per day: 09-11, 11-13, 14-16, 16-18)
export const timeSlots = ['09:00–11:00', '11:00–13:00', '14:00–16:00', '16:00–18:00'];

export const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Bookings — { classroomId, day, slot, bookedBy, course }
export const bookings = [
  { id: 'bk001', classroomId: 'cr001', day: 'Mon', slot: '09:00–11:00', bookedBy: 'Prof. Ramesh Kumar',  course: 'Data Structures'       },
  { id: 'bk002', classroomId: 'cr001', day: 'Mon', slot: '11:00–13:00', bookedBy: 'Dr. Lakshmi Venkat',  course: 'Algorithms'            },
  { id: 'bk003', classroomId: 'cr001', day: 'Tue', slot: '09:00–11:00', bookedBy: 'Prof. Ramesh Kumar',  course: 'Data Structures'       },
  { id: 'bk004', classroomId: 'cr003', day: 'Mon', slot: '14:00–16:00', bookedBy: 'Dr. Lakshmi Venkat',  course: 'Machine Learning'      },
  { id: 'bk005', classroomId: 'cr005', day: 'Mon', slot: '09:00–11:00', bookedBy: 'Dr. Priya Sharma',    course: 'Digital Electronics'   },
  { id: 'bk006', classroomId: 'cr005', day: 'Wed', slot: '11:00–13:00', bookedBy: 'Prof. Vijay Anand',   course: 'Signals & Systems'     },
  { id: 'bk007', classroomId: 'cr008', day: 'Tue', slot: '14:00–16:00', bookedBy: 'Mr. Arun Mehta',      course: 'Thermodynamics'        },
  { id: 'bk008', classroomId: 'cr014', day: 'Mon', slot: '09:00–11:00', bookedBy: 'Dr. Meena Iyer',      course: 'Engineering Physics'   },
];
