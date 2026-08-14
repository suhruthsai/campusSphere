import { useState, useEffect, useRef } from 'react';
import { timetableApi, classroomsApi, subjectsApi, facultyApi } from '../../utils/api';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PERIOD_TIMES = {
  1: ['09:30', '10:30'],
  2: ['10:30', '11:30'],
  3: ['11:40', '12:40'],
  4: ['12:40', '13:40'],
  5: ['14:15', '15:15'],
  6: ['15:15', '16:15']
};

const SECTIONS = [
  'IT-2A', 'IT-2B', 'IT-2C',
  'IT-3A', 'IT-3B', 'IT-3C',
  'IT-4A', 'IT-4B', 'IT-4C',
  'Civil-3', 'Civil-5', 'Civil-7'
];

const SUBJECT_COLORS = {
  'IOT': '#06B6D4', 'NS': '#8B5CF6', 'CS': '#EF4444', 'BCT': '#F59E0B',
  'ASE': '#10B981', 'RSE': '#F97316', 'DS': '#3B82F6', 'OS': '#10B981',
  'MFIT': '#8B5CF6', 'DELD': '#EC4899', 'EDS': '#06B6D4', 'F&A': '#F59E0B',
  'SE': '#F59E0B', 'DM': '#06B6D4', 'DAA': '#3B82F6', 'AI': '#8B5CF6',
  'AT': '#10B981', 'BDA': '#EC4899', 'TE': '#10B981', 'FE': '#F59E0B',
  'EH': '#06B6D4', 'SA-I': '#8B5CF6', 'EE': '#3B82F6', 'E&S': '#EF4444',
  'PSC': '#8B5CF6', 'CMA': '#F59E0B', 'DMM': '#EC4899', 'TLP': '#10B981',
  'SUR': '#06B6D4', 'CEM': '#F97316', 'EM': '#EF4444', 'FM': '#3B82F6',
  'EG': '#10B981', 'P&S': '#8B5CF6'
};

const getSubjectColor = (code) => SUBJECT_COLORS[code] || '#6366F1';

export default function TimetableManagement() {
  const [tab, setTab]                     = useState('grid');
  const [viewMode, setViewMode]           = useState('section'); // 'section' or 'classroom'
  const [entries, setEntries]             = useState([]);
  const [classrooms, setClassrooms]       = useState([]);
  const [subjects, setSubjects]           = useState([]);
  const [faculty, setFaculty]             = useState([]);
  const [conflicts, setConflicts]         = useState(null);
  const [loading, setLoading]             = useState(true);
  const [filterSection, setFilterSection] = useState('IT-2A');
  const [filterRoom, setFilterRoom]       = useState('CE-IT-101');
  const [csvFile, setCsvFile]             = useState(null);
  const [csvResult, setCsvResult]         = useState(null);
  const [csvLoading, setCsvLoading]       = useState(false);
  const [showAddModal, setShowAddModal]   = useState(false);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (viewMode === 'section' && filterSection) {
        params.section = filterSection;
      } else if (viewMode === 'classroom' && filterRoom) {
        params.classroom_id = filterRoom;
      }

      const [e, c, s, f] = await Promise.all([
        timetableApi.list(params),
        classroomsApi.list(),
        subjectsApi.list(),
        facultyApi.list(),
      ]);
      setEntries(e || []);
      setClassrooms(c || []);
      setSubjects(s || []);
      setFaculty(f || []);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadConflicts = async () => {
    try { setConflicts(await timetableApi.conflicts()); } catch(err) { console.error(err); }
  };

  useEffect(() => { load(); }, [viewMode, filterSection, filterRoom]);
  useEffect(() => { if (tab === 'conflicts') loadConflicts(); }, [tab]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    await timetableApi.delete(id);
    load();
  };

  const handleCsvUpload = async (dryRun) => {
    if (!csvFile) return;
    setCsvLoading(true); setCsvResult(null);
    try {
      const r = await timetableApi.importCsv(csvFile, dryRun);
      setCsvResult(r);
      if (!dryRun) load();
    } catch(err) {
      setCsvResult({ error: err.message });
    } finally {
      setCsvLoading(false);
    }
  };

  const grid = {};
  for (const day of DAY_NAMES) {
    grid[day] = {};
    for (let p = 1; p <= 6; p++) grid[day][p] = [];
  }
  entries.forEach(e => {
    const dayName = DAY_NAMES[e.day_of_week];
    if (dayName && grid[dayName]?.[e.period_number]) {
      grid[dayName][e.period_number].push(e);
    }
  });

  const tabs = [
    { id: 'grid',      label: '📅 Schedule Grid' },
    { id: 'entries',   label: '📋 All Entries' },
    { id: 'import',    label: '📤 CSV Import' },
    { id: 'conflicts', label: '⚠️ Conflicts' },
  ];

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.title}>Timetable Management & Mapping</h1>
          <p style={s.subtitle}>
            Civil & IT Block · 12 Academic Sections (IT-2A..4C & Civil Sem-3..7) · Full Week Monday–Saturday
          </p>
        </div>
        <div style={s.topActions}>
          <div style={s.toggleGroup}>
            <button
              style={{ ...s.toggleBtn, ...(viewMode === 'section' ? s.toggleActive : {}) }}
              onClick={() => setViewMode('section')}
            >
              By Section
            </button>
            <button
              style={{ ...s.toggleBtn, ...(viewMode === 'classroom' ? s.toggleActive : {}) }}
              onClick={() => setViewMode('classroom')}
            >
              By Classroom
            </button>
          </div>

          {viewMode === 'section' ? (
            <select style={s.select} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
              {SECTIONS.map(sec => (
                <option key={sec} value={sec}>Section: {sec}</option>
              ))}
              <option value="">All Sections</option>
            </select>
          ) : (
            <select style={s.select} value={filterRoom} onChange={e => setFilterRoom(e.target.value)}>
              {classrooms.map(rm => (
                <option key={rm.id} value={rm.id}>{rm.id} ({rm.name})</option>
              ))}
            </select>
          )}

          <button style={s.btnPrimary} onClick={() => setShowAddModal(true)}>+ Add Entry</button>
        </div>
      </div>

      <div style={s.tabRow}>
        {tabs.map(t => (
          <button
            key={t.id}
            style={{ ...s.tabBtn, ...(tab === t.id ? s.tabActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={s.center}>Loading timetable database…</div>}

      {!loading && tab === 'grid' && (
        <div style={s.gridWrap}>
          <div style={s.gridTable}>
            <div style={s.gridCell('header')}>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>PERIODS \ DAYS</span>
            </div>
            {DAY_NAMES.map(d => (
              <div key={d} style={s.gridCell('dayhead')}>
                <b>{d.toUpperCase()}</b>
              </div>
            ))}
            {[1, 2, 3, 4, 5, 6].map(p => (
              <div key={p} style={{ display: 'contents' }}>
                <div style={s.gridCell('periodlabel')}>
                  <div style={{ fontWeight: 800, color: '#00E5FF', fontSize: 13 }}>P{p}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{PERIOD_TIMES[p][0]} - {PERIOD_TIMES[p][1]}</div>
                </div>
                {DAY_NAMES.map(day => {
                  const cell = grid[day][p];
                  return (
                    <div key={`${day}-${p}`} style={s.gridCell('cell')}>
                      {cell.length === 0 ? (
                        <div style={s.freeSlot}>— Free —</div>
                      ) : (
                        cell.map(e => {
                          const col = getSubjectColor(e.subject_name.slice(0, 4));
                          return (
                            <div key={e.id} style={{ ...s.entryChip, background: `${col}18`, borderLeft: `3px solid ${col}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: col, fontWeight: 700, fontSize: 12 }}>{e.subject_name}</span>
                                {e.batch && <span style={s.batchBadge}>Batch {e.batch}</span>}
                              </div>
                              <div style={{ color: '#F1F5F9', fontSize: 11, marginTop: 3, fontWeight: 600 }}>
                                👩‍🏫 {e.faculty_name}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: 10, marginTop: 4 }}>
                                <span>🏛️ {e.classroom_id}</span>
                                <span>👥 {e.section}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && tab === 'entries' && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Day</th>
                <th style={s.th}>Period</th>
                <th style={s.th}>Time</th>
                <th style={s.th}>Section</th>
                <th style={s.th}>Room</th>
                <th style={s.th}>Subject</th>
                <th style={s.th}>Faculty</th>
                <th style={s.th}>Batch</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} style={s.tr}>
                  <td style={s.td}>{DAY_NAMES[e.day_of_week]}</td>
                  <td style={s.td}>P{e.period_number}</td>
                  <td style={s.td}>{e.start_time} - {e.end_time}</td>
                  <td style={s.td}><b>{e.section}</b></td>
                  <td style={s.td}><code style={s.code}>{e.classroom_id}</code></td>
                  <td style={s.td}>{e.subject_name}</td>
                  <td style={s.td}>{e.faculty_name}</td>
                  <td style={s.td}>{e.batch || 'Full Class'}</td>
                  <td style={s.td}>
                    <button style={s.btnDanger} onClick={() => handleDelete(e.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'conflicts' && (
        <div style={s.conflictsWrap}>
          <h2 style={{ fontSize: 18, color: '#fff', marginBottom: 12 }}>Timetable Room & Faculty Conflicts</h2>
          {conflicts?.total_conflicts === 0 ? (
            <div style={s.noConflict}>✅ 0 Conflicts Found. All classrooms, teachers, and student sections are 100% clash-free!</div>
          ) : (
            <div style={{ color: '#F87171' }}>Found {conflicts?.total_conflicts || 0} potential schedule overlaps.</div>
          )}
        </div>
      )}

    </div>
  );
}

const s = {
  page: { padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: 0 },
  subtitle: { fontSize: '13px', color: '#94A3B8', marginTop: '4px' },
  topActions: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
  toggleGroup: { display: 'flex', background: '#1E293B', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255,255,255,0.1)' },
  toggleBtn: { background: 'transparent', border: 'none', color: '#94A3B8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  toggleActive: { background: '#00E5FF', color: '#0F172A', fontWeight: 700 },
  select: { background: '#1E293B', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, outline: 'none' },
  btnPrimary: { background: 'linear-gradient(135deg, #00E5FF, #3B82F6)', border: 'none', color: '#0F172A', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' },
  tabRow: { display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '20px' },
  tabBtn: { background: 'transparent', border: 'none', color: '#94A3B8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  tabActive: { background: 'rgba(0, 229, 255, 0.15)', color: '#00E5FF', border: '1px solid rgba(0, 229, 255, 0.3)' },
  gridWrap: { overflowX: 'auto', background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' },
  gridTable: { display: 'grid', gridTemplateColumns: '130px repeat(6, minmax(180px, 1fr))', gap: '8px' },
  gridCell: (type) => ({
    background: type === 'header' || type === 'dayhead' ? '#1E293B' : type === 'periodlabel' ? '#141E33' : '#111827',
    padding: type === 'cell' ? '8px' : '12px 8px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    textAlign: type === 'dayhead' || type === 'periodlabel' ? 'center' : 'left',
    minHeight: type === 'cell' ? '90px' : 'auto',
  }),
  freeSlot: { color: '#475569', fontSize: '11px', textAlign: 'center', margin: 'auto 0' },
  entryChip: { borderRadius: '6px', padding: '6px 8px', marginBottom: '6px' },
  batchBadge: { fontSize: '9px', background: '#3B82F633', color: '#60A5FA', padding: '2px 5px', borderRadius: '4px', border: '1px solid #3B82F655' },
  tableWrap: { overflowX: 'auto', background: '#0F172A', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', padding: '12px 16px', background: '#1E293B', color: '#94A3B8', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.05)' },
  td: { padding: '12px 16px' },
  code: { background: '#1E293B', padding: '3px 6px', borderRadius: '4px', color: '#38BDF8', fontSize: '12px' },
  btnDanger: { background: '#EF444422', border: '1px solid #EF444455', color: '#F87171', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' },
  conflictsWrap: { background: '#0F172A', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' },
  noConflict: { background: '#10B98118', border: '1px solid #10B98144', color: '#34D399', padding: '16px', borderRadius: '8px', fontWeight: 600 },
  center: { textAlign: 'center', padding: '48px', color: '#94A3B8' }
};
