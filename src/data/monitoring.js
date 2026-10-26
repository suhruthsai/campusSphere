// ── Monitoring & IoT mock data for MVSR Engineering College ────────────────────────
// All values are static snapshots that simulate real sensor readings.

// ── Helpers ──────────────────────────────────────────────────────────────────
function hours24(startVal, variance = 10) {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    value: Math.max(0, Math.round(startVal + Math.sin(h / 3) * variance + (Math.random() - 0.5) * variance * 0.5)),
  }));
}
function days7(label, start, variance = 20) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((d) => ({
    day: d,
    [label]: Math.max(0, Math.round(start + (Math.random() - 0.5) * variance * 2)),
  }));
}
function months12(label, start, variance = 30) {
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return mon.map((m) => ({
    month: m,
    [label]: Math.max(0, Math.round(start + (Math.random() - 0.5) * variance * 2)),
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. Library Analytics
// ══════════════════════════════════════════════════════════════════════════════
export const library = {
  totalSeats: 140,
  occupiedSeats: 97,
  bookedSeats: 18,
  availableSeats: 25,
  sections: [
    { name: 'Reading Hall 1', total: 80, occupied: 62, booked: 8  },
    { name: 'Reading Hall 2', total: 60, occupied: 35, booked: 10 },
  ],
  peakHours: ['10:00–12:00', '14:00–16:00'],
  hourlyVisitors: hours24(45, 35),
  weeklyVisitors: days7('visitors', 90, 30),
  aiPrediction: {
    tomorrow: 102,
    weekPeak: 'Tuesday 10:00–12:00',
    suggestion: 'Extend hours on Tuesdays – predicted 15% higher demand.',
  },
  seatMap: Array.from({ length: 140 }, (_, i) => ({
    id: i + 1,
    status: i < 62 ? 'occupied' : i < 70 ? 'booked' : i < 115 ? 'available' : 'occupied',
    section: i < 80 ? 'Hall 1' : 'Hall 2',
  })),
};

// ══════════════════════════════════════════════════════════════════════════════
// 14. Crowd Analytics
// ══════════════════════════════════════════════════════════════════════════════
export const crowd = {
  totalOnCampus: 2840,
  zones: [
    { id: 'z1', name: 'Main Gate Area',   count: 320, capacity: 500, density: 'High',   color: '#ef4444' },
    { id: 'z2', name: 'CSE Block',        count: 480, capacity: 600, density: 'High',   color: '#F59E0B' },
    { id: 'z3', name: 'ECE Block',        count: 380, capacity: 600, density: 'Medium', color: '#F59E0B' },
    { id: 'z4', name: 'Canteen',          count: 210, capacity: 250, density: 'High',   color: '#ef4444' },
    { id: 'z5', name: 'Ground / Field',   count: 150, capacity: 1000,density: 'Low',    color: '#00FFB3' },
    { id: 'z6', name: 'Library',          count: 97,  capacity: 140, density: 'Medium', color: '#F59E0B' },
    { id: 'z7', name: 'Mech & EEE',       count: 340, capacity: 500, density: 'Medium', color: '#F59E0B' },
    { id: 'z8', name: 'Civil & IT',       count: 290, capacity: 500, density: 'Low',    color: '#00FFB3' },
    { id: 'z9', name: 'Parking',          count: 84,  capacity: 120, density: 'High',   color: '#ef4444' },
    { id: 'z10',name: 'Garden Area',      count: 45,  capacity: 200, density: 'Low',    color: '#00FFB3' },
  ],
  hourlyCount: hours24(1800, 800),
  peakTimes: ['08:30–09:30', '12:00–13:30', '16:00–17:00'],
  aiPrediction: {
    nextHour: 2950,
    peakToday: '12:30 — approx. 3,100 people',
    alert: 'Canteen zone approaching max capacity — expect overflow at lunch.',
  },
  weeklyPattern: days7('count', 2600, 400),
};

// ══════════════════════════════════════════════════════════════════════════════
// 15. Attendance Analytics
// ══════════════════════════════════════════════════════════════════════════════
export const attendance = {
  todayStudents: { total: 3240, present: 2876, absent: 364, percentage: 88.8 },
  todayFaculty:  { total: 128,  present: 121,  absent: 7,   percentage: 94.5 },
  departmentWise: [
    { dept: 'CSE',   students: 92, faculty: 96, color: '#00E5FF' },
    { dept: 'ECE',   students: 88, faculty: 94, color: '#7B61FF' },
    { dept: 'Mech',  students: 84, faculty: 90, color: '#F59E0B' },
    { dept: 'EEE',   students: 86, faculty: 92, color: '#00FFB3' },
    { dept: 'Civil', students: 90, faculty: 95, color: '#F472B6' },
    { dept: 'IT',    students: 94, faculty: 98, color: '#38BDF8' },
    { dept: 'S&H',   students: 88, faculty: 93, color: '#fb7185' },
  ],
  weeklyStudents: [82, 88, 91, 85, 89, 74, 0].map((v, i) => ({
    day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], percentage: v,
  })),
  weeklyFaculty: [90, 94, 96, 92, 95, 85, 0].map((v, i) => ({
    day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], percentage: v,
  })),
  monthlyTrend: months12('percentage', 87, 6),
  aiInsights: [
    { id: 1, insight: 'CSE batch attendance dropped 8% this week — possible exam stress.', type: 'warning' },
    { id: 2, insight: 'Overall attendance above 88% — on track for semester target.', type: 'success' },
    { id: 3, insight: 'Saturday attendance consistently low — consider revising schedule.', type: 'info' },
    { id: 4, insight: 'Faculty absenteeism spike predicted next week — 3 leave requests filed.', type: 'warning' },
  ],
  lowAttenders: [
    { name: 'Siddharth Rao', dept: 'Mech', rollNo: 'SU24ME011', attendance: 52, risk: 'High'   },
    { name: 'Rohan Gupta',   dept: 'Mech', rollNo: 'SU22ME034', attendance: 65, risk: 'Medium' },
    { name: 'Divya Menon',   dept: 'CSE',  rollNo: 'SU24CS002', attendance: 68, risk: 'Medium' },
  ],
};
