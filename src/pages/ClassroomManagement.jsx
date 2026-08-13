import { useState, useEffect } from 'react';
import { classroomsApi } from '../utils/api';
import ClassroomInfoPanel from '../components/timetable/ClassroomInfoPanel';
import TimeMachineBar from '../components/timetable/TimeMachineBar';

const STATUS_COLORS = { occupied:'#EF4444', available:'#10B981', maintenance:'#F59E0B' };
const TYPE_ICONS    = { 'Lecture Hall':'🏫', 'Lab':'🔬', 'Seminar Hall':'🎙️', 'Conference Room':'💼' };

export default function ClassroomManagement() {
  const [classrooms, setClassrooms]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterFloor, setFilterFloor]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedId, setSelectedId]     = useState(null);
  const [simulatedDateTime, setSimulatedDateTime] = useState(null);
  const [view, setView]                 = useState('grid');

  useEffect(() => {
    classroomsApi.list().then(d => { setClassrooms(d || []); setLoading(false); })
                        .catch(() => setLoading(false));
  }, []);

  const floors = [...new Set(classrooms.map(c => c.floor))].sort();
  const filtered = classrooms.filter(c =>
    (search === '' || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase())) &&
    (filterFloor === '' || c.floor === parseInt(filterFloor)) &&
    (filterStatus === '' || c.status === filterStatus)
  );

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Classroom Mapping</h1>
          <p style={s.sub}>Civil & IT Block · MVSR Engineering College · Click any room to see live schedule</p>
        </div>
        <div style={s.headerRight}>
          <div style={s.stats}>
            <StatPill color="#10B981" label="Available" count={classrooms.filter(c=>c.status==='available').length} />
            <StatPill color="#EF4444" label="Occupied"  count={classrooms.filter(c=>c.status==='occupied').length} />
            <StatPill color="#F59E0B" label="Total"     count={classrooms.length} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 32px' }}>
        <TimeMachineBar onTimeChange={(dt) => setSimulatedDateTime(dt)} />
      </div>

      {/* Filters */}
      <div style={s.filterRow}>
        <input style={s.searchBox} placeholder="🔍  Search room…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={s.sel} value={filterFloor} onChange={e=>setFilterFloor(e.target.value)}>
          <option value="">All Floors</option>
          {floors.map(f => <option key={f} value={f}>Floor {f}</option>)}
        </select>
        <select style={s.sel} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <div style={s.viewToggle}>
          <button style={{...s.viewBtn, ...(view==='grid'?s.viewBtnActive:{})}} onClick={()=>setView('grid')}>⊞</button>
          <button style={{...s.viewBtn, ...(view==='list'?s.viewBtnActive:{})}} onClick={()=>setView('list')}>≡</button>
        </div>
      </div>

      {loading && <div style={s.center}>Loading classrooms…</div>}

      {!loading && filtered.length === 0 && (
        <div style={s.center}>
          <div style={{fontSize:40}}>🏫</div>
          <div style={{color:'#6B7280',marginTop:8}}>No classrooms found</div>
        </div>
      )}

      {/* Grid View */}
      {!loading && view === 'grid' && (
        <div style={s.grid}>
          {filtered.map(c => (
            <ClassroomCard key={c.id} room={c} onClick={() => setSelectedId(c.id)} />
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && view === 'list' && (
        <div style={s.listWrap}>
          <table style={s.table}>
            <thead>
              <tr>{['Room ID','Name','Floor','Type','Capacity','Status','Action'].map(h =>
                <th key={h} style={s.th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const statusColor = STATUS_COLORS[c.status] || '#6B7280';
                return (
                  <tr key={c.id} style={s.tr} onClick={() => setSelectedId(c.id)}>
                    <td style={s.td}><code style={{color:'#818CF8',fontFamily:'monospace'}}>{c.id}</code></td>
                    <td style={s.td}>{c.name}</td>
                    <td style={s.td}>Floor {c.floor}</td>
                    <td style={s.td}>{TYPE_ICONS[c.type]||'🏛️'} {c.type}</td>
                    <td style={s.td}>{c.capacity}</td>
                    <td style={s.td}><span style={{...s.badge, background:`${statusColor}22`, color:statusColor}}>{c.status}</span></td>
                    <td style={s.td}><button style={s.viewBtn2}>View Schedule</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Classroom Detail Panel */}
      {selectedId && (
        <ClassroomInfoPanel
          classroomId={selectedId}
          simulatedDateTime={simulatedDateTime}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function ClassroomCard({ room, onClick }) {
  const [hovered, setHovered] = useState(false);
  const statusColor = STATUS_COLORS[room.status] || '#6B7280';
  const icon        = TYPE_ICONS[room.type] || '🏛️';

  return (
    <div
      style={{ ...s.card, transform: hovered?'translateY(-4px)':'none', boxShadow: hovered?'0 12px 40px rgba(99,102,241,0.2)':'none' }}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      onClick={onClick}
    >
      <div style={s.cardTop}>
        <div style={s.cardIcon}>{icon}</div>
        <div style={{...s.statusDot, background:statusColor, boxShadow:`0 0 8px ${statusColor}`}} />
      </div>
      <div style={s.cardId}>{room.id}</div>
      <div style={s.cardName}>{room.name}</div>
      <div style={s.cardMeta}>
        <span style={s.metaPill}>🏗️ Floor {room.floor}</span>
        <span style={s.metaPill}>👥 {room.capacity}</span>
      </div>
      <div style={{...s.cardStatus, background:`${statusColor}22`, color:statusColor, border:`1px solid ${statusColor}44`}}>
        {room.status}
      </div>
      <div style={s.cardHint}>Click to see live schedule →</div>
    </div>
  );
}

function StatPill({ color, label, count }) {
  return (
    <div style={{ background:`${color}22`, border:`1px solid ${color}44`, borderRadius:20, padding:'6px 14px', display:'flex', gap:8, alignItems:'center' }}>
      <span style={{ color, fontWeight:700, fontSize:20 }}>{count}</span>
      <span style={{ color:'#9CA3AF', fontSize:12 }}>{label}</span>
    </div>
  );
}

const s = {
  page:       { background:'#0F172A', minHeight:'100vh', color:'#E5E7EB', fontFamily:"'Inter',sans-serif", padding:'0 0 40px' },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'28px 32px 0', flexWrap:'wrap', gap:16 },
  title:      { color:'#F9FAFB', fontSize:26, fontWeight:800, margin:0 },
  sub:        { color:'#6B7280', fontSize:13, marginTop:4 },
  headerRight:{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' },
  stats:      { display:'flex', gap:10, flexWrap:'wrap' },
  filterRow:  { display:'flex', gap:12, padding:'20px 32px', flexWrap:'wrap', alignItems:'center' },
  searchBox:  { background:'#1F2937', border:'1px solid #374151', borderRadius:10, color:'#E5E7EB', padding:'10px 16px', fontSize:13, flex:1, minWidth:200, outline:'none' },
  sel:        { background:'#1F2937', border:'1px solid #374151', borderRadius:10, color:'#E5E7EB', padding:'10px 14px', fontSize:13 },
  viewToggle: { display:'flex', gap:2, background:'#1F2937', borderRadius:10, padding:4, border:'1px solid #374151' },
  viewBtn:    { background:'transparent', border:'none', color:'#6B7280', padding:'6px 12px', borderRadius:7, cursor:'pointer', fontSize:16 },
  viewBtnActive:{ background:'#374151', color:'#E5E7EB' },
  grid:       { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(210px, 1fr))', gap:20, padding:'8px 32px' },
  card:       { background:'#1E293B', borderRadius:16, padding:'18px', cursor:'pointer', transition:'all 0.2s ease', border:'1px solid #334155', position:'relative' },
  cardTop:    { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 },
  cardIcon:   { fontSize:28 },
  statusDot:  { width:10, height:10, borderRadius:'50%', flexShrink:0 },
  cardId:     { color:'#818CF8', fontFamily:'monospace', fontSize:12, fontWeight:700, letterSpacing:1 },
  cardName:   { color:'#E5E7EB', fontSize:14, fontWeight:600, marginTop:4, lineHeight:1.3 },
  cardMeta:   { display:'flex', gap:8, marginTop:10, flexWrap:'wrap' },
  metaPill:   { background:'#0F172A', border:'1px solid #334155', borderRadius:12, padding:'3px 8px', fontSize:11, color:'#9CA3AF' },
  cardStatus: { borderRadius:12, padding:'4px 10px', fontSize:11, fontWeight:600, display:'inline-block', marginTop:10, textTransform:'capitalize' },
  cardHint:   { color:'#6366F1', fontSize:11, marginTop:10, opacity:0.7 },
  listWrap:   { padding:'16px 32px', overflowX:'auto' },
  table:      { width:'100%', borderCollapse:'collapse' },
  th:         { background:'#1F2937', padding:'10px 14px', fontSize:12, color:'#9CA3AF', fontWeight:600, textAlign:'left', borderBottom:'1px solid #374151' },
  tr:         { borderBottom:'1px solid #1F2937', cursor:'pointer' },
  td:         { padding:'12px 14px', fontSize:13, color:'#D1D5DB' },
  badge:      { borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:600, textTransform:'capitalize' },
  viewBtn2:   { background:'#1E3A8A22', border:'1px solid #3B82F666', color:'#60A5FA', borderRadius:8, padding:'5px 12px', fontSize:12, cursor:'pointer' },
  center:     { textAlign:'center', padding:'60px 32px', color:'#6B7280' },
};
