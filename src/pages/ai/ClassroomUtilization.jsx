// ClassroomUtilization.jsx — ML forecast of next week's classroom attendance & room decisions
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Gauge, Info, RefreshCw, Repeat } from 'lucide-react';
import MonitoringLayout, { AlertPill, HBar, MCard } from '../../components/monitoring/MonitoringLayout.jsx';
import { utilizationApi } from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PERIODS = [1, 2, 3, 4, 5, 6];
const TABS = ['Recommendations', 'Room Heatmap', 'Rooms', 'Model'];
const pct = (v) => `${Math.round(v * 100)}%`;

// Seat utilization → cell colour
function utilColor(u) {
  if (u === undefined) return 'rgba(255,255,255,0.04)';
  if (u > 1) return '#ef4444';
  if (u >= 0.85) return '#F59E0B';
  if (u >= 0.55) return '#00FFB3';
  if (u >= 0.3) return '#38BDF8';
  return '#7B61FF';
}

export default function ClassroomUtilization() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('Recommendations');
  const [report, setReport] = useState(null);
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const [training, setTraining] = useState(false);

  const load = () => {
    setError('');
    Promise.all([utilizationApi.report(), utilizationApi.model()])
      .then(([r, m]) => { setReport(r); setModel(m); })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const retrain = async () => {
    setTraining(true);
    try { await utilizationApi.train(); setReport(null); load(); }
    catch (e) { setError(e.message); }
    finally { setTraining(false); }
  };

  const s = report?.summary;
  const kpis = s ? [
    { label: 'Predicted attendance', value: pct(s.avg_attendance_rate), icon: '🎓', unit: '' },
    { label: 'Seat utilization (all rooms, all periods)', value: pct(s.campus_seat_utilization), icon: '💺', unit: '' },
    { label: 'Room periods in use', value: pct(s.room_slot_utilization), icon: '🏫', unit: '' },
    { label: 'Reschedule suggestions', value: s.reschedule_suggestions, icon: '🔁', unit: '' },
    { label: 'Timetable clashes', value: s.timetable_clashes, icon: '⚠️', unit: '' },
    { label: 'Overflow risks', value: s.overflow_risks, icon: '🚪', unit: '' },
  ] : [];

  return (
    <MonitoringLayout
      title="Classroom Utilization"
      subtitle={report ? `ML forecast for week ${report.week} (from ${report.week_start}) · ${s.sessions} timetabled sessions`
                       : 'Machine-learning forecast of next week\'s attendance and room use'}
      icon={<Gauge size={22} />}
      accentColor="#00FFB3"
      liveLabel={model ? `Model trained ${new Date(model.trained_at).toLocaleString()}` : undefined}
      kpis={kpis}
    >
      {error && <AlertPill level="critical" message={`Could not load utilization data: ${error}`} />}
      {!report && !error && (
        <MCard><p className="text-sm text-slate-400">Loading forecast… (the first run trains the model, about 20 seconds)</p></MCard>
      )}

      {report && (
        <>
          <div className="mb-5 flex gap-1 rounded-xl border border-white/8 bg-white/3 p-1 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  tab === t ? 'bg-[#00FFB3]/12 text-[#00FFB3]' : 'text-slate-400 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'Recommendations' && <Recommendations rec={report.recommendations} />}
          {tab === 'Room Heatmap' && <Heatmap report={report} />}
          {tab === 'Rooms' && <Rooms rooms={report.rooms} />}
          {tab === 'Model' && model && <ModelCard model={model} isAdmin={isAdmin} training={training} onRetrain={retrain} />}
        </>
      )}
    </MonitoringLayout>
  );
}

// ── Recommendations ───────────────────────────────────────────────────────────
function Section({ title, icon, accent, items, empty, render }) {
  return (
    <MCard title={`${title} (${items.length})`} accent={accent}>
      {items.length === 0 ? <p className="text-xs text-slate-500">{empty}</p> : (
        <div className="space-y-2">{items.map(render)}</div>
      )}
    </MCard>
  );
}

function Row({ left, right, action, tone = '#00FFB3' }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">{left}</div>
        {right && <div className="text-right text-xs text-slate-400 shrink-0">{right}</div>}
      </div>
      <p className="mt-2 text-xs font-medium" style={{ color: tone }}>→ {action}</p>
    </div>
  );
}

function Recommendations({ rec }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Timetable clashes" accent="#ef4444" items={rec.clashes}
        empty="No room is double-booked." render={(c, i) => (
          <Row key={i} tone="#ef4444"
            left={<><p className="text-sm font-semibold text-white">{c.classroom_id} · {c.slot}</p>
                    <p className="text-xs text-slate-400">{c.classes.join('  ×  ')}</p></>}
            action={c.action} />
        )} />

      <Section title="Overflow risk" accent="#F59E0B" items={rec.overflow}
        empty="No room is expected to exceed its seats." render={(o, i) => (
          <Row key={i} tone="#F59E0B"
            left={<><p className="text-sm font-semibold text-white">{o.classroom_id} · {o.slot}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${o.severity === 'likely' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>{o.severity}</span></p>
                    <p className="text-xs text-slate-400">{o.class}{o.combined ? ' (combined class)' : ''}</p></>}
            right={<><p className="text-white font-semibold">~{o.predicted_present} / {o.capacity} seats</p><p>up to {o.predicted_high}</p></>}
            action={o.action} />
        )} />

      <Section title="Reschedule for better attendance" accent="#00FFB3" items={rec.reschedule}
        empty="No slot change is predicted to help." render={(r, i) => (
          <Row key={i}
            left={<><p className="text-sm font-semibold text-white">{r.section} · {r.subject}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      {r.slot} <ArrowRight size={11} /> {r.to_slot} · {r.to_room}
                      {r.swap_with && <span className="flex items-center gap-1 text-slate-500"><Repeat size={11} /> swap</span>}
                    </p></>}
            right={<><p className="text-white font-semibold">{r.predicted_present} → {r.expected_present_after}</p>
                     <p>of {r.enrolled} enrolled</p></>}
            action={r.action} />
        )} />

      <Section title="Low attendance (no better slot found)" accent="#38BDF8" items={rec.low_attendance}
        empty="No other low-attendance sessions." render={(r, i) => (
          <Row key={i} tone="#38BDF8"
            left={<><p className="text-sm font-semibold text-white">{r.section} · {r.subject}</p>
                    <p className="text-xs text-slate-400">{r.slot} · {r.classroom_id} · {r.faculty}</p></>}
            right={<><p className="text-white font-semibold">{r.predicted_present} / {r.enrolled}</p>
                     <p>range {r.predicted_low}–{r.predicted_high}</p></>}
            action={r.action} />
        )} />

      <Section title="Under-used rooms" accent="#7B61FF" items={rec.idle_rooms}
        empty="Every room is used in most periods." render={(r, i) => (
          <Row key={i} tone="#a78bfa"
            left={<><p className="text-sm font-semibold text-white">{r.classroom_id} <span className="text-xs font-normal text-slate-400">({r.capacity} seats)</span></p>
                    <p className="text-xs text-slate-400">{r.name}</p></>}
            right={<p className="text-white font-semibold">{pct(r.slot_utilization)} of periods used</p>}
            action={r.action} />
        )} />

      {rec.downsize.length > 0 && (
        <Section title="Smaller room would do" accent="#94a3b8" items={rec.downsize} render={(d, i) => (
          <Row key={i} tone="#cbd5e1"
            left={<><p className="text-sm font-semibold text-white">{d.classroom_id} · {d.slot}</p>
                    <p className="text-xs text-slate-400">{d.class}</p></>}
            right={<p className="text-white font-semibold">~{d.predicted_present} / {d.capacity}</p>}
            action={d.action} />
        )} />
      )}
    </div>
  );
}

// ── Heatmap: rooms × (day, period) ────────────────────────────────────────────
function Heatmap({ report }) {
  const cells = useMemo(() => {
    const m = {};
    report.heatmap.forEach((h) => { m[`${h.classroom_id}|${h.day}|${h.period}`] = h; });
    return m;
  }, [report]);
  const days = DAYS.filter((d) => report.teaching_days.includes(d));

  return (
    <MCard title="Predicted seat utilization by room and period" accent="#00FFB3">
      <div className="mb-3 flex flex-wrap gap-3 text-[10px] text-slate-400">
        {[['< 30%', '#7B61FF'], ['30–55%', '#38BDF8'], ['55–85%', '#00FFB3'], ['85–100%', '#F59E0B'], ['over capacity', '#ef4444'], ['free', 'rgba(255,255,255,0.08)']]
          .map(([l, c]) => <span key={l} className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: c }} />{l}</span>)}
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th />
              {days.map((d) => <th key={d} colSpan={PERIODS.length} className="text-[10px] font-semibold text-slate-400 px-1">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {report.rooms.map((room) => (
              <tr key={room.classroom_id}>
                <td className="pr-2 text-[10px] font-mono text-slate-400 whitespace-nowrap">{room.classroom_id}</td>
                {days.map((d) => (
                  <Fragment key={d}>
                    {PERIODS.map((p) => {
                      const h = cells[`${room.classroom_id}|${DAYS.indexOf(d)}|${p}`];
                      return (
                        <td key={p} title={h ? `${d} P${p} · ${h.sections.join(', ')} · ${h.subjects.join(' / ')}\n~${h.predicted_present} of ${h.capacity} seats (${pct(h.seat_utilization)})`
                                             : `${d} P${p} · free`}
                            className="h-4 w-4 rounded-[3px]"
                            style={{ background: h ? utilColor(h.seat_utilization) : 'rgba(255,255,255,0.05)', opacity: h ? 0.9 : 1 }} />
                      );
                    })}
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] text-slate-500">Hover a cell for the class and predicted headcount. Combined elective classes are summed per room.</p>
    </MCard>
  );
}

// ── Rooms table ───────────────────────────────────────────────────────────────
function Rooms({ rooms }) {
  return (
    <MCard title="Room utilization next week" accent="#00FFB3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/8">
              {['Room', 'Type', 'Seats', 'Periods used', 'Periods in use', 'Fullness when used', 'Overall', 'Seat-hours'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.classroom_id} className="border-b border-white/5 hover:bg-white/3">
                <td className="px-3 py-2 font-mono text-white">{r.classroom_id}</td>
                <td className="px-3 py-2 text-slate-400">{r.type === 'LABORATORY' ? 'Lab' : 'Classroom'}</td>
                <td className="px-3 py-2 text-slate-300">{r.capacity}</td>
                <td className="px-3 py-2 text-slate-300">{r.periods_used} / {r.periods_available}</td>
                <td className="px-3 py-2 w-36">
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: pct(r.slot_utilization), background: '#38BDF8' }} />
                  </div>
                  <span className="text-[10px] text-slate-500">{pct(r.slot_utilization)}</span>
                </td>
                <td className="px-3 py-2" style={{ color: utilColor(r.seat_utilization_when_used) }}>{r.periods_used ? pct(r.seat_utilization_when_used) : '—'}</td>
                <td className="px-3 py-2 font-semibold text-white">{pct(r.overall_utilization)}</td>
                <td className="px-3 py-2 text-slate-400">{r.predicted_seat_hours.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        Overall = predicted seat-hours ÷ (seats × teaching periods). Above 100% means the room is booked beyond its seats.
      </p>
    </MCard>
  );
}

// ── Model card ────────────────────────────────────────────────────────────────
function MetricRow({ label, m, highlight }) {
  return (
    <tr className="border-b border-white/5">
      <td className={`px-3 py-2 ${highlight ? 'font-semibold text-white' : 'text-slate-400'}`}>{label}</td>
      <td className={`px-3 py-2 ${highlight ? 'font-semibold text-[#00FFB3]' : 'text-slate-300'}`}>{m.mae_students}</td>
      <td className="px-3 py-2 text-slate-300">{m.rmse_students}</td>
      <td className="px-3 py-2 text-slate-300">{m.r2}</td>
    </tr>
  );
}

function EvalTable({ title, rows, improvement, coverage, n }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-white">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${improvement > 2 ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-300'}`}>
          {improvement > 2 ? `${improvement}% lower error than best baseline` : `on par with best baseline (${improvement >= 0 ? '+' : ''}${improvement}%)`}
        </span>
      </div>
      <table className="w-full text-xs">
        <thead><tr className="border-b border-white/8">
          {['Method', 'Avg error (students)', 'RMSE', 'R²'].map((h) => <th key={h} className="px-3 py-1.5 text-left text-[10px] uppercase text-slate-500">{h}</th>)}
        </tr></thead>
        <tbody>{rows.map(([label, m, hl]) => <MetricRow key={label} label={label} m={m} highlight={hl} />)}</tbody>
      </table>
      <p className="mt-2 text-[10px] text-slate-500">{n} held-out sessions · 80% prediction range contained the actual headcount {pct(coverage)} of the time</p>
    </div>
  );
}

function ModelCard({ model, isAdmin, training, onRetrain }) {
  const m = model.metrics;
  const simulated = model.data_sources.simulated || 0;
  const recorded = model.data_sources.recorded || 0;
  const maxImp = Math.max(...model.feature_importance.map((f) => f.importance), 1e-6);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MCard title="Model" accent="#00FFB3" className="lg:col-span-1">
        <dl className="space-y-2 text-xs">
          {[['Algorithm', model.algorithm], ['Predicts', model.target], ['Blending', model.blend],
            ['Training data', `${model.training_rows.toLocaleString()} past sessions (${model.history_weeks} weeks)`],
            ['Evaluation', `trained on weeks ${model.train_weeks}, tested on weeks ${model.test_weeks}`],
            ['Trained', new Date(model.trained_at).toLocaleString()]].map(([k, v]) => (
            <div key={k}><dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt><dd className="text-slate-200">{v}</dd></div>
          ))}
        </dl>
        <div className="mt-4 rounded-xl border border-[#38BDF8]/25 bg-[#38BDF8]/8 p-3 text-[11px] text-slate-300 flex gap-2">
          <Info size={14} className="shrink-0 text-[#38BDF8] mt-0.5" />
          <span>
            {recorded === 0
              ? `Training history is simulated from the real timetable (${simulated.toLocaleString()} sessions) because no headcounts have been recorded yet. Record real headcounts and retrain to replace it.`
              : `${recorded.toLocaleString()} recorded and ${simulated.toLocaleString()} simulated sessions. Recorded headcounts replace simulated ones for the same session and date.`}
          </span>
        </div>
        {isAdmin && (
          <button onClick={onRetrain} disabled={training}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#00FFB3]/25 bg-[#00FFB3]/10 px-4 py-2 text-xs font-semibold text-[#00FFB3] hover:bg-[#00FFB3]/20 disabled:opacity-50">
            <RefreshCw size={13} className={training ? 'animate-spin' : ''} /> {training ? 'Retraining… (~20 s)' : 'Retrain model'}
          </button>
        )}
      </MCard>

      <MCard title="Held-out evaluation (weeks the model never saw)" accent="#00FFB3" className="lg:col-span-2">
        <div className="space-y-4">
          <EvalTable title="Existing sessions (have attendance history)" n={m.existing_sessions.rows}
            improvement={m.existing_sessions.improvement_pct} coverage={m.existing_sessions.interval_coverage_80}
            rows={[['ML model', m.existing_sessions.model, true],
                   ["Baseline: session's past average", m.existing_sessions.baseline_session_average],
                   ['Baseline: same as last week', m.existing_sessions.baseline_last_week]]} />
          <EvalTable title={`New or changed sessions (${m.new_sessions.sessions} timetable slots held out entirely)`} n={m.new_sessions.rows}
            improvement={m.new_sessions.improvement_pct} coverage={m.new_sessions.interval_coverage_80}
            rows={[['ML model', m.new_sessions.model, true],
                   ['Baseline: average for that type of session', m.new_sessions.baseline_session_type_average]]} />
        </div>
      </MCard>

      <MCard title="What drives the predictions" accent="#00FFB3" className="lg:col-span-3">
        <p className="mb-3 text-[11px] text-slate-500">Permutation importance: how much the error grows when an input is scrambled (new sessions).</p>
        <div className="grid gap-x-8 md:grid-cols-2">
          {model.feature_importance.filter((f) => f.importance > 0).map((f) => (
            <HBar key={f.feature} label={f.label} value={+(f.importance / maxImp * 100).toFixed(0)} max={100} color="#00FFB3" unit="" />
          ))}
        </div>
      </MCard>
    </div>
  );
}
