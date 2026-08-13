// ── Mock lab data for Suhruth University ─────────────────────────────────────

export const labs = [
  {
    id: 'lab001',
    name: 'AI Research Lab',
    building: 'CSE Block',
    floor: 2,
    capacity: 30,
    occupancy: 24,
    status: 'occupied',
    color: '#7B61FF',
    equipment: [
      { id: 'eq1', name: 'GPU Workstations (RTX 4090)', count: 15, status: 'operational' },
      { id: 'eq2', name: 'NVIDIA DGX Server',            count: 1,  status: 'operational' },
      { id: 'eq3', name: 'Network Switch (10GbE)',        count: 2,  status: 'operational' },
      { id: 'eq4', name: '4K Monitors',                  count: 30, status: 'operational' },
    ],
    reservations: [
      { id: 'r1', bookedBy: 'Aarav Singh',     date: '2026-07-31', slot: '09:00–11:00', purpose: 'Deep Learning Project'   },
      { id: 'r2', bookedBy: 'Priya Nair',      date: '2026-07-31', slot: '14:00–16:00', purpose: 'NLP Research'            },
      { id: 'r3', bookedBy: 'Divya Menon',     date: '2026-08-01', slot: '09:00–11:00', purpose: 'Computer Vision Lab'     },
    ],
    maintenanceLogs: [
      { id: 'm1', date: '2026-07-15', task: 'GPU driver update',         technician: 'Mr. Biju Thomas', status: 'completed' },
      { id: 'm2', date: '2026-07-01', task: 'Network reconfiguration',   technician: 'Mr. Biju Thomas', status: 'completed' },
    ],
  },
  {
    id: 'lab002',
    name: 'Coding Lab',
    building: 'CSE Block',
    floor: 1,
    capacity: 40,
    occupancy: 18,
    status: 'occupied',
    color: '#00E5FF',
    equipment: [
      { id: 'eq1', name: 'Desktop PCs (i7 12th Gen)', count: 40, status: 'operational' },
      { id: 'eq2', name: 'Laser Printers',            count: 2,  status: 'operational' },
      { id: 'eq3', name: 'UPS Systems',               count: 4,  status: 'maintenance' },
    ],
    reservations: [
      { id: 'r1', bookedBy: 'Karan Joshi',     date: '2026-07-31', slot: '11:00–13:00', purpose: 'Web Dev Practice'       },
    ],
    maintenanceLogs: [
      { id: 'm1', date: '2026-07-20', task: 'OS reinstallation (5 PCs)', technician: 'Mr. Biju Thomas', status: 'completed' },
      { id: 'm2', date: '2026-08-01', task: 'UPS battery replacement',   technician: 'Mr. Biju Thomas', status: 'scheduled' },
    ],
  },
  {
    id: 'lab003',
    name: 'VLSI Lab',
    building: 'ECE Block',
    floor: 2,
    capacity: 25,
    occupancy: 0,
    status: 'available',
    color: '#00FFB3',
    equipment: [
      { id: 'eq1', name: 'FPGA Boards (Xilinx)',    count: 25, status: 'operational' },
      { id: 'eq2', name: 'Oscilloscopes',            count: 12, status: 'operational' },
      { id: 'eq3', name: 'Signal Generators',        count: 8,  status: 'operational' },
      { id: 'eq4', name: 'Logic Analysers',          count: 6,  status: 'operational' },
    ],
    reservations: [
      { id: 'r1', bookedBy: 'Ananya Krishnan', date: '2026-07-31', slot: '16:00–18:00', purpose: 'VLSI Design Project'   },
    ],
    maintenanceLogs: [
      { id: 'm1', date: '2026-06-28', task: 'Calibration of oscilloscopes', technician: 'Mr. Biju Thomas', status: 'completed' },
    ],
  },
  {
    id: 'lab004',
    name: 'Communication Lab',
    building: 'ECE Block',
    floor: 1,
    capacity: 30,
    occupancy: 22,
    status: 'occupied',
    color: '#38BDF8',
    equipment: [
      { id: 'eq1', name: 'RF Signal Analysers',     count: 8,  status: 'operational' },
      { id: 'eq2', name: 'Spectrum Analysers',       count: 4,  status: 'operational' },
      { id: 'eq3', name: 'Antenna Test Rigs',        count: 3,  status: 'maintenance' },
    ],
    reservations: [
      { id: 'r1', bookedBy: 'Tanvi Bhatt',     date: '2026-07-31', slot: '09:00–11:00', purpose: 'RF Circuit Analysis'   },
    ],
    maintenanceLogs: [
      { id: 'm1', date: '2026-07-25', task: 'Antenna rig repair',        technician: 'Dr. Priya Sharma', status: 'in-progress' },
    ],
  },
  {
    id: 'lab005',
    name: 'Workshop',
    building: 'Mech & EEE Block',
    floor: 1,
    capacity: 35,
    occupancy: 30,
    status: 'occupied',
    color: '#F59E0B',
    equipment: [
      { id: 'eq1', name: 'CNC Lathe Machines',      count: 5,  status: 'operational' },
      { id: 'eq2', name: 'Milling Machines',         count: 4,  status: 'operational' },
      { id: 'eq3', name: '3D Printers',              count: 3,  status: 'operational' },
      { id: 'eq4', name: 'Welding Stations',         count: 8,  status: 'operational' },
      { id: 'eq5', name: 'Drilling Machines',        count: 6,  status: 'maintenance' },
    ],
    reservations: [
      { id: 'r1', bookedBy: 'Rohan Gupta',     date: '2026-07-31', slot: '14:00–16:00', purpose: 'CAD/CAM Lab'          },
    ],
    maintenanceLogs: [
      { id: 'm1', date: '2026-07-28', task: 'Drilling machine servicing', technician: 'Mr. Biju Thomas', status: 'scheduled' },
    ],
  },
  {
    id: 'lab006',
    name: 'CAD Design Studio',
    building: 'CAD Lab',
    floor: 1,
    capacity: 35,
    occupancy: 0,
    status: 'available',
    color: '#34D399',
    equipment: [
      { id: 'eq1', name: 'CAD Workstations',         count: 35, status: 'operational' },
      { id: 'eq2', name: 'Plotter (A0)',              count: 2,  status: 'operational' },
      { id: 'eq3', name: '3D Scanner',                count: 1,  status: 'operational' },
    ],
    reservations: [
      { id: 'r1', bookedBy: 'Ishita Desai',    date: '2026-08-01', slot: '09:00–11:00', purpose: 'Structural Design'     },
    ],
    maintenanceLogs: [],
  },
];

export const labStatuses = {
  available:   { label: 'Available',    color: '#00FFB3' },
  occupied:    { label: 'Occupied',     color: '#00E5FF' },
  maintenance: { label: 'Maintenance',  color: '#F59E0B' },
  closed:      { label: 'Closed',       color: '#ef4444' },
};
