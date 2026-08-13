import { useState, useEffect, useRef } from 'react';
import { timetableApi, classroomsApi, subjectsApi, facultyApi } from '../../utils/api';

const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const PERIOD_TIMES = {
  1:['09:30','10:30'], 2:['10:30','11:30'], 3:['11:40','12:40'],
  4:['14:15','15:15'], 5:['15:15','16:15']
};
const SUBJECT_COLORS = {
  'IOT':'#06B6D4','NS':'#8B5CF6','CS':'#EF4444','BCT':'#F59E0B',
  'ASE':'#10B981','RSE':'#F97316','IOT_LAB':'#0891B2','CNNS_LAB':'#7C3AED',
  'PW_I':'#059669','SI_II':'#DB2777','COUNSEL':'#6B7280',
};
const getSubjectColor = (code) => SUBJECT_COLORS[code] || '#6366F1';

export default function TimetableManagement() {
  const [tab, setTab]                     = useState('grid');
  const [entries, setEntries]             = useState([]);
  const [classrooms, setClassrooms]       = useState([]);
  const [subjects, setSubjects]           = useState([]);
  const [faculty, setFaculty]             = useState([]);
  const [conflicts, setConflicts]         = useState(null);
  const [loading, setLoading]             = useState(true);
  const [filterSection, setFilterSection] = useState('IT-4B');
  const [csvFile, setCsvFile]             = useState(null);
  const [csvResult, setCsvResult]         = useState(null);
  const [csvLoading, setCsvLoading]       = useState(false);
  const [showAddModal, setShowAddModal]   = useState(false);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const [e, c, s, f] = await Promise.all([
        timetableApi.list(filterSection ? { section: filterSection } : {}),
        classroomsApi.list(),
        subjectsApi.list(),
        facultyApi.list(),
      ]);
      setEntries(e || []); setClassrooms(c || []); setSubjects(s || []); setFaculty(f || []);
    } catch(err){ console.error(err); }
    finally { setLoading(false); }
  };

  const loadConflicts = async () => {
    try { setConflicts(await timetableApi.conflicts()); } catch(err) { console.error(err); }
  };

  useEffect(() => { load(); }, [filterSection]);
  useEffect(() => { if (tab === 'conflicts') loadConflicts(); }, [tab]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    await timetableApi.delete(id);
    load();
  };

  const handleCsvUpload = async (dryRun) => {
    if (!csvFile) return;
    setCsvLoading(true); setCsvResult(null);
    try { const r = await timetableApi.importCsv(csvFile, dryRun); setCsvResult(r); if (!dryRun) load(); }
    catch(err){ setCsvResult({ error: err.message }); }
    finally { setCsvLoading(false); }
  };

  const grid = {};
  for (const day of DAY_NAMES) {
    grid[day] = {};
    for (let p = 1; p <= 5; p++) grid[day][p] = [];
  }
  entries.forEach(e => {
    const dayName = DAY_NAMES[e.day_of_week];
    if (dayName && grid[dayName]?.[e.period_number]) {
      grid[dayName][e.period_number].push(e);
    }
  });

  const tabs = [
    { id:'grid',     label:'📅 Schedule Grid' },
    { id:'entries',  label:'📋 Entries' },
    { id:'import',   label:'📤 CSV Import' },
    { id:'conflicts',label:'⚠️ Conflicts' },
  ];

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.title}>Timetable Management</h1>
          <p style={s.subtitle}>MVSR Engineering College · Civil & IT Block · IT 4B Sem VII</p>
        </div>
        <div style={s.topActions}>
          <select style={s.select} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
            <option value="IT-4B">IT-4B</option>
            <option value="">All sections</option>
          </select>
          <button style={s.btnPrimary} onClick={() => setShowAddModal(true)}>+ Add Entry</button>
        </div>
      </div>

      <div style={s.tabRow}>
        {tabs.map(t => <button key={t.id} style={{ ...s.tabBtn, ...(tab===t.id?s.tabActive:{}) }} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </div>

      {loading && <div style={s.center}>Loading…</div>}

      {!loading && tab === 'grid' && (
        <div style={s.gridWrap}>
          <div style={s.gridTable}>
            <div style={s.gridCell('header')}></div>
            {DAY_NAMES.map(d => <div key={d} style={s.gridCell('dayhead')}>{d}</div>)}
            {[1,2,3,4,5].map(p => (
              <div key={p} style={{display:'contents'}}>
                <div style={s.gridCell('periodlabel')}>
                  <div style={{fontWeight:700}}>P{p}</div>
                  <div style={{fontSize:10,color:'#6B7280',marginTop:2}}>{PERIOD_TIMES[p][0]}</div>
                </div>
                {DAY_NAMES.map(day => {
                  const cell = grid[day][p];
                  return (
                    <div key={`${day}-${p}`} style={s.gridCell('cell')}>
                      {cell.length === 0
                        ? <div style={s.freeSlot}>Free</div>
                        : cell.map(e => {
                            const subj = subjects.find(x=>x.id===e.subject_id);
                            const col = getSubjectColor(subj?.code || '');
                            return (
                              <div key={e.id} style={{ ...s.entryChip, background:`${col}22`, borderLeft:`3px solid ${col}` }}>
                                <div style={{color:col,fontWeight:700,fontSize:11}}>{subj?.code || e.subject_name.slice(0,6)}</div>
                                <div style={{color:'#9CA3AF',fontSize:10,marginTop:2}}>{e.classroom_id}</div>
                                {e.batch && <div style={{color:'#6B7280',fontSize:10}}>B{e.batch}</div>}
                              </div>
                            );
                          })
                      }
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
              <tr>{['Day','Period','Time','Room','Subject','Faculty','Section','Batch','Actions'].map(h =>
                <th key={h} style={s.th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const subj = subjects.find(x=>x.id===e.subject_id);
                const col = getSubjectColor(subj?.code||'');
                return (
                  <tr key={e.id} style={s.tr}>
                    <td style={s.td}>{DAY_NAMES[e.day_of_week]}</td>
                    <td style={s.td}>P{e.period_number}</td>
                    <td style={s.td}><span style={{fontFamily:'monospace',fontSize:11}}>{e.start_time}–{e.end_time}</span></td>
                    <td style={s.td}><span style={{color:'#818CF8',fontWeight:600}}>{e.classroom_id}</span></td>
                    <td style={s.td}><span style={{...s.badge, background:`${col}22`,color:col}}>{e.subject_name}</span></td>
                    <td style={s.td}>{e.faculty_name}</td>
                    <td style={s.td}>{e.section}</td>
                    <td style={s.td}>{e.batch||'—'}</td>
                    <td style={s.td}>
                      <button style={s.btnDanger} onClick={()=>handleDelete(e.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
              {entries.length === 0 && <tr><td colSpan={9} style={{...s.td,textAlign:'center',color:'#6B7280'}}>No entries found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'import' && (
        <div style={s.importBox}>
          <h3 style={{color:'#E5E7EB',marginBottom:8}}>Import Timetable from CSV</h3>
          <p style={{color:'#9CA3AF',fontSize:13,marginBottom:16}}>
            Required columns: <code style={s.code}>day_of_week, period_number, start_time, end_time, classroom_id, subject_name, faculty_name, section, semester</code><br/>
            Optional: <code style={s.code}>subject_id, faculty_id, department, academic_year, batch</code>
          </p>

          <a href="/timetable_template.csv" style={s.downloadBtn} download>⬇ Download Template</a>

          <div style={s.dropZone} onClick={() => fileRef.current.click()}>
            <div style={{fontSize:32}}>📁</div>
            <div style={{color:'#9CA3AF',marginTop:8}}>{csvFile ? csvFile.name : 'Click to select CSV file'}</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={e=>setCsvFile(e.target.files[0])} />

          <div style={{display:'flex',gap:12,marginTop:16}}>
            <button style={s.btnSecondary} disabled={!csvFile||csvLoading} onClick={()=>handleCsvUpload(true)}>
              {csvLoading ? 'Validating…' : '🔍 Dry Run (Validate)'}
            </button>
            <button style={s.btnPrimary} disabled={!csvFile||csvLoading} onClick={()=>handleCsvUpload(false)}>
              {csvLoading ? 'Importing…' : '⬆ Import'}
            </button>
          </div>

          {csvResult && (
            <div style={{...s.resultBox, borderColor: csvResult.error ? '#7F1D1D' : (csvResult.skipped>0?'#78350F':'#064E3B')}}>
              {csvResult.error ? (
                <p style={{color:'#FCA5A5'}}>Error: {csvResult.error}</p>
              ) : (
                <>
                  <p style={{color:'#6EE7B7',fontWeight:700}}>
                    {csvResult.dry_run ? `Would insert: ${csvResult.would_insert} rows` : `Inserted: ${csvResult.inserted} rows`}
                  </p>
                  {csvResult.skipped > 0 && <p style={{color:'#FCD34D'}}>Skipped: {csvResult.skipped} rows</p>}
                  {csvResult.errors?.map((err,i) => <p key={i} style={{color:'#FCA5A5',fontSize:12}}>Row {err.row}: {err.error}</p>)}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'conflicts' && (
        <div style={{padding:24}}>
          {!conflicts && <div style={s.center}>Loading conflicts…</div>}
          {conflicts && (
            <>
              <div style={{...s.conflictSummary, background: conflicts.total_conflicts===0?'#064E3B33':'#7F1D1D33', borderColor: conflicts.total_conflicts===0?'#059669':'#EF4444'}}>
                {conflicts.total_conflicts===0
                  ? <span style={{color:'#6EE7B7',fontWeight:700}}>✅ No conflicts detected!</span>
                  : <span style={{color:'#FCA5A5',fontWeight:700}}>⚠️ {conflicts.total_conflicts} conflict{conflicts.total_conflicts>1?'s':''} detected</span>
                }
              </div>
              {conflicts.conflicts.map((c,i) => (
                <div key={i} style={s.conflictCard}>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                    <span style={{...s.badge,background: c.conflict_type==='classroom'?'#FEF3C722':c.conflict_type==='faculty'?'#EDE9FE22':'#FEE2E222', color: c.conflict_type==='classroom'?'#F59E0B':c.conflict_type==='faculty'?'#8B5CF6':'#EF4444'}}>
                      {c.conflict_type}
                    </span>
                    <span style={{color:'#D1D5DB',fontSize:13}}>{c.description}</span>
                  </div>
                  {c.entries.map((e,j) => (
                    <div key={j} style={{background:'#0F172A',borderRadius:8,padding:'8px 12px',marginBottom:4,fontSize:12,color:'#9CA3AF'}}>
                      {DAY_NAMES[e.day_of_week]} · P{e.period_number} · {e.classroom_id} · {e.subject_name} · {e.faculty_name}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {showAddModal && (
        <AddEntryModal
          classrooms={classrooms} subjects={subjects} faculty={faculty}
          onClose={() => setShowAddModal(false)}
          onSave={async (data) => { await timetableApi.create(data); setShowAddModal(false); load(); }}
        />
      )}
    </div>
  );
}

function AddEntryModal({ classrooms, subjects, faculty, onClose, onSave }) {
  const [form, setForm] = useState({
    day_of_week:'0', period_number:'1', classroom_id:'CE-IT-213',
    subject_id:'', subject_name:'', faculty_id:'', faculty_name:'',
    section:'IT-4B', semester:'7', department:'IT', academic_year:'2026-2027', batch:''
  });

  const set = (k,v) => {
    const next = {...form,[k]:v};
    if (k==='subject_id') { const sb=subjects.find(x=>x.id===v); if(sb) next.subject_name=sb.name; }
    if (k==='faculty_id') { const f=faculty.find(x=>x.id===v); if(f) next.faculty_name=f.name; }
    setForm(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    const p = parseInt(form.period_number);
    const times = {1:['09:30','10:30'],2:['10:30','11:30'],3:['11:40','12:40'],4:['14:15','15:15'],5:['15:15','16:15']};
    await onSave({
      ...form,
      day_of_week: parseInt(form.day_of_week),
      period_number: p,
      start_time: times[p][0],
      end_time: times[p][1],
      semester: parseInt(form.semester),
      batch: form.batch || null,
      subject_id: form.subject_id || null,
      faculty_id: form.faculty_id || null,
    });
  };

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e=>e.stopPropagation()}>
        <h2 style={{color:'#F9FAFB',marginBottom:16,fontSize:18}}>Add Timetable Entry</h2>
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={s.formRow}>
            <label style={s.label}>Day</label>
            <select style={s.input} value={form.day_of_week} onChange={e=>set('day_of_week',e.target.value)}>
              {['Monday','Tuesday','Wednesday','Thursday','Friday'].map((d,i)=><option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div style={s.formRow}>
            <label style={s.label}>Period</label>
            <select style={s.input} value={form.period_number} onChange={e=>set('period_number',e.target.value)}>
              {[1,2,3,4,5].map(p=><option key={p} value={p}>P{p} ({PERIOD_TIMES[p][0]}–{PERIOD_TIMES[p][1]})</option>)}
            </select>
          </div>
          <div style={s.formRow}>
            <label style={s.label}>Classroom</label>
            <select style={s.input} value={form.classroom_id} onChange={e=>set('classroom_id',e.target.value)}>
              {classrooms.map(c=><option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}
            </select>
          </div>
          <div style={s.formRow}>
            <label style={s.label}>Subject</label>
            <select style={s.input} value={form.subject_id} onChange={e=>set('subject_id',e.target.value)}>
              <option value="">— Select —</option>
              {subjects.map(sb=><option key={sb.id} value={sb.id}>{sb.code} — {sb.name}</option>)}
            </select>
          </div>
          <div style={s.formRow}>
            <label style={s.label}>Faculty</label>
            <select style={s.input} value={form.faculty_id} onChange={e=>set('faculty_id',e.target.value)}>
              <option value="">— Select —</option>
              {faculty.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div style={s.formRow}>
            <label style={s.label}>Batch</label>
            <select style={s.input} value={form.batch} onChange={e=>set('batch',e.target.value)}>
              <option value="">Whole class</option>
              <option value="1">Batch 1</option>
              <option value="2">Batch 2</option>
            </select>
          </div>
          <div style={{display:'flex',gap:10,marginTop:8}}>
            <button type="button" style={s.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" style={s.btnPrimary}>Save Entry</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const s = {
  page:       { background:'#0F172A', minHeight:'100vh', color:'#E5E7EB', fontFamily:"'Inter',sans-serif" },
  topBar:     { display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'28px 32px 0', flexWrap:'wrap', gap:16 },
  title:      { color:'#F9FAFB', fontSize:26, fontWeight:800, margin:0 },
  subtitle:   { color:'#6B7280', fontSize:13, marginTop:4 },
  topActions: { display:'flex', gap:12, alignItems:'center' },
  select:     { background:'#1F2937', border:'1px solid #374151', borderRadius:8, color:'#E5E7EB', padding:'8px 14px', fontSize:13 },
  tabRow:     { display:'flex', gap:2, padding:'20px 32px 0', borderBottom:'1px solid #1F2937', marginTop:16 },
  tabBtn:     { background:'transparent', border:'none', color:'#6B7280', padding:'10px 18px', fontSize:13, cursor:'pointer', borderRadius:'8px 8px 0 0', fontWeight:500 },
  tabActive:  { background:'#1F2937', color:'#818CF8', borderBottom:'2px solid #6366F1' },
  gridWrap:   { overflowX:'auto', padding:'24px 32px' },
  gridTable:  { display:'grid', gridTemplateColumns:'80px repeat(5, 1fr)', gap:4, minWidth:700 },
  gridCell: (t) => ({
    ...(t==='header'  ? {background:'transparent'} : {}),
    ...(t==='dayhead' ? {background:'#1E293B',borderRadius:8,padding:'10px',textAlign:'center',fontWeight:700,color:'#818CF8',fontSize:13} : {}),
    ...(t==='periodlabel' ? {background:'#1E293B',borderRadius:8,padding:'12px 8px',textAlign:'center',color:'#E5E7EB',fontSize:12} : {}),
    ...(t==='cell'    ? {background:'#111827',borderRadius:8,padding:8,minHeight:70,border:'1px solid #1F2937'} : {}),
  }),
  freeSlot:   { color:'#374151', fontSize:11, textAlign:'center', paddingTop:20 },
  entryChip:  { borderRadius:8, padding:'6px 8px', marginBottom:4 },
  tableWrap:  { overflowX:'auto', padding:'24px 32px' },
  table:      { width:'100%', borderCollapse:'collapse' },
  th:         { background:'#1F2937', padding:'10px 14px', fontSize:12, color:'#9CA3AF', fontWeight:600, textAlign:'left', borderBottom:'1px solid #374151' },
  tr:         { borderBottom:'1px solid #1F2937' },
  td:         { padding:'10px 14px', fontSize:13, color:'#D1D5DB', verticalAlign:'middle' },
  badge:      { borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:600 },
  btnPrimary: { background:'linear-gradient(135deg,#6366F1,#8B5CF6)', border:'none', color:'#fff', borderRadius:8, padding:'9px 18px', cursor:'pointer', fontSize:13, fontWeight:600 },
  btnSecondary:{ background:'#1F2937', border:'1px solid #374151', color:'#D1D5DB', borderRadius:8, padding:'9px 18px', cursor:'pointer', fontSize:13 },
  btnDanger:  { background:'#7F1D1D33', border:'1px solid #7F1D1D', color:'#FCA5A5', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 },
  center:     { textAlign:'center', padding:60, color:'#6B7280' },
  importBox:  { padding:'24px 32px', maxWidth:600 },
  code:       { background:'#1F2937', borderRadius:4, padding:'1px 6px', fontFamily:'monospace', fontSize:12, color:'#818CF8' },
  downloadBtn:{ display:'inline-block', background:'#1F2937', border:'1px solid #374151', color:'#818CF8', borderRadius:8, padding:'8px 16px', fontSize:13, textDecoration:'none', marginBottom:16 },
  dropZone:   { border:'2px dashed #374151', borderRadius:12, padding:'40px 20px', textAlign:'center', cursor:'pointer', background:'#111827', marginTop:8 },
  resultBox:  { background:'#111827', border:'1px solid', borderRadius:8, padding:14, marginTop:16 },
  conflictSummary:{ border:'1px solid', borderRadius:8, padding:'12px 18px', marginBottom:16 },
  conflictCard:   { background:'#1F2937', borderRadius:10, padding:'14px 16px', marginBottom:12 },
  modalOverlay:{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)' },
  modal:      { background:'#1F2937',borderRadius:16,padding:28,width:480,maxWidth:'95vw',border:'1px solid #374151' },
  formRow:    { display:'flex',flexDirection:'column',gap:4 },
  label:      { color:'#9CA3AF',fontSize:12 },
  input:      { background:'#111827',border:'1px solid #374151',borderRadius:8,color:'#E5E7EB',padding:'9px 12px',fontSize:13 },
};
