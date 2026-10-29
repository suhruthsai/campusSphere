// navConfig.js — the menus each person sees, built from their role and what they hold (GET /auth/me/roles):
// students get their day, certificates and campus (Joining / Leaving only while they apply); faculty get their
// classes and approvals, plus the desks they hold (HOD, CoE, no-dues, Principal); the Admin Office gets its
// office desks; admins get Office, Management and System. Sample-data pages are not in any menu.
import {
  Archive, BarChart3, Building2, CalendarClock, CalendarDays, ChartNoAxesCombined, ClipboardCheck, DoorClosed,
  DoorOpen, FileCheck, FileText, Gauge, GraduationCap, Home, IndianRupee, Layers, ListChecks, Map, MapPinned,
  ScrollText, Settings, ShieldCheck, Timer, Users, BookOpen, Briefcase, LayoutGrid, Wrench, Megaphone, ClipboardList, Trophy,
  MessageSquareText, Award, FlaskConical, Microscope, Landmark, BadgeCheck,
} from 'lucide-react';

const NOTICES = { to: '/notices', label: 'Notices', icon: Megaphone };

const CAMPUS = {
  dropdown: true, label: 'Campus', icon: Map,
  items: [
    { to: '/',           label: '3D campus & Mitra', icon: Home,      color: '#00E5FF' },
    { to: '/navigation', label: 'Find a place',      icon: MapPinned, color: '#7B61FF' },
  ],
};

const DESKS = (roles) => [
  roles.clearance_officer && { to: '/leaving/desk',        label: 'No-dues desk',    icon: ListChecks,  color: '#10B981' },
  roles.coe               && { to: '/leaving/exam-cell',   label: 'Exam Cell',       icon: ScrollText,  color: '#EC4899' },
  roles.placement_officer && { to: '/placements/cell',     label: 'Placement Cell',    icon: Trophy,    color: '#FBBF24' },
  roles.management        && { to: '/reports/department',  label: 'Department report', icon: BarChart3, color: '#38BDF8' },
  roles.management && !roles.placement_officer && { to: '/placements/cell',     label: 'Placements',        icon: Trophy,    color: '#FBBF24' },
  roles.management        && { to: '/accreditation',       label: 'Accreditation',   icon: ShieldCheck, color: '#00FFB3' },
  (roles.management || roles.accreditation_team) && { to: '/accreditation/workspace', label: 'Accreditation workspace', icon: ClipboardCheck, color: '#A78BFA' },
  (roles.management || roles.accreditation_team) && { to: '/accreditation/readiness', label: 'Readiness & mock visit', icon: BadgeCheck, color: '#4ADE80' },
  (roles.management || roles.accreditation_team || roles.course_coordinator) && { to: '/accreditation/outcomes', label: 'Outcomes (OBE)', icon: Gauge, color: '#22D3EE' },
  (roles.management || roles.accreditation_team || roles.coe) && { to: '/accreditation/results', label: 'Results', icon: Award, color: '#34D399' },
  (roles.management || roles.accreditation_team) && { to: '/accreditation/faculty', label: 'Faculty & research', icon: Microscope, color: '#FB7185' },
  (roles.management || roles.accreditation_team) && { to: '/accreditation/institution', label: 'Institution records', icon: Landmark, color: '#FACC15' },
  (roles.management || roles.accreditation_team) && { to: '/feedback', label: 'Feedback & ATRs', icon: MessageSquareText, color: '#F472B6' },
  roles.management        && { to: '/accreditation/desks', label: 'Desk turnaround', icon: Timer,       color: '#F59E0B' },
].filter(Boolean);

function student(roles) {
  return [
    { to: '/student',  label: 'My Day',       icon: GraduationCap },
    { to: '/attendance', label: 'Attendance', icon: ClipboardList },
    NOTICES,
    { to: '/services', label: 'Certificates', icon: FileText },
    { to: '/feedback', label: 'Feedback', icon: MessageSquareText },
    roles.placements_open && { to: '/placements', label: 'Placements', icon: Trophy },
    CAMPUS,
    roles.joining_open && { to: '/joining', label: 'Joining', icon: DoorOpen },
    roles.leaving_open && { to: '/leaving', label: 'Leaving', icon: DoorClosed },
  ].filter(Boolean);
}

function faculty(roles) {
  const desks = DESKS(roles);
  return [
    { to: '/faculty', label: 'My Day', icon: GraduationCap },
    { to: '/attendance', label: 'Attendance', icon: ClipboardList },
    NOTICES,
    !(roles.management || roles.accreditation_team) && { to: '/feedback', label: 'Feedback', icon: MessageSquareText },
    { to: '/my-research', label: 'My research', icon: FlaskConical },
    roles.approver && { to: '/services/approvals', label: 'Approvals', icon: FileCheck },
    {
      dropdown: true, label: 'Timetable & Rooms', icon: CalendarClock,
      items: [
        { to: '/classrooms', label: 'Rooms now',    icon: LayoutGrid, color: '#00E5FF' },
        { to: '/navigation', label: 'Find a place', icon: MapPinned,  color: '#7B61FF' },
        { to: '/',           label: '3D campus',    icon: Home,       color: '#10B981' },
      ],
    },
    roles.hod && {
      dropdown: true, label: 'Department', icon: BarChart3,
      items: [
        { to: '/reports/department',  label: 'Department report', icon: BarChart3,         color: '#38BDF8' },
        { to: '/accreditation/outcomes', label: 'Outcomes (OBE)', icon: Gauge,           color: '#22D3EE' },
        { to: '/accreditation/faculty', label: 'Faculty & research', icon: Microscope,   color: '#FB7185' },
        { to: '/placements/cell',     label: 'Placements',        icon: Trophy,            color: '#FBBF24' },
        { to: '/admin/substitutions', label: 'Substitutions',   icon: CalendarDays,        color: '#F472B6' },
        { to: '/analytics',      label: 'Department analytics', icon: ChartNoAxesCombined, color: '#00E5FF' },
        { to: '/ai/utilization', label: 'Room utilisation',     icon: Gauge,               color: '#00FFB3' },
      ],
    },
    desks.length > 0 && { dropdown: true, label: 'My desks', icon: Briefcase, items: desks },
  ].filter(Boolean);
}

function staff(roles) {
  return [
    {
      dropdown: true, label: 'Office', icon: Briefcase,
      items: [
        { to: '/services/approvals', label: 'Approvals',          icon: FileCheck,      color: '#00FFB3' },
        { to: '/joining/desk',       label: 'Admissions desk',    icon: ClipboardCheck, color: '#00E5FF' },
        { to: '/joining/originals',  label: 'Originals register', icon: Archive,        color: '#818CF8' },
        { to: '/services/roll-list', label: 'Roll list',          icon: Users,          color: '#38BDF8' },
        roles.clearance_officer && { to: '/leaving/desk', label: 'No-dues desk', icon: ListChecks, color: '#10B981' },
      ].filter(Boolean),
    },
    NOTICES,
    CAMPUS,
  ];
}

function admin() {
  return [
    {
      dropdown: true, label: 'Office', icon: Briefcase,
      items: [
        { to: '/services/approvals', label: 'Approvals',          icon: FileCheck,      color: '#00FFB3' },
        { to: '/joining/desk',       label: 'Admissions desk',    icon: ClipboardCheck, color: '#00E5FF' },
        { to: '/joining/originals',  label: 'Originals register', icon: Archive,        color: '#818CF8' },
        { to: '/services/roll-list', label: 'Roll list',          icon: Users,          color: '#38BDF8' },
        { to: '/leaving/desk',       label: 'No-dues desk',       icon: ListChecks,     color: '#10B981' },
        { to: '/leaving/exam-cell',  label: 'Exam Cell',          icon: ScrollText,     color: '#EC4899' },
      ],
    },
    {
      dropdown: true, label: 'Management', icon: ChartNoAxesCombined,
      items: [
        { to: '/admin/dashboard',     label: 'Dashboard',        icon: ChartNoAxesCombined, color: '#00E5FF' },
        { to: '/reports/department',  label: 'Department report', icon: BarChart3,          color: '#38BDF8' },
        { to: '/placements/cell',     label: 'Placement Cell',    icon: Trophy,             color: '#FBBF24' },
        { to: '/accreditation',       label: 'Accreditation',    icon: ShieldCheck,         color: '#00FFB3' },
        { to: '/accreditation/workspace', label: 'Accreditation workspace', icon: ClipboardCheck, color: '#A78BFA' },
        { to: '/accreditation/readiness', label: 'Readiness & mock visit', icon: BadgeCheck, color: '#4ADE80' },
        { to: '/accreditation/outcomes', label: 'Outcomes (OBE)', icon: Gauge, color: '#22D3EE' },
        { to: '/accreditation/results', label: 'Results', icon: Award, color: '#34D399' },
        { to: '/feedback', label: 'Feedback & ATRs', icon: MessageSquareText, color: '#F472B6' },
        { to: '/accreditation/faculty', label: 'Faculty & research', icon: Microscope, color: '#FB7185' },
        { to: '/accreditation/institution', label: 'Institution records', icon: Landmark, color: '#FACC15' },
        { to: '/accreditation/desks', label: 'Desk turnaround',  icon: Timer,               color: '#F59E0B' },
        { to: '/attendance',          label: 'Attendance',       icon: ClipboardList,       color: '#818CF8' },
        { to: '/analytics',           label: 'Analytics',        icon: BarChart3,           color: '#7B61FF' },
        { to: '/ai/utilization',      label: 'Room utilisation', icon: Gauge,               color: '#10B981' },
      ],
    },
    {
      dropdown: true, label: 'System', icon: Wrench,
      items: [
        { to: '/admin/users',         label: 'Users',                  icon: Users,         color: '#7B61FF' },
        { to: '/admin/timetable',     label: 'Timetable',              icon: CalendarClock, color: '#F59E0B' },
        { to: '/admin/substitutions', label: 'Substitutions',          icon: CalendarDays,  color: '#F472B6' },
        { to: '/services/setup',      label: 'Approvers & services',   icon: Settings,      color: '#F59E0B' },
        { to: '/joining/fees',        label: 'Fees',                   icon: IndianRupee,   color: '#F472B6' },
        { to: '/admin/buildings',     label: 'Buildings',              icon: Building2,     color: '#10B981' },
        { to: '/classrooms',          label: 'Rooms',                  icon: Layers,        color: '#00E5FF' },
        { to: '/admin/knowledge',     label: "Mitra's knowledge",      icon: BookOpen,      color: '#00FFB3' },
      ],
    },
    NOTICES,
    CAMPUS,
  ];
}

/** roles: the /auth/me/roles answer (null while it loads: only the safe, always-present items show). */
export function getNavItems(role, roles) {
  const r = roles || {};
  if (role === 'admin') return admin();
  if (role === 'faculty') return faculty(r);
  if (role === 'student') return student(r);
  if (role === 'staff') return staff(r);
  return [NOTICES, CAMPUS];
}

/** Where each role lands (used for old links to pages that are no longer in the menus). */
export const HOME_FOR = { student: '/student', faculty: '/faculty', staff: '/joining/desk', admin: '/admin/dashboard' };

