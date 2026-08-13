import { useState } from 'react';

const PERIOD_PRESETS = [
  { label: 'P1 (09:30)', time: '09:30' },
  { label: 'P2 (10:30)', time: '10:30' },
  { label: 'P3 (11:40)', time: '11:40' },
  { label: 'P4 (14:15)', time: '14:15' },
  { label: 'P5 (15:15)', time: '15:15' },
];

export default function TimeMachineBar({ onTimeChange }) {
  const [isSimulated, setIsSimulated] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [selectedTime, setSelectedTime] = useState('10:30');

  const emit = (sim, d, t) => {
    if (!sim) {
      onTimeChange(null);
    } else {
      const dtStr = `${d}T${t}:00`;
      onTimeChange(dtStr);
    }
  };

  const handleToggle = (val) => {
    setIsSimulated(val);
    emit(val, selectedDate, selectedTime);
  };

  const handleDateChange = (d) => {
    setSelectedDate(d);
    if (isSimulated) emit(true, d, selectedTime);
  };

  const handleTimeChange = (t) => {
    setSelectedTime(t);
    if (isSimulated) emit(true, selectedDate, t);
  };

  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <span style={styles.icon}>⏱️</span>
        <div>
          <div style={styles.title}>Time-Aware Resolution</div>
          <div style={styles.sub}>
            {isSimulated ? 'Simulated Academic Slot' : 'Live Real-Time Server Clock'}
          </div>
        </div>
      </div>

      <div style={styles.controls}>
        {/* Toggle Live vs Simulated */}
        <div style={styles.modeToggle}>
          <button
            style={{ ...styles.modeBtn, ...(isSimulated ? {} : styles.modeActive) }}
            onClick={() => handleToggle(false)}
          >
            🟢 Live Time
          </button>
          <button
            style={{ ...styles.modeBtn, ...(isSimulated ? styles.modeActiveSim : {}) }}
            onClick={() => handleToggle(true)}
          >
            🔮 Time Machine
          </button>
        </div>

        {/* Date & Time Selectors */}
        {isSimulated && (
          <div style={styles.simInputs}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              style={styles.inputDate}
            />

            <div style={styles.presetGroup}>
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.time}
                  onClick={() => handleTimeChange(p.time)}
                  style={{
                    ...styles.presetBtn,
                    ...(selectedTime === p.time ? styles.presetActive : {}),
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  bar: {
    background: '#1E293B',
    border: '1px solid #334155',
    borderRadius: 14,
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  left: { display: 'flex', alignItems: 'center', gap: 12 },
  icon: { fontSize: 24 },
  title: { color: '#F8FAFC', fontWeight: 700, fontSize: 14 },
  sub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  controls: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  modeToggle: {
    display: 'flex',
    background: '#0F172A',
    padding: 3,
    borderRadius: 10,
    border: '1px solid #334155',
  },
  modeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748B',
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  modeActive: { background: '#10B98122', color: '#10B981', border: '1px solid #10B98144' },
  modeActiveSim: { background: '#8B5CF622', color: '#A78BFA', border: '1px solid #8B5CF644' },
  simInputs: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  inputDate: {
    background: '#0F172A',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#F8FAFC',
    padding: '5px 10px',
    fontSize: 12,
    outline: 'none',
  },
  presetGroup: { display: 'flex', gap: 4 },
  presetBtn: {
    background: '#0F172A',
    border: '1px solid #334155',
    color: '#94A3B8',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
  },
  presetActive: { background: '#6366F1', color: '#FFFFFF', borderColor: '#6366F1' },
};
