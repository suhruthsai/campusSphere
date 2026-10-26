// Small campus helpers shared by the timetable, room and navigation pages.

/** Building ids (as in the 3D twin and the database) → display names. */
export const BUILDING_NAMES = {
  civilit: 'Civil & IT Block', cse: 'CSE Block', ece: 'ECE Block', mecheee: 'Mech & EEE Block', sh: 'S&H Block',
  exam: 'Examination Department', lib: 'Library', placement: 'Placement Cell', rnd: 'R&D Block', cad: 'CAD Lab',
};

/** Weekday abbreviations, Monday first (timetable day_of_week 0 = Monday). */
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** 0 → "Ground floor", 2 → "Floor 2" (lowercase for use inside a sentence). */
export const floorName = (f, lower = false) => {
  const name = f === 0 ? 'Ground floor' : `Floor ${f}`;
  return lower ? name.toLowerCase() : name;
};

/** A plain YYYY-MM-DD date as "26 Oct 2026" (no time zone involved). */
export const fmtDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
