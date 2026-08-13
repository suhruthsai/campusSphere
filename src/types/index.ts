// CampusSphere — Complete TypeScript Type Definitions

export type UserRole = 'admin' | 'faculty' | 'student' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  rollNo?: string;
  staffId?: string;
  status: 'active' | 'inactive';
  joinedAt: string;
  lastActive: string;
  avatar: string;
}

export interface ActivityLog {
  id: number;
  userId: string;
  action: string;
  resource: string;
  timestamp: string;
  ip: string;
}

export interface Building {
  id: string;
  name: string;
  type: string;
  x: number;
  z: number;
  height: number;
  floors: number;
  color: string;
  occupancy: number;
  energy: string;
  departments: string[];
  capacity?: number;
  health?: 'Good' | 'Warning' | 'Critical';
  equipment?: { name: string; count: number }[];
}

export interface Room {
  id: string;
  name: string;
  type: string;
  capacity: number;
  occupied: boolean;
  department: string;
}

export interface Floor {
  building: string;
  floor: number;
  totalRooms: number;
  occupiedRooms: number;
  rooms: Room[];
}

export interface Classroom {
  id: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  equipment: string[];
  occupancy: number;
  status: 'available' | 'occupied' | 'maintenance';
  type: string;
}

export interface Booking {
  id: string;
  classroomId: string;
  day: string;
  slot: string;
  bookedBy: string;
  course: string;
}

export interface LabEquipment {
  id: string;
  name: string;
  count: number;
  status: 'operational' | 'maintenance' | 'faulty';
}

export interface LabReservation {
  id: string;
  bookedBy: string;
  date: string;
  slot: string;
  purpose: string;
}

export interface LabMaintenanceLog {
  id: string;
  date: string;
  task: string;
  technician: string;
  status: 'completed' | 'scheduled' | 'in-progress';
}

export interface Lab {
  id: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  occupancy: number;
  status: 'available' | 'occupied' | 'maintenance' | 'closed';
  color: string;
  equipment: LabEquipment[];
  reservations: LabReservation[];
  maintenanceLogs: LabMaintenanceLog[];
}

export interface ParkingZone {
  id: string;
  label: string;
  total: number;
  occupied: number;
  color: string;
}

export interface EnergyBuildingUsage {
  building: string;
  kwh: number;
  color: string;
}

export interface WaterTank {
  id: string;
  label: string;
  capacity: number;
  current: number;
  color: string;
}

export interface EnvironmentalSensor {
  id: string;
  location: string;
  temp: number;
  humidity: number;
  aqi: number;
  noise: number;
}

export interface CrowdZone {
  id: string;
  name: string;
  count: number;
  capacity: number;
  density: 'High' | 'Medium' | 'Low';
  color: string;
}
