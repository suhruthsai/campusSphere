// ── Mock users for Suhruth University ────────────────────────────────────────
// Passwords are stored in plaintext for demo only (never do this in production)

export const DEMO_CREDENTIALS = [
  { email: 'admin@suhruth.edu',   password: 'admin123',   role: 'admin'   },
  { email: 'faculty@suhruth.edu', password: 'faculty123', role: 'faculty' },
  { email: 'student@suhruth.edu', password: 'student123', role: 'student' },
];

export const users = [
  // ── Admins ────────────────────────────────────────────────────────────────
  { id: 'u001', name: 'Dr. Suhruth Reddy',    email: 'admin@suhruth.edu',        role: 'admin',   department: 'Administration', staffId: 'ADM001', status: 'active',   joinedAt: '2018-06-01', lastActive: '2026-07-31', avatar: 'SR' },
  { id: 'u002', name: 'Mrs. Kavitha Nair',    email: 'kavitha@suhruth.edu',      role: 'admin',   department: 'Administration', staffId: 'ADM002', status: 'active',   joinedAt: '2019-07-15', lastActive: '2026-07-30', avatar: 'KN' },

  // ── Faculty ───────────────────────────────────────────────────────────────
  { id: 'u003', name: 'Prof. Ramesh Kumar',   email: 'faculty@suhruth.edu',      role: 'faculty', department: 'CSE',  staffId: 'FAC001', status: 'active',   joinedAt: '2019-08-01', lastActive: '2026-07-31', avatar: 'RK' },
  { id: 'u004', name: 'Dr. Priya Sharma',     email: 'priya@suhruth.edu',        role: 'faculty', department: 'ECE',  staffId: 'FAC002', status: 'active',   joinedAt: '2020-01-15', lastActive: '2026-07-30', avatar: 'PS' },
  { id: 'u005', name: 'Mr. Arun Mehta',       email: 'arun@suhruth.edu',         role: 'faculty', department: 'Mech', staffId: 'FAC003', status: 'active',   joinedAt: '2020-06-10', lastActive: '2026-07-29', avatar: 'AM' },
  { id: 'u006', name: 'Dr. Sunita Patel',     email: 'sunita@suhruth.edu',       role: 'faculty', department: 'Civil',staffId: 'FAC004', status: 'active',   joinedAt: '2021-01-20', lastActive: '2026-07-31', avatar: 'SP' },
  { id: 'u007', name: 'Prof. Vijay Anand',    email: 'vijay@suhruth.edu',        role: 'faculty', department: 'EEE',  staffId: 'FAC005', status: 'active',   joinedAt: '2021-06-01', lastActive: '2026-07-28', avatar: 'VA' },
  { id: 'u008', name: 'Dr. Meena Iyer',       email: 'meena@suhruth.edu',        role: 'faculty', department: 'S&H',  staffId: 'FAC006', status: 'inactive', joinedAt: '2020-08-15', lastActive: '2026-06-30', avatar: 'MI' },
  { id: 'u009', name: 'Mr. Karthik Balan',    email: 'karthik@suhruth.edu',      role: 'faculty', department: 'IT',   staffId: 'FAC007', status: 'active',   joinedAt: '2022-01-05', lastActive: '2026-07-31', avatar: 'KB' },
  { id: 'u010', name: 'Dr. Lakshmi Venkat',   email: 'lakshmi@suhruth.edu',      role: 'faculty', department: 'CSE',  staffId: 'FAC008', status: 'active',   joinedAt: '2019-12-01', lastActive: '2026-07-30', avatar: 'LV' },

  // ── Students ──────────────────────────────────────────────────────────────
  { id: 'u011', name: 'Aarav Singh',          email: 'student@suhruth.edu',      role: 'student', department: 'CSE',  rollNo: 'SU22CS001', status: 'active',   joinedAt: '2022-08-01', lastActive: '2026-07-31', avatar: 'AS' },
  { id: 'u012', name: 'Ananya Krishnan',      email: 'ananya@suhruth.edu',       role: 'student', department: 'ECE',  rollNo: 'SU22EC012', status: 'active',   joinedAt: '2022-08-01', lastActive: '2026-07-30', avatar: 'AK' },
  { id: 'u013', name: 'Rohan Gupta',          email: 'rohan@suhruth.edu',        role: 'student', department: 'Mech', rollNo: 'SU22ME034', status: 'active',   joinedAt: '2022-08-01', lastActive: '2026-07-29', avatar: 'RG' },
  { id: 'u014', name: 'Ishita Desai',         email: 'ishita@suhruth.edu',       role: 'student', department: 'Civil',rollNo: 'SU22CV056', status: 'active',   joinedAt: '2022-08-01', lastActive: '2026-07-28', avatar: 'ID' },
  { id: 'u015', name: 'Karan Joshi',          email: 'karan@suhruth.edu',        role: 'student', department: 'IT',   rollNo: 'SU22IT078', status: 'active',   joinedAt: '2022-08-01', lastActive: '2026-07-31', avatar: 'KJ' },
  { id: 'u016', name: 'Priya Nair',           email: 'pnair@suhruth.edu',        role: 'student', department: 'CSE',  rollNo: 'SU23CS015', status: 'active',   joinedAt: '2023-08-01', lastActive: '2026-07-30', avatar: 'PN' },
  { id: 'u017', name: 'Arjun Pillai',         email: 'arjun@suhruth.edu',        role: 'student', department: 'EEE',  rollNo: 'SU23EE023', status: 'active',   joinedAt: '2023-08-01', lastActive: '2026-07-31', avatar: 'AP' },
  { id: 'u018', name: 'Divya Menon',          email: 'divya@suhruth.edu',        role: 'student', department: 'CSE',  rollNo: 'SU24CS002', status: 'active',   joinedAt: '2024-08-01', lastActive: '2026-07-25', avatar: 'DM' },
  { id: 'u019', name: 'Siddharth Rao',        email: 'sid@suhruth.edu',          role: 'student', department: 'Mech', rollNo: 'SU24ME011', status: 'inactive', joinedAt: '2024-08-01', lastActive: '2026-05-10', avatar: 'SR' },
  { id: 'u020', name: 'Tanvi Bhatt',          email: 'tanvi@suhruth.edu',        role: 'student', department: 'ECE',  rollNo: 'SU24EC041', status: 'active',   joinedAt: '2024-08-01', lastActive: '2026-07-30', avatar: 'TB' },

  // ── Staff ─────────────────────────────────────────────────────────────────
  { id: 'u021', name: 'Mr. Rajan Pillai',     email: 'rajan@suhruth.edu',        role: 'staff',   department: 'Library',    staffId: 'STF001', status: 'active',   joinedAt: '2020-03-01', lastActive: '2026-07-31', avatar: 'RP' },
  { id: 'u022', name: 'Ms. Geetha Varma',     email: 'geetha@suhruth.edu',       role: 'staff',   department: 'Canteen',    staffId: 'STF002', status: 'active',   joinedAt: '2021-05-15', lastActive: '2026-07-31', avatar: 'GV' },
  { id: 'u023', name: 'Mr. Biju Thomas',      email: 'biju@suhruth.edu',         role: 'staff',   department: 'Maintenance', staffId: 'STF003', status: 'active',   joinedAt: '2019-11-01', lastActive: '2026-07-30', avatar: 'BT' },
  { id: 'u024', name: 'Mrs. Saroja Kumari',   email: 'saroja@suhruth.edu',       role: 'staff',   department: 'Administration', staffId: 'STF004', status: 'inactive', joinedAt: '2020-02-14', lastActive: '2026-04-20', avatar: 'SK' },
];

export const activityLogs = [
  { id: 1, userId: 'u011', action: 'Logged in',              resource: 'System',           timestamp: '2026-07-31T07:00:12', ip: '192.168.1.42' },
  { id: 2, userId: 'u003', action: 'Updated timetable',      resource: 'Classroom CSE-101', timestamp: '2026-07-31T06:55:30', ip: '192.168.1.18' },
  { id: 3, userId: 'u001', action: 'Added new user',         resource: 'User u020',        timestamp: '2026-07-31T06:48:10', ip: '10.0.0.5'    },
  { id: 4, userId: 'u015', action: 'Booked lab session',     resource: 'CSE AI Lab',       timestamp: '2026-07-31T06:30:00', ip: '192.168.2.11' },
  { id: 5, userId: 'u004', action: 'Marked attendance',      resource: 'ECE-B Batch',      timestamp: '2026-07-31T06:15:22', ip: '192.168.1.55' },
  { id: 6, userId: 'u012', action: 'Submitted assignment',   resource: 'DSP Module',       timestamp: '2026-07-30T23:58:04', ip: '10.0.1.99'   },
  { id: 7, userId: 'u002', action: 'Generated report',       resource: 'Monthly Analytics', timestamp: '2026-07-30T22:40:50', ip: '10.0.0.5'    },
  { id: 8, userId: 'u017', action: 'Checked timetable',      resource: 'EEE Schedule',     timestamp: '2026-07-30T21:05:18', ip: '192.168.3.22' },
];
