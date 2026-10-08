/**
 * SubstitutionManagement.jsx
 * Dynamic Temporary Faculty / Substitution Management — Admin Page
 *
 * 4 Tabs:
 *  1. Today's Substitutions  — live list with cancel
 *  2. Create Substitution    — step-by-step wizard with conflict check
 *  3. Manage / Edit          — filter + edit/cancel all substitutions
 *  4. Audit History          — full immutable log
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronRight,
  ClipboardList, History, Plus, RefreshCw, Search,
  UserCheck, UserX, X, Clock, BookOpen, Building2, Users,
} from 'lucide-react';
import { substitutionsApi, timetableApi, classroomsApi, facultyApi } from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageTransition from '../../components/PageTransition.jsx';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_TIMES = {
  1: { start: '09:30', end: '10:30' },
  2: { start: '10:30', end: '11:30' },
  3: { start: '11:40', end: '12:40' },
  4: { start: '12:40', end: '13:40' },
  5: { start: '14:15', end: '15:15' },
  6: { start: '15:15', end: '16:15' },
};
const SECTIONS = [
  'IT-2A','IT-2B','IT-2C','IT-3A','IT-3B','IT-3C','IT-4A','IT-4B','IT-4C',
  'Civil-3','Civil-5','Civil-7',
];
const REASONS = [
  'Faculty Absent','Faculty On Leave','Faculty Unavailable',
  'Emergency','Faculty Substitution','Administrative Change','Other',
];
const STATUS_COLORS = { active: '#10B981', cancelled: '#EF4444' };

// ── Tiny utility components ───────────────────────────────────────────────────

const Badge = ({ children, color = '#00E5FF' }) => (
  <span style={{
    background: color + '20', color, border: `1px solid ${color}40`,
    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
  }}>{children}</span>
);

const Pill = ({ label, value, color = '#94A3B8' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
    <span style={{ fontSize: 13, color, fontWeight: 600 }}>{value || '—'}</span>
  </div>
);

const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 16, ...style,
  }}>{children}</div>
);

const Btn = ({ children, variant = 'primary', onClick, disabled, style = {} }) => {
  const base = {
    border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700,
    fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, transition: 'all .15s', ...style,
  };
  const variants = {
    primary:  { background: 'linear-gradient(135deg,#00E5FF,#3B82F6)', color: '#0F172A' },
    danger:   { background: '#EF444422', border: '1px solid #EF444455', color: '#F87171' },
    ghost:    { background: 'rgba(255,255,255,0.06)', color: '#CBD5E1' },
    cancel:   { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#94A3B8' },
    success:  { background: '#10B98122', border: '1px solid #10B98144', color: '#34D399' },
  };
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
};

// ── Sub-Card: individual substitution display ─────────────────────────────────

function SubCard({ sub, onCancel, compact = false }) {
  const isActive = sub.status === 'active';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: isActive ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.04)',
        border: `1px solid ${isActive ? '#10B98130' : '#EF444430'}`,
        borderLeft: `4px solid ${isActive ? '#F59E0B' : '#EF4444'}`,
        borderRadius: 10, padding: compact ? '12px 14px' : '16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isActive
            ? <span style={{ fontSize: 16 }}>🟡</span>
            : <span style={{ fontSize: 16 }}>⚫</span>}
          <span style={{ fontWeight: 800, color: '#fff', fontSize: 14 }}>
            TEMPORARY SUBSTITUTION
          </span>
          <Badge color={isActive ? '#F59E0B' : '#EF4444'}>{sub.status.toUpperCase()}</Badge>
        </div>
        {isActive && onCancel && (
          <Btn variant="danger" onClick={() => onCancel(sub)} style={{ padding: '4px 10px', fontSize: 11 }}>
            ✕ Cancel Substitution
          </Btn>
        )}
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
        <Pill label="Date" value={sub.date} color="#E2E8F0" />
        <Pill label="Period" value={`P${sub.period_number} · ${sub.start_time}–${sub.end_time}`} color="#38BDF8" />
        <Pill label="Room" value={sub.classroom_id} color="#38BDF8" />
        <Pill label="Section" value={sub.section} color="#E2E8F0" />
        <Pill label="Subject" value={sub.subject_name} color="#A78BFA" />
        <Pill label="Reason" value={sub.reason} color="#FBBF24" />
      </div>

      {/* Faculty change */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 8, padding: '10px 14px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#EF4444', marginBottom: 2 }}>ORIGINAL (ABSENT)</div>
          <div style={{ color: '#F87171', fontWeight: 700 }}>{sub.original_faculty_name || '—'}</div>
        </div>
        <ChevronRight size={18} color="#F59E0B" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#10B981', marginBottom: 2 }}>REPLACEMENT</div>
          <div style={{ color: '#34D399', fontWeight: 700 }}>{sub.replacement_faculty_name}</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ fontSize: 10, color: '#475569', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>Created by: {sub.created_by}</span>
        <span>•</span>
        <span>{new Date(sub.created_at).toLocaleString()}</span>
        {sub.cancelled_by && <><span>•</span><span>Cancelled by: {sub.cancelled_by}</span></>}
      </div>
    </motion.div>
  );
}

// ── Tab 1: Today's Substitutions ──────────────────────────────────────────────

function TodayTab({ onCancel }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSubs(await substitutionsApi.today() || []); }
    catch { setSubs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>
            📅 Today's Substitutions
          </h2>
          <p style={{ color: '#64748B', fontSize: 12, margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Btn variant="ghost" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} /> Refresh
        </Btn>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Loading…</div>}

      {!loading && subs.length === 0 && (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <CheckCircle2 size={36} color="#10B981" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#34D399', fontWeight: 700, fontSize: 15 }}>No substitutions scheduled for today</p>
          <p style={{ color: '#64748B', fontSize: 12 }}>All faculty are available per the official timetable.</p>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {subs.map(sub => (
          <SubCard key={sub.id} sub={sub} onCancel={onCancel} />
        ))}
      </div>
    </div>
  );
}

// ── Tab 2: Create Substitution Wizard ─────────────────────────────────────────

function CreateTab({ user, onCreated }) {
  const [step, setStep] = useState(1); // 1=Select slot, 2=Original class info, 3=Confirm
  const [classrooms, setClassrooms] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    period: 1,
    classroom_id: '',
    section: '',
  });
  const [originalEntry, setOriginalEntry] = useState(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [replacementFacultyId, setReplacementFacultyId] = useState('');
  const [reason, setReason] = useState('Faculty Absent');
  const [notes, setNotes] = useState('');
  const [conflict, setConflict] = useState(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([classroomsApi.list(), facultyApi.list()])
      .then(([c, f]) => { setClassrooms(c || []); setFaculty(f || []); });
  }, []);

  const periodInfo = PERIOD_TIMES[form.period];

  // Fetch the original timetable entry for selected room/day/period
  const fetchOriginalEntry = async () => {
    if (!form.classroom_id) { setError('Please select a classroom.'); return; }
    setLoadingEntry(true); setError(''); setOriginalEntry(null);
    try {
      const selectedDate = new Date(form.date);
      const dow = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1; // Mon=0
      const entries = await timetableApi.list({
        classroom_id: form.classroom_id,
        day_of_week: dow,
        active_only: true,
      });
      const match = entries.find(e => e.period_number === form.period);
      if (match) {
        setOriginalEntry(match);
        setStep(2);
      } else {
        setError(`No scheduled class found for ${form.classroom_id} on ${DAY_NAMES[dow]}, Period ${form.period}.`);
      }
    } catch (e) {
      setError('Failed to fetch timetable entry. ' + e.message);
    } finally {
      setLoadingEntry(false);
    }
  };

  // Check replacement faculty conflict
  const checkConflict = async (facId) => {
    setReplacementFacultyId(facId);
    setConflict(null);
    if (!facId || !periodInfo) return;
    setCheckingConflict(true);
    try {
      const result = await substitutionsApi.checkConflict({
        replacement_faculty_id: facId,
        date: form.date,
        period_number: form.period,
        start_time: periodInfo.start,
        end_time: periodInfo.end,
      });
      setConflict(result);
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingConflict(false);
    }
  };

  const replacementFaculty = faculty.find(f => f.id === replacementFacultyId);
  const canProceedToConfirm = replacementFacultyId && conflict && !conflict.has_conflict;

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const payload = {
        date: form.date,
        period_number: form.period,
        start_time: periodInfo.start,
        end_time: periodInfo.end,
        classroom_id: form.classroom_id,
        section: originalEntry.section,
        subject_id: originalEntry.subject_id,
        subject_name: originalEntry.subject_name,
        original_faculty_id: originalEntry.faculty_id,
        original_faculty_name: originalEntry.faculty_name,
        replacement_faculty_id: replacementFacultyId,
        replacement_faculty_name: replacementFaculty?.name || replacementFacultyId,
        reason,
        notes: notes || null,
        created_by: user?.name || user?.email || 'Admin',
      };
      await substitutionsApi.create(payload);
      setSuccess('Substitution saved successfully!');
      onCreated();
      // Reset
      setTimeout(() => {
        setStep(1); setOriginalEntry(null); setReplacementFacultyId('');
        setConflict(null); setReason('Faculty Absent'); setNotes(''); setSuccess('');
      }, 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>➕ Create Substitution</h2>
      <p style={{ color: '#64748B', fontSize: 12, marginBottom: 20 }}>
        Step {step} of 3 — {step === 1 ? 'Select Date & Slot' : step === 2 ? 'Assign Replacement Faculty' : 'Confirm'}
      </p>

      {/* Step progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {[1,2,3].map(s => (
          <div key={s} style={{
            flex: 1, height: 4, borderRadius: 4,
            background: s <= step ? 'linear-gradient(90deg,#00E5FF,#3B82F6)' : 'rgba(255,255,255,0.08)',
            transition: 'background .3s',
          }} />
        ))}
      </div>

      {error && (
        <div style={{ background: '#EF444420', border: '1px solid #EF444440', borderRadius: 8, padding: '10px 14px', color: '#F87171', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#10B98120', border: '1px solid #10B98140', borderRadius: 8, padding: '10px 14px', color: '#34D399', fontSize: 13, marginBottom: 16 }}>
          ✅ {success}
        </div>
      )}

      {/* ── STEP 1: Select slot ── */}
      {step === 1 && (
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            <label style={labelStyle}>
              Date
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Period
              <select value={form.period} onChange={e => setForm(f => ({ ...f, period: +e.target.value }))} style={inputStyle}>
                {Object.entries(PERIOD_TIMES).map(([p, t]) => (
                  <option key={p} value={p}>P{p} · {t.start}–{t.end}</option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Classroom
              <select value={form.classroom_id} onChange={e => setForm(f => ({ ...f, classroom_id: e.target.value }))} style={inputStyle}>
                <option value="">— Select Classroom —</option>
                {classrooms.map(c => <option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
              </select>
            </label>
          </div>
          <div style={{ marginTop: 20, textAlign: 'right' }}>
            <Btn onClick={fetchOriginalEntry} disabled={!form.classroom_id || loadingEntry}>
              {loadingEntry ? 'Fetching…' : 'Fetch Original Schedule →'}
            </Btn>
          </div>
        </Card>
      )}

      {/* ── STEP 2: Show original + assign replacement ── */}
      {step === 2 && originalEntry && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Original class card */}
          <Card style={{ borderLeft: '4px solid #00E5FF' }}>
            <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              📋 Official Timetable — Original Schedule
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              <Pill label="Date" value={form.date} color="#E2E8F0" />
              <Pill label="Period" value={`P${form.period} · ${periodInfo?.start}–${periodInfo?.end}`} color="#38BDF8" />
              <Pill label="Room" value={form.classroom_id} color="#38BDF8" />
              <Pill label="Section" value={originalEntry.section} color="#E2E8F0" />
              <Pill label="Subject" value={originalEntry.subject_name} color="#A78BFA" />
              <Pill label="Original Faculty" value={originalEntry.faculty_name} color="#F87171" />
            </div>
            <p style={{ marginTop: 10, fontSize: 11, color: '#F59E0B', fontStyle: 'italic' }}>
              ℹ️ Subject, Section, and Room will remain unchanged. Only faculty will be substituted.
            </p>
          </Card>

          {/* Replacement faculty selector */}
          <Card>
            <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              👤 Select Replacement Faculty
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={labelStyle}>
                Replacement Faculty
                <select
                  value={replacementFacultyId}
                  onChange={e => checkConflict(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">— Select Faculty —</option>
                  {faculty
                    .filter(f => f.id !== originalEntry.faculty_id)
                    .map(f => <option key={f.id} value={f.id}>{f.name} ({f.department})</option>)}
                </select>
              </label>
              <label style={labelStyle}>
                Reason
                <select value={reason} onChange={e => setReason(e.target.value)} style={inputStyle}>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            </div>
            <label style={{ ...labelStyle, marginTop: 12 }}>
              Notes (optional)
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any additional notes…"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </label>
          </Card>

          {/* Conflict result */}
          {checkingConflict && (
            <Card>
              <p style={{ color: '#94A3B8', fontSize: 13 }}>🔍 Checking faculty availability…</p>
            </Card>
          )}
          {!checkingConflict && conflict && (
            <Card style={{
              borderLeft: `4px solid ${conflict.has_conflict ? '#EF4444' : '#10B981'}`,
              background: conflict.has_conflict ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
            }}>
              {conflict.has_conflict ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <AlertTriangle size={16} color="#F87171" />
                    <span style={{ color: '#F87171', fontWeight: 800, fontSize: 14 }}>⚠️ FACULTY CONFLICT</span>
                  </div>
                  <p style={{ color: '#FCA5A5', fontSize: 13 }}>{conflict.conflict_detail}</p>
                  <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>Please select a different faculty member.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} color="#34D399" />
                  <span style={{ color: '#34D399', fontWeight: 700, fontSize: 14 }}>
                    ✅ {replacementFaculty?.name} is available during P{form.period} on {form.date}
                  </span>
                </div>
              )}
            </Card>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <Btn variant="cancel" onClick={() => setStep(1)}>← Back</Btn>
            <Btn disabled={!canProceedToConfirm} onClick={() => setStep(3)}>
              Review & Confirm →
            </Btn>
          </div>
        </div>
      )}

      {/* ── STEP 3: Confirmation modal ── */}
      {step === 3 && originalEntry && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ border: '1px solid rgba(0,229,255,0.3)', background: 'rgba(0,229,255,0.04)' }}>
            <p style={{ color: '#00E5FF', fontWeight: 800, fontSize: 15, marginBottom: 16, textAlign: 'center' }}>
              📋 TEMPORARY FACULTY SUBSTITUTION — CONFIRMATION
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Pill label="Date" value={new Date(form.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} color="#E2E8F0" />
              <Pill label="Time" value={`${periodInfo?.start}–${periodInfo?.end} (Period ${form.period})`} color="#38BDF8" />
              <Pill label="Room" value={form.classroom_id} color="#38BDF8" />
              <Pill label="Section" value={originalEntry.section} color="#E2E8F0" />
              <Pill label="Subject" value={originalEntry.subject_name} color="#A78BFA" />
              <Pill label="Reason" value={reason} color="#FBBF24" />
            </div>
            <div style={{
              margin: '16px 0', padding: '12px 16px',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 10, color: '#EF4444' }}>ORIGINAL FACULTY (ABSENT)</div>
                <div style={{ color: '#F87171', fontWeight: 700, fontSize: 14 }}>{originalEntry.faculty_name}</div>
              </div>
              <ChevronRight size={20} color="#F59E0B" />
              <div>
                <div style={{ fontSize: 10, color: '#10B981' }}>REPLACEMENT FACULTY</div>
                <div style={{ color: '#34D399', fontWeight: 700, fontSize: 14 }}>{replacementFaculty?.name}</div>
              </div>
            </div>
            {notes && <p style={{ color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>Notes: {notes}</p>}
          </Card>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <Btn variant="cancel" onClick={() => setStep(2)}>← Back</Btn>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="cancel" onClick={() => { setStep(1); setOriginalEntry(null); setReplacementFacultyId(''); setConflict(null); }}>
                Cancel
              </Btn>
              <Btn onClick={handleSave} disabled={saving}>
                {saving ? '💾 Saving…' : '✅ Confirm Substitution'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Manage / Edit ──────────────────────────────────────────────────────

function ManageTab({ user, onCancelled }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ date: '', classroom_id: '', section: '', status: 'active' });
  const [editSub, setEditSub] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [editForm, setEditForm] = useState({ replacement_faculty_id: '', replacement_faculty_name: '', reason: '', notes: '' });
  const [conflict, setConflict] = useState(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.date) params.date = filters.date;
      if (filters.classroom_id) params.classroom_id = filters.classroom_id;
      if (filters.section) params.section = filters.section;
      if (filters.status) params.status = filters.status;
      setSubs(await substitutionsApi.list(params) || []);
    } catch { setSubs([]); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { facultyApi.list().then(f => setFaculty(f || [])); }, []);

  const handleCancel = async (sub) => {
    if (!confirm(`Cancel substitution for ${sub.classroom_id} on ${sub.date}?`)) return;
    try {
      await substitutionsApi.cancel(sub.id, { cancelled_by: user?.name || 'Admin' });
      load(); onCancelled();
    } catch (e) { alert(e.message); }
  };

  const openEdit = (sub) => {
    setEditSub(sub);
    setEditForm({
      replacement_faculty_id: sub.replacement_faculty_id || '',
      replacement_faculty_name: sub.replacement_faculty_name,
      reason: sub.reason,
      notes: sub.notes || '',
    });
    setConflict(null); setError('');
  };

  const checkEditConflict = async (facId) => {
    setEditForm(f => ({ ...f, replacement_faculty_id: facId }));
    setConflict(null);
    if (!facId || !editSub) return;
    setCheckingConflict(true);
    try {
      const result = await substitutionsApi.checkConflict({
        replacement_faculty_id: facId,
        date: editSub.date,
        period_number: editSub.period_number,
        start_time: editSub.start_time,
        end_time: editSub.end_time,
        exclude_substitution_id: editSub.id,
      });
      setConflict(result);
      const fac = faculty.find(f => f.id === facId);
      if (fac) setEditForm(f => ({ ...f, replacement_faculty_name: fac.name }));
    } finally { setCheckingConflict(false); }
  };

  const handleEditSave = async () => {
    if (conflict?.has_conflict) { setError('Cannot save — faculty conflict exists.'); return; }
    setSaving(true); setError('');
    try {
      await substitutionsApi.update(editSub.id, { ...editForm, updated_by: user?.name || 'Admin' });
      setEditSub(null); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>🗂 Manage Substitutions</h2>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={labelStyle}>Date<input type="date" value={filters.date} onChange={e => setFilters(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></label>
          <label style={labelStyle}>
            Classroom
            <input placeholder="e.g. CE-IT-101" value={filters.classroom_id} onChange={e => setFilters(f => ({ ...f, classroom_id: e.target.value }))} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Section
            <select value={filters.section} onChange={e => setFilters(f => ({ ...f, section: e.target.value }))} style={inputStyle}>
              <option value="">All Sections</option>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Status
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <Btn variant="ghost" onClick={load}><RefreshCw size={13} /></Btn>
        </div>
      </Card>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Loading…</div>}

      {!loading && subs.length === 0 && (
        <Card style={{ textAlign: 'center', padding: 32, color: '#64748B' }}>No substitutions found for the selected filters.</Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {subs.map(sub => (
          <div key={sub.id}>
            <SubCard sub={sub} onCancel={handleCancel} compact />
            {sub.status === 'active' && (
              <div style={{ marginTop: 4, textAlign: 'right' }}>
                <Btn variant="ghost" onClick={() => openEdit(sub)} style={{ fontSize: 11, padding: '4px 10px' }}>
                  ✏️ Edit
                </Btn>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editSub && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ color: '#fff', margin: 0 }}>✏️ Edit Substitution</h3>
                <button onClick={() => setEditSub(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {error && <p style={{ color: '#F87171', fontSize: 13 }}>⚠️ {error}</p>}
                <label style={labelStyle}>
                  Replacement Faculty
                  <select value={editForm.replacement_faculty_id} onChange={e => checkEditConflict(e.target.value)} style={inputStyle}>
                    <option value="">— Select —</option>
                    {faculty.map(f => <option key={f.id} value={f.id}>{f.name} ({f.department})</option>)}
                  </select>
                </label>
                {checkingConflict && <p style={{ color: '#94A3B8', fontSize: 12 }}>Checking availability…</p>}
                {conflict && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 8, fontSize: 12,
                    background: conflict.has_conflict ? '#EF444420' : '#10B98120',
                    color: conflict.has_conflict ? '#F87171' : '#34D399',
                    border: `1px solid ${conflict.has_conflict ? '#EF444440' : '#10B98140'}`,
                  }}>
                    {conflict.has_conflict ? `⚠️ ${conflict.conflict_detail}` : '✅ Faculty is available'}
                  </div>
                )}
                <label style={labelStyle}>
                  Reason
                  <select value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))} style={inputStyle}>
                    {REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>
                  Notes
                  <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </label>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                  <Btn variant="cancel" onClick={() => setEditSub(null)}>Cancel</Btn>
                  <Btn onClick={handleEditSave} disabled={saving || conflict?.has_conflict}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Btn>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab 4: Audit History ──────────────────────────────────────────────────────

function HistoryTab() {
  const [subs, setSubs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('substitutions'); // 'substitutions' | 'audit'

  useEffect(() => {
    setLoading(true);
    Promise.all([
      substitutionsApi.list({ status: '' }),
      substitutionsApi.auditHistory(),
    ]).then(([s, a]) => {
      setSubs(s || []);
      setAuditLogs(a || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const actionColors = { CREATED: '#10B981', EDITED: '#F59E0B', CANCELLED: '#EF4444' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>📜 Audit History</h2>
        <div style={{ display: 'flex', background: '#1E293B', borderRadius: 8, padding: 3, gap: 2 }}>
          {['substitutions', 'audit'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? '#00E5FF' : 'transparent',
              color: view === v ? '#0F172A' : '#94A3B8',
              border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12,
            }}>
              {v === 'substitutions' ? 'All Records' : 'Change Log'}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Loading history…</div>}

      {!loading && view === 'substitutions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {subs.length === 0
            ? <Card style={{ textAlign: 'center', padding: 32, color: '#64748B' }}>No substitution records found.</Card>
            : subs.map(sub => <SubCard key={sub.id} sub={sub} compact />)
          }
        </div>
      )}

      {!loading && view === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {auditLogs.length === 0
            ? <Card style={{ textAlign: 'center', padding: 32, color: '#64748B' }}>No audit logs found.</Card>
            : auditLogs.map(log => (
              <Card key={log.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                  background: actionColors[log.action] || '#94A3B8',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge color={actionColors[log.action] || '#94A3B8'}>{log.action}</Badge>
                    <span style={{ color: '#94A3B8', fontSize: 12 }}>by {log.changed_by}</span>
                    <span style={{ color: '#475569', fontSize: 11 }}>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: '#64748B', fontFamily: 'monospace', background: '#0F172A', padding: '6px 10px', borderRadius: 6, maxHeight: 80, overflowY: 'auto' }}>
                    Sub #{log.substitution_id} — {JSON.stringify(log.snapshot, null, 0).slice(0, 200)}…
                  </div>
                </div>
              </Card>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle = {
  display: 'flex', flexDirection: 'column', gap: 6,
  fontSize: 12, color: '#94A3B8', fontWeight: 600,
};
const inputStyle = {
  background: '#1E293B', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
  color: '#F1F5F9', padding: '8px 12px', fontSize: 13, outline: 'none',
  fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'today',   label: "📅 Today's",     icon: CalendarDays },
  { id: 'create',  label: '➕ Create',      icon: Plus },
  { id: 'manage',  label: '🗂 Manage',      icon: ClipboardList },
  { id: 'history', label: '📜 History',     icon: History },
];

export default function SubstitutionManagement() {
  const { user } = useAuth();
  const [tab, setTab] = useState('today');
  const [todayCount, setTodayCount] = useState(null);

  const refreshTodayCount = useCallback(async () => {
    try {
      const subs = await substitutionsApi.today();
      setTodayCount(subs?.length ?? 0);
    } catch { setTodayCount(0); }
  }, []);

  useEffect(() => { refreshTodayCount(); }, [refreshTodayCount]);

  return (
    <PageTransition className="min-h-screen px-4 pb-20 pt-28 sm:px-6">
      <div style={{ maxWidth: 1100, margin: '0 auto', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>

        {/* Page Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.05))',
            border: '1px solid rgba(245,158,11,0.15)', borderRadius: 16, padding: 20,
          }}>
            <div>
              <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: 0 }}>
                🔄 Faculty Substitution Management
              </h1>
              <p style={{ color: '#94A3B8', fontSize: 13, margin: '6px 0 0' }}>
                Temporarily assign replacement faculty without modifying the official timetable.
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: todayCount > 0 ? '#F59E0B' : '#10B981' }}>
                {todayCount ?? '…'}
              </div>
              <div style={{ fontSize: 11, color: '#64748B' }}>Today's Active Subs</div>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? 'rgba(0,229,255,0.15)' : 'transparent',
              color: tab === t.id ? '#00E5FF' : '#94A3B8',
              border: tab === t.id ? '1px solid rgba(0,229,255,0.3)' : '1px solid transparent',
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
              fontWeight: 700, fontSize: 13, transition: 'all .15s',
            }}>
              {t.label}
              {t.id === 'today' && todayCount > 0 && (
                <span style={{ marginLeft: 6, background: '#F59E0B', color: '#000', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                  {todayCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'today' && (
              <TodayTab
                onCancel={async (sub) => {
                  if (!confirm(`Cancel substitution for ${sub.classroom_id} on ${sub.date}?`)) return;
                  try {
                    await substitutionsApi.cancel(sub.id, { cancelled_by: user?.name || 'Admin' });
                    refreshTodayCount();
                  } catch (e) { alert(e.message); }
                }}
              />
            )}
            {tab === 'create' && (
              <CreateTab user={user} onCreated={() => { refreshTodayCount(); setTab('today'); }} />
            )}
            {tab === 'manage' && (
              <ManageTab user={user} onCancelled={refreshTodayCount} />
            )}
            {tab === 'history' && <HistoryTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
