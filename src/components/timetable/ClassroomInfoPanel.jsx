import { useState, useEffect, useCallback } from 'react';
import { classroomsApi } from '../../utils/api';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SUBJECT_COLORS = {
  'Internet of Things': '#06B6D4',
  'Network Security': '#8B5CF6',
  'Cyber Security': '#EF4444',
  'Block Chain Technology': '#F59E0B',
  'Agile Software Engineering': '#10B981',
  'Road Safety Engineering': '#F97316',
  'IoT Lab': '#0891B2',
  'CN & NS Lab': '#7C3AED',
  'Project Work-I': '#059669',
  'Summer Internship-II': '#DB2777',
  'Counselling': '#6B7280',
  'Data Structures using C': '#3B82F6',
  'Operating Systems': '#10B981',
  'Mathematical Foundation for IT': '#8B5CF6',
  'Digital Electronics and Logic Design': '#EC4899',
  'Software Engineering': '#F59E0B',
  'Data Mining': '#06B6D4',
  'Design and Analysis of Algorithms': '#3B82F6',
  'Artificial Intelligence': '#8B5CF6',
  'Automata Theory': '#10B981',
  'Big Data Analytics': '#EC4899',
};

const getColor = (name) => SUBJECT_COLORS[name] || '#6366F1';

const TIME_SLOTS = [
  { label: 'Current Time (Live)', value: '' },
  { label: 'Monday P1 (09:30)', value: '2026-08-10T09:30' },
  { label: 'Monday P2 (10:30)', value: '2026-08-10T10:30' },
  { label: 'Monday P3 (11:40)', value: '2026-08-10T11:40' },
  { label: 'Monday P4 (12:40)', value: '2026-08-10T12:40' },
  { label: 'Monday P5 (14:15)', value: '2026-08-10T14:15' },
  { label: 'Monday P6 (15:15)', value: '2026-08-10T15:15' },
  { label: 'Tuesday P1 (09:30)', value: '2026-08-11T09:30' },
  { label: 'Tuesday P3 (11:40)', value: '2026-08-11T11:40' },
  { label: 'Wednesday P1 (09:30)', value: '2026-08-12T09:30' },
  { label: 'Wednesday P5 (14:15)', value: '2026-08-12T14:15' },
  { label: 'Thursday P1 (09:30)', value: '2026-08-13T09:30' },
  { label: 'Friday P1 (09:30)', value: '2026-08-14T09:30' },
  { label: 'Saturday P1 (09:30)', value: '2026-08-15T09:30' },
];

export default function ClassroomInfoPanel({ classroomId, simulatedDateTime: externalSimTime, onClose, onOpen3DView }) {
  const [data, setData]               = useState(null);
  const [week, setWeek]               = useState(null);
  const [roomDetails, setRoomDetails] = useState(null);
  const [tab, setTab]                 = useState('current');
  const [loading, setLoading]         = useState(true);
  const [err, setErr]                 = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(externalSimTime || '');

  const load = useCallback(async () => {
    if (!classroomId) return;
    setLoading(true); setErr(null);
    try {
      const activeTime = selectedSlot || externalSimTime;
      const [cur, wk, rm] = await Promise.all([
        classroomsApi.getCurrent(classroomId, activeTime),
        classroomsApi.getWeek(classroomId),
        classroomsApi.get(classroomId).catch(() => null),
      ]);
      setData(cur);
      setWeek(wk);
      setRoomDetails(rm);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [classroomId, selectedSlot, externalSimTime]);

  useEffect(() => { load(); }, [load]);

  if (!classroomId) return null;

  const locType = roomDetails?.location_type || 'CLASSROOM';
  const isNonTimetableLoc = ['OFFICE', 'ADMINISTRATION', 'STAFF_ROOM', 'DEPARTMENT_OFFICE'].includes(locType);

  const entry = data?.current_entry;
  const next  = data?.next_entry;
  const color = entry ? getColor(entry.subject_name) : '#4B5563';

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ ...styles.header, background: `linear-gradient(135deg, ${color}33, ${color}11)`, borderBottom: `2px solid ${color}55` }}>
          <div>
            <div style={styles.roomId}>{classroomId}</div>
            <div style={styles.roomName}>{data?.classroom_name || roomDetails?.name || classroomId}</div>
            <div style={styles.meta}>
              <span style={styles.chip}>🏢 Civil & IT Block</span>
              {data?.floor !== undefined && <span style={styles.chip}>🏗️ Floor {data.floor}</span>}
              
              {isNonTimetableLoc ? (
                <span style={{ ...styles.chip, background: '#374151', color: '#9CA3AF' }}>
                  🏛️ {roomDetails?.type || 'Office / Admin Space'}
                </span>
              ) : (
                <span style={{
                  ...styles.chip,
                  background: entry ? `${color}33` : '#10B98122',
                  color: entry ? color : '#10B981',
                  border: `1px solid ${entry ? color + '55' : '#10B98144'}`
                }}>
                  {entry ? '📅 Currently Scheduled' : '🟢 Free According to Timetable'}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onOpen3DView && (
              <button 
                type="button"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,229,255,0.25), rgba(2,132,199,0.35))',
                  border: '1.5px solid #00E5FF',
                  color: '#FFFFFF',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(0,229,255,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen3DView({ ...roomDetails, id: classroomId, name: data?.classroom_name || roomDetails?.name || classroomId, location_type: locType, floor: data?.floor ?? roomDetails?.floor }, selectedSlot);
                }}
              >
                🚀 3D View
              </button>
            )}
            <button style={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Time-Aware Slot Selector */}
        {!isNonTimetableLoc && (
          <div style={styles.timeSelectorBox}>
            <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 700 }}>⏱ SELECT TIME:</span>
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              style={styles.selectInput}
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot.label} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div style={styles.tabs}>
          {['current', 'physical', 'week'].map(t => (
            <button key={t} style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }} onClick={() => setTab(t)}>
              {t === 'current' ? '⏱ Schedule Status' : t === 'physical' ? '🏛️ Physical Info' : '📅 Daily Schedule'}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div style={styles.body}>
          {loading && <div style={styles.center}>Resolving Timetable from SQL Database…</div>}
          {err    && <div style={styles.errBox}>⚠ {err}</div>}

          {!loading && !err && tab === 'current' && (
            <div>
              {isNonTimetableLoc ? (
                <div style={styles.officeCard}>
                  <div style={{ fontSize: 36 }}>🏛️</div>
                  <div style={{ color: '#F3F4F6', fontSize: 15, fontWeight: 700, marginTop: 8 }}>
                    {roomDetails?.name || 'Administrative / Office Space'}
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                    This location is an administrative or staff office. It has no student teaching timetable assigned.
                  </div>
                </div>
              ) : entry ? (
                /* Scheduled Class Card */
                <div style={{ ...styles.card, borderLeft: `4px solid ${color}` }}>
                  <div style={styles.cardSectionHeader}>CURRENTLY SCHEDULED ACADEMIC CLASS</div>
                  <div style={styles.subjectBadge(color)}>{entry.subject_name}</div>
                  
                  {entry.subject_id && (
                    <div style={styles.row}>
                      <span style={styles.label}>Course Code</span>
                      <span style={styles.value}>{entry.subject_id}</span>
                    </div>
                  )}
                  <div style={styles.row}>
                    <span style={styles.label}>Faculty</span>
                    <span style={styles.value}>{entry.faculty_name}</span>
                  </div>
                  <div style={styles.row}>
                    <span style={styles.label}>Department / Branch</span>
                    <span style={styles.value}>{entry.department}</span>
                  </div>
                  <div style={styles.row}>
                    <span style={styles.label}>Section & Semester</span>
                    <span style={styles.value}>Section {entry.section} (Sem {entry.semester})</span>
                  </div>
                  <div style={styles.row}>
                    <span style={styles.label}>Academic Year</span>
                    <span style={styles.value}>{entry.academic_year || '2026-2027'}</span>
                  </div>
                  <div style={styles.row}>
                    <span style={styles.label}>Period & Time</span>
                    <span style={styles.value}>P{entry.period_number} · {entry.start_time} – {entry.end_time}</span>
                  </div>
                  <div style={styles.row}>
                    <span style={styles.label}>Day</span>
                    <span style={styles.value}>{DAY_NAMES[entry.day_of_week]}</span>
                  </div>
                  {entry.batch && (
                    <div style={styles.row}>
                      <span style={styles.label}>Lab Batch</span>
                      <span style={styles.value}>Batch {entry.batch}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Free according to timetable */
                <div style={styles.freeCard}>
                  <div style={{ fontSize: 40 }}>🏖️</div>
                  <div style={{ color: '#10B981', fontSize: 16, fontWeight: 700, marginTop: 8 }}>
                    Free According to Timetable
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>
                    No class scheduled for this classroom/lab during this period.
                  </div>
                </div>
              )}

              {/* Next class */}
              {!isNonTimetableLoc && next && (
                <div style={styles.nextSection}>
                  <div style={styles.nextLabel}>UPCOMING INFORMATION</div>
                  <div style={{ ...styles.card, ...styles.nextCard }}>
                    <div style={{ fontWeight: 700, color: '#E5E7EB', fontSize: 14 }}>{next.subject_name}</div>
                    <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>
                      {next.faculty_name} · Section {next.section}
                    </div>
                    <div style={{ color: '#818CF8', fontSize: 12, marginTop: 4 }}>
                      {DAY_NAMES[next.day_of_week]} · Period {next.period_number} ({next.start_time}–{next.end_time})
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !err && tab === 'physical' && (
            <div>
              <div style={styles.card}>
                <div style={styles.cardSectionHeader}>PHYSICAL LOCATION INFORMATION</div>
                <div style={styles.row}>
                  <span style={styles.label}>Building</span>
                  <span style={styles.value}>{data?.building || 'Civil & IT Block'}</span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Floor</span>
                  <span style={styles.value}>Floor {data?.floor !== undefined ? data.floor : roomDetails?.floor}</span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Room Number / ID</span>
                  <span style={styles.value}>{classroomId}</span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Location Type</span>
                  <span style={styles.value}>{locType}</span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Room Name</span>
                  <span style={styles.value}>{roomDetails?.name || data?.classroom_name || classroomId}</span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Seating Capacity</span>
                  <span style={styles.value}>{roomDetails?.capacity || 65} Seats</span>
                </div>
              </div>

              {onOpen3DView && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen3DView({ ...roomDetails, id: classroomId, name: data?.classroom_name || roomDetails?.name || classroomId, location_type: locType, floor: data?.floor ?? roomDetails?.floor }, selectedSlot);
                  }}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    padding: '12px 18px',
                    background: 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(30,58,138,0.4))',
                    border: '1.5px solid #00E5FF',
                    borderRadius: 12,
                    color: '#00E5FF',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxShadow: '0 4px 20px rgba(0,229,255,0.2)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ fontSize: 16 }}>🚀</span>
                  <span>Launch Interactive 3D Room Walkthrough</span>
                </button>
              )}
            </div>
          )}

          {!loading && !err && tab === 'week' && (
            <div>
              {isNonTimetableLoc ? (
                <div style={styles.officeCard}>
                  <div style={{ color: '#9CA3AF', fontSize: 13 }}>
                    Administrative spaces do not have weekly class schedules.
                  </div>
                </div>
              ) : week && week.schedule ? (
                DAY_NAMES.slice(0, 6).map(day => {
                  const dayEntries = week.schedule?.[day] || [];
                  return (
                    <div key={day} style={styles.dayBlock}>
                      <div style={styles.dayHeader}>{day}</div>
                      {dayEntries.length === 0 ? (
                        <div style={styles.noClass}>Free According to Timetable</div>
                      ) : (
                        dayEntries.map((e, idx) => {
                          const c = getColor(e.subject_name);
                          return (
                            <div key={idx} style={{ ...styles.periodRow, borderLeft: `3px solid ${c}` }}>
                              <div style={{ color: '#6B7280', fontSize: 11, width: 95, flexShrink: 0 }}>
                                P{e.period_number} ({e.start_time}–{e.end_time})
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ color: '#E5E7EB', fontSize: 13, fontWeight: 600 }}>{e.subject_name}</div>
                                <div style={{ color: '#9CA3AF', fontSize: 11 }}>
                                  {e.faculty_name} · Section {e.section}{e.batch ? ` (B${e.batch})` : ''}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={styles.noClass}>No weekly schedule data found in SQL database.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.refreshBtn} onClick={load}>↻ Query SQL Database</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'flex-end', backdropFilter:'blur(6px)' },
  panel:   { width:440, maxWidth:'95vw', height:'100vh', background:'#111827', display:'flex', flexDirection:'column', boxShadow:'-8px 0 40px rgba(0,0,0,0.7)' },
  header:  { padding:'20px 18px 14px', position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  roomId:  { color:'#818CF8', fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', fontFamily:'monospace' },
  roomName:{ color:'#F9FAFB', fontSize:18, fontWeight:800, marginTop:4 },
  meta:    { display:'flex', gap:6, flexWrap:'wrap', marginTop:10 },
  chip:    { background:'#1F2937', border:'1px solid #374151', borderRadius:20, padding:'3px 10px', fontSize:11, color:'#D1D5DB' },
  closeBtn:{ background:'transparent', border:'none', color:'#6B7280', fontSize:20, cursor:'pointer', padding:4, lineHeight:1 },
  timeSelectorBox: { padding:'10px 18px', background:'#1F2937', borderBottom:'1px solid #374151', display:'flex', alignItems:'center', justifyContent:'space-between' },
  selectInput: { background:'#111827', border:'1px solid #4B5563', color:'#F3F4F6', borderRadius:6, padding:'4px 8px', fontSize:12, fontWeight:600 },
  tabs:    { display:'flex', borderBottom:'1px solid #1F2937' },
  tab:     { flex:1, padding:'12px 0', background:'transparent', border:'none', color:'#6B7280', fontSize:12, cursor:'pointer', fontWeight:600 },
  tabActive:{ color:'#818CF8', borderBottom:'2px solid #6366F1', marginBottom:-1 },
  body:    { flex:1, overflowY:'auto', padding:'18px' },
  card:    { background:'#1F2937', borderRadius:14, padding:'16px', marginBottom:14 },
  officeCard: { background:'#1F2937', borderRadius:14, padding:'24px 18px', textAlign:'center', border:'1px solid #374151' },
  cardSectionHeader: { color:'#6B7280', fontSize:10, fontWeight:800, letterSpacing:1.5, marginBottom:10, textTransform:'uppercase' },
  subjectBadge: (c) => ({ background:`${c}22`, color:c, borderRadius:20, padding:'4px 12px', fontSize:13, fontWeight:700, display:'inline-block', marginBottom:12 }),
  row:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #374151' },
  label:   { color:'#9CA3AF', fontSize:12 },
  value:   { color:'#E5E7EB', fontSize:13, fontWeight:600, textAlign:'right' },
  freeCard:{ background:'#1F2937', borderRadius:14, padding:'24px 20px', textAlign:'center', marginBottom:14, border:'1px solid #10B98144' },
  nextSection: { marginTop:16 },
  nextLabel:   { color:'#6B7280', fontSize:10, letterSpacing:1.5, fontWeight:800, marginBottom:8 },
  nextCard:    { opacity:0.85, border:'1px solid #374151' },
  dayBlock:    { marginBottom:16 },
  dayHeader:   { color:'#818CF8', fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:8, textTransform:'uppercase' },
  noClass:     { color:'#4B5563', fontSize:12, padding:'6px 0', fontStyle:'italic' },
  periodRow:   { display:'flex', gap:10, alignItems:'flex-start', padding:'8px 12px', background:'#1F2937', borderRadius:8, marginBottom:6 },
  equipTag:    { background:'#0F172A', border:'1px solid #334155', borderRadius:8, padding:'4px 8px', fontSize:11, color:'#9CA3AF' },
  center:  { textAlign:'center', color:'#6B7280', padding:40 },
  errBox:  { background:'#7F1D1D22', border:'1px solid #7F1D1D', borderRadius:8, padding:14, color:'#FCA5A5', fontSize:13 },
  footer:  { padding:'12px 18px', borderTop:'1px solid #1F2937' },
  refreshBtn: { background:'#1F2937', border:'1px solid #374151', borderRadius:8, color:'#9CA3AF', cursor:'pointer', padding:'8px 16px', fontSize:12, width:'100%' },
};
