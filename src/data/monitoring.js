// ── Monitoring & IoT mock data for Suhruth University ────────────────────────
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
// 9. Smart Parking
// ══════════════════════════════════════════════════════════════════════════════
export const parking = {
  totalSlots: 120,
  occupiedSlots: 84,
  vehiclesIn: 84,
  vehiclesOut: 36,
  zones: [
    { id: 'A', label: 'Zone A – Faculty',   total: 30, occupied: 28, color: '#ef4444' },
    { id: 'B', label: 'Zone B – Students',  total: 60, occupied: 43, color: '#F59E0B' },
    { id: 'C', label: 'Zone C – Staff',     total: 20, occupied: 9,  color: '#00FFB3' },
    { id: 'D', label: 'Zone D – Visitors',  total: 10, occupied: 4,  color: '#7B61FF' },
  ],
  hourlyOccupancy: hours24(60, 30),
  predictionNext3h: [85, 92, 78],
  entryExitLogs: [
    { id: 1,  time: '07:45', vehicle: 'TS09 AB 1234', type: 'Car',   action: 'entry', zone: 'A', driver: 'Prof. Ramesh Kumar' },
    { id: 2,  time: '07:52', vehicle: 'TS07 CD 5678', type: 'Bike',  action: 'entry', zone: 'B', driver: 'Aarav Singh'        },
    { id: 3,  time: '08:03', vehicle: 'TS10 EF 9012', type: 'Car',   action: 'entry', zone: 'B', driver: 'Ananya Krishnan'    },
    { id: 4,  time: '08:11', vehicle: 'TS14 GH 3456', type: 'Bike',  action: 'exit',  zone: 'C', driver: 'Mr. Biju Thomas'   },
    { id: 5,  time: '08:22', vehicle: 'TS01 IJ 7890', type: 'Car',   action: 'entry', zone: 'A', driver: 'Dr. Priya Sharma'  },
    { id: 6,  time: '08:35', vehicle: 'TS03 KL 2345', type: 'SUV',   action: 'entry', zone: 'D', driver: 'Guest'             },
    { id: 7,  time: '08:50', vehicle: 'TS09 MN 6789', type: 'Bike',  action: 'exit',  zone: 'B', driver: 'Karan Joshi'       },
    { id: 8,  time: '09:05', vehicle: 'TS12 OP 0123', type: 'Car',   action: 'entry', zone: 'A', driver: 'Dr. Sunita Patel'  },
  ],
};

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
// 11. Energy Management
// ══════════════════════════════════════════════════════════════════════════════
export const energy = {
  totalTodayKwh: 1842,
  peakDemandKw: 312,
  savings: '8.4%',
  solarGenKwh: 226,
  buildingUsage: [
    { building: 'CSE Block',       kwh: 320, color: '#00E5FF' },
    { building: 'ECE Block',       kwh: 280, color: '#7B61FF' },
    { building: 'Mech & EEE',      kwh: 240, color: '#F59E0B' },
    { building: 'Civil & IT',      kwh: 210, color: '#00FFB3' },
    { building: 'Library',         kwh: 190, color: '#F472B6' },
    { building: 'S&H Block',       kwh: 175, color: '#38BDF8' },
    { building: 'Canteen',         kwh: 145, color: '#fb7185' },
    { building: 'Admin Block',     kwh: 130, color: '#a78bfa' },
    { building: 'R&D Block',       kwh: 95,  color: '#34D399' },
    { building: 'Exam Dept',       kwh: 57,  color: '#fbbf24' },
  ],
  hourlyConsumption: hours24(70, 30),
  monthlyConsumption: months12('kwh', 48000, 8000),
  alerts: [
    { id: 1, building: 'CSE Block',   msg: 'Usage 22% above average',       level: 'warning' },
    { id: 2, building: 'Canteen',     msg: 'Peak load at 14:00 — 48 kW',   level: 'critical' },
    { id: 3, building: 'Library',     msg: 'AC running after hours',        level: 'info'     },
  ],
  aiForecastTomorrow: 1920,
  aiForecastWeek: [1842, 1920, 1755, 1900, 2010, 1400, 1100],
};

// ══════════════════════════════════════════════════════════════════════════════
// 12. Water Management
// ══════════════════════════════════════════════════════════════════════════════
export const water = {
  totalTodayLitres: 28450,
  tanks: [
    { id: 'T1', label: 'Main Overhead Tank',   capacity: 50000, current: 38000, color: '#38BDF8' },
    { id: 'T2', label: 'South Wing Tank',       capacity: 20000, current: 14500, color: '#7B61FF' },
    { id: 'T3', label: 'Canteen Reserve Tank',  capacity: 10000, current: 4200,  color: '#F59E0B' },
  ],
  leaks: [
    { id: 'L1', location: 'CSE Block Ground Floor Washroom', detected: '06:32', severity: 'medium', status: 'under review'  },
    { id: 'L2', location: 'Canteen Pipeline Junction',       detected: '05:10', severity: 'low',    status: 'resolved'       },
  ],
  hourlyUsage: hours24(900, 500),
  weeklyUsage: days7('litres', 26000, 4000),
  monthlyUsage: months12('litres', 820000, 80000),
  buildingUsage: [
    { building: 'Hostel / Common Areas', litres: 9800 },
    { building: 'Canteen',               litres: 6500 },
    { building: 'Labs',                  litres: 4200 },
    { building: 'Washrooms',             litres: 5200 },
    { building: 'Gardens',               litres: 2750 },
  ],
  aiPrediction: { tomorrow: 29100, nextWeek: 196000, status: 'Normal consumption expected.' },
};

// ══════════════════════════════════════════════════════════════════════════════
// 13. Environmental Monitoring
// ══════════════════════════════════════════════════════════════════════════════
export const environment = {
  current: {
    temperature: 27.4,   // °C
    humidity: 68,        // %
    aqi: 72,             // AQI (Good < 100)
    co2: 480,            // ppm
    noise: 54,           // dB
    rainfall: 0,         // mm today
    windSpeed: 12,       // km/h
    windDir: 'SW',
    uvIndex: 6,
  },
  aqiCategory: 'Moderate',
  sensors: [
    { id: 's1', location: 'Main Gate',         temp: 28.1, humidity: 65, aqi: 80, noise: 62 },
    { id: 's2', location: 'CSE Block Roof',    temp: 27.4, humidity: 68, aqi: 72, noise: 50 },
    { id: 's3', location: 'Canteen Area',      temp: 29.8, humidity: 72, aqi: 88, noise: 70 },
    { id: 's4', location: 'Ground / Field',    temp: 30.2, humidity: 60, aqi: 65, noise: 58 },
    { id: 's5', location: 'Library Entrance',  temp: 24.1, humidity: 55, aqi: 48, noise: 38 },
  ],
  hourlyTemp:     hours24(27, 4),
  hourlyHumidity: hours24(65, 12),
  hourlyAQI:      hours24(70, 15),
  hourlyNoise:    hours24(52, 18),
  forecast: [
    { day: 'Today',    icon: '⛅', high: 31, low: 23, rain: '10%' },
    { day: 'Tomorrow', icon: '🌧️', high: 28, low: 22, rain: '70%' },
    { day: 'Wed',      icon: '🌦️', high: 29, low: 21, rain: '40%' },
    { day: 'Thu',      icon: '☀️',  high: 33, low: 24, rain: '5%'  },
    { day: 'Fri',      icon: '☀️',  high: 34, low: 25, rain: '5%'  },
  ],
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
